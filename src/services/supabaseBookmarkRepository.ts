import type { SupabaseClient } from '@supabase/supabase-js';
import type { Bookmark } from '../types';
import {
  type CreateBookmarkInput,
  type IBookmarkRepository,
} from './bookmarkService';
import {
  normalizeUrl,
  isValidUrl,
  getFaviconUrl,
  generateFallbackTitle,
  getPreviewImageUrl,
} from '../lib/metadata';
import { extractDomain } from '../lib/utils';
import { getSupabaseClient } from '../lib/supabase';
import { translateSupabaseError } from './supabaseError';

/**
 * Supabase-backed implementation of the bookmark repository.
 * Uses public.bookmarks, public.bookmark_tags, and the transactional
 * save_bookmark_with_tags RPC under authenticated RLS.
 */
export class SupabaseBookmarkRepository implements IBookmarkRepository {
  private client: SupabaseClient | null;

  constructor(client?: SupabaseClient) {
    this.client = client || null;
  }

  private getClient(): SupabaseClient {
    if (this.client) {
      return this.client;
    }
    return getSupabaseClient();
  }

  private generateId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return `bm_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private mapBookmarkRow(row: any): Bookmark {
    let collectionName: string | undefined;
    if (typeof row.collectionName === 'string' && row.collectionName.trim()) {
      collectionName = row.collectionName.trim();
    } else if (typeof row.collection_name === 'string' && row.collection_name.trim()) {
      collectionName = row.collection_name.trim();
    } else if (row.collections && typeof row.collections.name === 'string') {
      collectionName = row.collections.name;
    } else if (Array.isArray(row.collections) && row.collections[0]?.name) {
      collectionName = row.collections[0].name;
    }

    let tags: string[] = [];
    if (Array.isArray(row.bookmark_tags)) {
      tags = row.bookmark_tags
        .map((bt: any) => (typeof bt === 'string' ? bt : bt?.tag_id))
        .filter((t: any): t is string => typeof t === 'string' && Boolean(t.trim()));
    } else if (Array.isArray(row.tags)) {
      tags = row.tags.filter((t: any): t is string => typeof t === 'string' && Boolean(t.trim()));
    }

    return {
      id: row.id,
      url: row.url,
      title: row.title,
      domain: row.domain,
      description: row.description || undefined,
      favicon: row.favicon || undefined,
      previewImage: row.preview_image || row.previewImage || undefined,
      collectionId: row.collection_id || row.collectionId || undefined,
      collectionName,
      tags: tags.length > 0 ? tags : undefined,
      isFavourite: Boolean(row.is_favourite ?? row.isFavourite),
      createdAt: row.created_at || row.createdAt,
      updatedAt: row.updated_at || row.updatedAt || undefined,
    };
  }

  async getBookmarks(userId: string): Promise<Bookmark[]> {
    if (!userId || !userId.trim()) return [];

    const client = this.getClient();
    const { data, error } = await client
      .from('bookmarks')
      .select(`
        id,
        url,
        title,
        domain,
        description,
        favicon,
        preview_image,
        collection_id,
        is_favourite,
        created_at,
        updated_at,
        collections (name),
        bookmark_tags (tag_id)
      `)
      .eq('user_id', userId.trim())
      .order('created_at', { ascending: false });

    if (error) {
      throw translateSupabaseError(error, { entityType: 'bookmark' });
    }

    if (!data || !Array.isArray(data)) return [];

    return data.map((row) => this.mapBookmarkRow(row));
  }

  async getBookmarkById(userId: string, id: string): Promise<Bookmark | null> {
    if (!userId || !userId.trim() || !id || !id.trim()) return null;

    const client = this.getClient();
    const { data, error } = await client
      .from('bookmarks')
      .select(`
        id,
        url,
        title,
        domain,
        description,
        favicon,
        preview_image,
        collection_id,
        is_favourite,
        created_at,
        updated_at,
        collections (name),
        bookmark_tags (tag_id)
      `)
      .eq('id', id.trim())
      .eq('user_id', userId.trim())
      .maybeSingle();

    if (error) {
      throw translateSupabaseError(error, { entityType: 'bookmark' });
    }

    if (!data) return null;

    return this.mapBookmarkRow(data);
  }

  async addBookmark(userId: string, input: CreateBookmarkInput): Promise<Bookmark> {
    if (!userId || !userId.trim()) {
      throw new Error('You must be signed in to save bookmarks to your shelf.');
    }

    const rawUrl = input.url?.trim() || '';
    if (!rawUrl) {
      throw new Error('Please enter a website URL.');
    }

    const normalizedUrl = normalizeUrl(rawUrl);
    if (!normalizedUrl || !isValidUrl(normalizedUrl)) {
      throw new Error('Please enter a valid website URL (e.g. https://example.com).');
    }

    const client = this.getClient();

    // Check duplicate URL for this user
    const { data: existingRows, error: checkError } = await client
      .from('bookmarks')
      .select('id, url')
      .eq('user_id', userId.trim());

    if (checkError) {
      throw translateSupabaseError(checkError, { entityType: 'bookmark' });
    }

    if (existingRows) {
      const isDuplicate = existingRows.some(
        (b: any) => normalizeUrl(b.url).toLowerCase() === normalizedUrl.toLowerCase()
      );
      if (isDuplicate) {
        throw new Error('This link is already saved in your shelf.');
      }
    }

    const domain = extractDomain(normalizedUrl);
    const title = input.title?.trim() || generateFallbackTitle(normalizedUrl);
    const favicon = input.favicon || getFaviconUrl(domain);
    const previewImage = input.previewImage || getPreviewImageUrl(normalizedUrl);
    const id = this.generateId();
    const now = new Date().toISOString();

    const pBookmark = {
      id,
      url: normalizedUrl,
      title,
      domain,
      description: input.description?.trim() || null,
      favicon: favicon || null,
      previewImage: previewImage || null,
      collectionId: input.collectionId?.trim() || null,
      isFavourite: Boolean(input.isFavourite),
      createdAt: now,
      updatedAt: now,
    };

    const pTagIds = Array.isArray(input.tags)
      ? [...new Set(input.tags.filter((t): t is string => typeof t === 'string' && Boolean(t.trim())))]
      : [];

    const { data, error } = await client.rpc('save_bookmark_with_tags', {
      p_bookmark: pBookmark,
      p_tag_ids: pTagIds,
    });

    if (error) {
      throw translateSupabaseError(error, { entityType: 'bookmark' });
    }

    return this.mapBookmarkRow(data);
  }

  async updateBookmark(
    userId: string,
    id: string,
    updates: Partial<Bookmark>
  ): Promise<Bookmark> {
    if (!userId || !userId.trim()) {
      throw new Error('You must be signed in to update a bookmark.');
    }
    if (!id || !id.trim()) {
      throw new Error('Bookmark ID is required.');
    }

    const current = await this.getBookmarkById(userId, id);
    if (!current) {
      throw new Error('Bookmark not found.');
    }

    const client = this.getClient();

    let normalizedUrl = current.url;
    let domain = current.domain;

    if (updates.url !== undefined) {
      const candidate = normalizeUrl(updates.url.trim());
      if (!candidate || !isValidUrl(candidate)) {
        throw new Error('Please enter a valid website URL (e.g. https://example.com).');
      }
      if (candidate.toLowerCase() !== normalizeUrl(current.url).toLowerCase()) {
        const { data: existingRows, error: checkError } = await client
          .from('bookmarks')
          .select('id, url')
          .eq('user_id', userId.trim());

        if (checkError) {
          throw translateSupabaseError(checkError, { entityType: 'bookmark' });
        }

        if (existingRows) {
          const isDuplicate = existingRows.some(
            (b: any) => b.id !== id && normalizeUrl(b.url).toLowerCase() === candidate.toLowerCase()
          );
          if (isDuplicate) {
            throw new Error('This link is already saved in your shelf.');
          }
        }
        normalizedUrl = candidate;
        domain = extractDomain(candidate);
      }
    }

    const title = updates.title !== undefined ? updates.title.trim() || generateFallbackTitle(normalizedUrl) : current.title;
    const description = updates.description !== undefined ? updates.description.trim() || null : (current.description || null);
    const favicon = updates.favicon !== undefined ? updates.favicon.trim() || null : (current.favicon || null);
    const previewImage = updates.previewImage !== undefined ? updates.previewImage.trim() || null : (current.previewImage || null);
    const collectionId = updates.collectionId !== undefined ? (updates.collectionId ? updates.collectionId.trim() : null) : (current.collectionId || null);
    const isFavourite = updates.isFavourite !== undefined ? Boolean(updates.isFavourite) : current.isFavourite;

    let tags: string[] = current.tags || [];
    if (updates.tags !== undefined) {
      tags = Array.isArray(updates.tags)
        ? [...new Set(updates.tags.filter((t): t is string => typeof t === 'string' && Boolean(t.trim())))]
        : [];
    }

    const now = new Date().toISOString();
    const pBookmark = {
      id: current.id,
      url: normalizedUrl,
      title,
      domain,
      description,
      favicon,
      previewImage,
      collectionId,
      isFavourite,
      createdAt: current.createdAt,
      updatedAt: now,
    };

    const { data, error } = await client.rpc('save_bookmark_with_tags', {
      p_bookmark: pBookmark,
      p_tag_ids: tags,
    });

    if (error) {
      throw translateSupabaseError(error, { entityType: 'bookmark' });
    }

    return this.mapBookmarkRow(data);
  }

  async deleteBookmark(userId: string, id: string): Promise<void> {
    if (!userId || !userId.trim()) {
      throw new Error('You must be signed in to delete a bookmark.');
    }
    if (!id || !id.trim()) return;

    const client = this.getClient();
    const { error } = await client
      .from('bookmarks')
      .delete()
      .eq('id', id.trim())
      .eq('user_id', userId.trim());

    if (error) {
      throw translateSupabaseError(error, { entityType: 'bookmark' });
    }
  }

  async toggleFavourite(userId: string, id: string): Promise<Bookmark> {
    const current = await this.getBookmarkById(userId, id);
    if (!current) {
      throw new Error('Bookmark not found.');
    }
    return this.updateBookmark(userId, id, { isFavourite: !current.isFavourite });
  }

  async updateBookmarksCollectionName(
    _userId: string,
    _collectionId: string,
    _newCollectionName: string
  ): Promise<void> {
    // In Supabase, collectionName is resolved dynamically via relational join:
    // collections(name). When collections.name is updated, bookmark queries
    // automatically reflect the new name without requiring denormalized updates.
    return Promise.resolve();
  }

  async removeBookmarksFromCollection(userId: string, collectionId: string): Promise<void> {
    if (!userId || !userId.trim() || !collectionId || !collectionId.trim()) return;

    const client = this.getClient();
    const { error } = await client
      .from('bookmarks')
      .update({
        collection_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq('collection_id', collectionId.trim())
      .eq('user_id', userId.trim());

    if (error) {
      throw translateSupabaseError(error, { entityType: 'bookmark' });
    }
  }

  async removeTagFromBookmarks(userId: string, tagId: string): Promise<void> {
    if (!userId || !userId.trim() || !tagId || !tagId.trim()) return;

    const client = this.getClient();
    const { error } = await client
      .from('bookmark_tags')
      .delete()
      .eq('tag_id', tagId.trim())
      .eq('user_id', userId.trim());

    if (error) {
      throw translateSupabaseError(error, { entityType: 'bookmark' });
    }
  }
}

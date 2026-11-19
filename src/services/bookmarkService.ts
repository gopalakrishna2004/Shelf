import type { Bookmark } from '../types';
import { normalizeUrl, isValidUrl, getFaviconUrl, generateFallbackTitle, getPreviewImageUrl } from '../lib/metadata';
import { extractDomain } from '../lib/utils';
import { SupabaseBookmarkRepository } from './supabaseBookmarkRepository';

export interface CreateBookmarkInput {
  url: string;
  title?: string;
  description?: string;
  collectionId?: string;
  collectionName?: string;
  tags?: string[];
  isFavourite?: boolean;
  favicon?: string;
  previewImage?: string;
}

export interface IBookmarkRepository {
  getBookmarks(userId: string): Promise<Bookmark[]>;
  getBookmarkById(userId: string, id: string): Promise<Bookmark | null>;
  addBookmark(userId: string, input: CreateBookmarkInput): Promise<Bookmark>;
  updateBookmark(userId: string, id: string, updates: Partial<Bookmark>): Promise<Bookmark>;
  deleteBookmark(userId: string, id: string): Promise<void>;
  toggleFavourite(userId: string, id: string): Promise<Bookmark>;
  updateBookmarksCollectionName(userId: string, collectionId: string, newCollectionName: string): Promise<void>;
  removeBookmarksFromCollection(userId: string, collectionId: string): Promise<void>;
  removeTagFromBookmarks(userId: string, tagId: string): Promise<void>;
}

/**
 * LocalStorage-backed implementation of the bookmark repository.
 * Keeps storage operations strictly scoped to the authenticated user ID.
 * Designed so Stage 5 can seamlessly introduce Supabase/IndexedDB repositories
 * without requiring any changes to UI components.
 */
export class LocalBookmarkRepository implements IBookmarkRepository {
  private getStorageKey(userId: string): string {
    if (!userId || !userId.trim()) {
      throw new Error('Authentication required: Cannot access bookmarks without a valid user ID.');
    }
    return `shelf_bookmarks_${userId.trim()}`;
  }

  private readStorage(userId: string): Bookmark[] {
    try {
      const key = this.getStorageKey(userId);
      const data = localStorage.getItem(key);
      if (!data) return [];
      const parsed = JSON.parse(data);
      if (!Array.isArray(parsed)) return [];
      // Defensive schema validation
      return parsed.filter(
        (item): item is Bookmark =>
          Boolean(item && typeof item === 'object' && typeof item.id === 'string' && typeof item.url === 'string')
      );
    } catch (err) {
      console.error('[Shelf Bookmark Repository] Error reading from storage:', err);
      return [];
    }
  }

  private writeStorage(userId: string, bookmarks: Bookmark[]): void {
    try {
      const key = this.getStorageKey(userId);
      localStorage.setItem(key, JSON.stringify(bookmarks));
      // Dispatch custom event for cross-component synchronisation
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('shelf-bookmarks-updated', { detail: { userId } }));
      }
    } catch (err) {
      console.error('[Shelf Bookmark Repository] Error writing to storage:', err);
      throw new Error('Unable to save bookmark. Browser storage may be full or disabled.');
    }
  }

  private generateId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return `bm_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  async getBookmarks(userId: string): Promise<Bookmark[]> {
    if (!userId) return [];
    return this.readStorage(userId);
  }

  async getBookmarkById(userId: string, id: string): Promise<Bookmark | null> {
    if (!userId || !id) return null;
    const bookmarks = this.readStorage(userId);
    return bookmarks.find((b) => b.id === id) || null;
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

    const existing = this.readStorage(userId);

    // Duplicate detection based on normalized URL
    const isDuplicate = existing.some(
      (b) => normalizeUrl(b.url).toLowerCase() === normalizedUrl.toLowerCase()
    );
    if (isDuplicate) {
      throw new Error('This link is already saved in your shelf.');
    }

    const domain = extractDomain(normalizedUrl);
    const title = input.title?.trim() || generateFallbackTitle(normalizedUrl);
    const favicon = input.favicon || getFaviconUrl(domain);
    const previewImage = input.previewImage || getPreviewImageUrl(normalizedUrl);
    const now = new Date().toISOString();

    const newBookmark: Bookmark = {
      id: this.generateId(),
      url: normalizedUrl,
      title,
      domain,
      description: input.description?.trim() || undefined,
      favicon: favicon || undefined,
      previewImage: previewImage || undefined,
      collectionId: input.collectionId || undefined,
      collectionName: input.collectionName || undefined,
      tags: input.tags && input.tags.length > 0 ? [...new Set(input.tags)] : undefined,
      isFavourite: Boolean(input.isFavourite),
      createdAt: now,
      updatedAt: now,
    };

    // Prepend to list (newest first)
    const updated = [newBookmark, ...existing];
    this.writeStorage(userId, updated);

    return newBookmark;
  }

  async updateBookmark(userId: string, id: string, updates: Partial<Bookmark>): Promise<Bookmark> {
    const existing = this.readStorage(userId);
    const index = existing.findIndex((b) => b.id === id);
    if (index === -1) {
      throw new Error('Bookmark not found.');
    }

    const current = existing[index];

    // If URL is being updated, validate and verify no duplicates with other bookmarks
    let normalizedUrl = current.url;
    let domain = current.domain;
    if (updates.url && updates.url.trim()) {
      const candidate = normalizeUrl(updates.url.trim());
      if (!candidate || !isValidUrl(candidate)) {
        throw new Error('Please enter a valid website URL (e.g. https://example.com).');
      }
      if (candidate.toLowerCase() !== normalizeUrl(current.url).toLowerCase()) {
        const isDuplicate = existing.some(
          (b) => b.id !== id && normalizeUrl(b.url).toLowerCase() === candidate.toLowerCase()
        );
        if (isDuplicate) {
          throw new Error('This link is already saved in your shelf.');
        }
        normalizedUrl = candidate;
        domain = extractDomain(candidate);
      }
    }

    const now = new Date().toISOString();

    let tags = current.tags;
    if (updates.tags !== undefined) {
      tags = updates.tags.length > 0 ? [...new Set(updates.tags)] : undefined;
    }

    const updatedBookmark: Bookmark = {
      ...current,
      ...updates,
      tags,
      url: normalizedUrl,
      domain,
      id: current.id, // Immutable ID
      createdAt: current.createdAt, // Immutable creation timestamp
      updatedAt: now,
    };

    existing[index] = updatedBookmark;
    this.writeStorage(userId, existing);

    return updatedBookmark;
  }

  async deleteBookmark(userId: string, id: string): Promise<void> {
    const existing = this.readStorage(userId);
    const filtered = existing.filter((b) => b.id !== id);
    this.writeStorage(userId, filtered);
  }

  async toggleFavourite(userId: string, id: string): Promise<Bookmark> {
    const existing = this.readStorage(userId);
    const target = existing.find((b) => b.id === id);
    if (!target) {
      throw new Error('Bookmark not found.');
    }

    return this.updateBookmark(userId, id, {
      isFavourite: !target.isFavourite,
    });
  }

  async updateBookmarksCollectionName(userId: string, collectionId: string, newCollectionName: string): Promise<void> {
    if (!userId || !collectionId) return;
    const existing = this.readStorage(userId);
    let changed = false;
    const now = new Date().toISOString();
    const updated = existing.map((b) => {
      if (b.collectionId === collectionId) {
        changed = true;
        return {
          ...b,
          collectionName: newCollectionName,
          updatedAt: now,
        };
      }
      return b;
    });

    if (changed) {
      this.writeStorage(userId, updated);
    }
  }

  async removeBookmarksFromCollection(userId: string, collectionId: string): Promise<void> {
    if (!userId || !collectionId) return;
    const existing = this.readStorage(userId);
    let changed = false;
    const now = new Date().toISOString();
    const updated = existing.map((b) => {
      if (b.collectionId === collectionId) {
        changed = true;
        const { collectionId: _cid, collectionName: _cname, ...rest } = b;
        return {
          ...rest,
          collectionId: undefined,
          collectionName: undefined,
          updatedAt: now,
        };
      }
      return b;
    });

    if (changed) {
      this.writeStorage(userId, updated);
    }
  }

  async removeTagFromBookmarks(userId: string, tagId: string): Promise<void> {
    if (!userId || !tagId) return;
    const existing = this.readStorage(userId);
    let changed = false;
    const now = new Date().toISOString();
    const updated = existing.map((b) => {
      if (b.tags && b.tags.includes(tagId)) {
        changed = true;
        const remainingTags = b.tags.filter((t) => t !== tagId);
        return {
          ...b,
          tags: remainingTags.length > 0 ? remainingTags : undefined,
          updatedAt: now,
        };
      }
      return b;
    });

    if (changed) {
      this.writeStorage(userId, updated);
    }
  }
}

// Singleton repository instance — switched to Supabase in Stage 5.4 Increment 4
export const bookmarkRepository: IBookmarkRepository = new SupabaseBookmarkRepository();

// Export Supabase repository implementation for Stage 5 cloud persistence
export { SupabaseBookmarkRepository } from './supabaseBookmarkRepository';


import type { SupabaseClient } from '@supabase/supabase-js';
import type { Collection } from '../types';
import {
  type CreateCollectionInput,
  type UpdateCollectionInput,
  type ICollectionRepository,
} from './collectionService';
import { getSupabaseClient } from '../lib/supabase';
import { translateSupabaseError } from './supabaseError';

/**
 * Supabase-backed implementation of the collection repository.
 * Operates directly against the public.collections table under authenticated RLS.
 */
export class SupabaseCollectionRepository implements ICollectionRepository {
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
    return `col_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private extractCount(bookmarks: any): number {
    if (Array.isArray(bookmarks) && bookmarks[0]) {
      return Number(bookmarks[0].count) || 0;
    }
    if (bookmarks && typeof bookmarks.count === 'number') {
      return bookmarks.count;
    }
    return 0;
  }

  async getCollections(userId: string): Promise<Collection[]> {
    if (!userId || !userId.trim()) return [];

    const client = this.getClient();
    const { data, error } = await client
      .from('collections')
      .select('id, name, description, color, created_at, updated_at, bookmarks(count)')
      .eq('user_id', userId.trim())
      .order('created_at', { ascending: false });

    if (error) {
      throw translateSupabaseError(error, { entityType: 'collection' });
    }

    if (!data || !Array.isArray(data)) return [];

    return data.map((row: any): Collection => ({
      id: row.id,
      name: row.name,
      description: row.description || undefined,
      color: row.color || undefined,
      count: this.extractCount(row.bookmarks),
      createdAt: row.created_at,
      updatedAt: row.updated_at || undefined,
    }));
  }

  async getCollectionById(userId: string, id: string): Promise<Collection | null> {
    if (!userId || !userId.trim() || !id || !id.trim()) return null;

    const client = this.getClient();
    const { data, error } = await client
      .from('collections')
      .select('id, name, description, color, created_at, updated_at, bookmarks(count)')
      .eq('id', id.trim())
      .eq('user_id', userId.trim())
      .maybeSingle();

    if (error) {
      throw translateSupabaseError(error, { entityType: 'collection' });
    }

    if (!data) return null;

    return {
      id: data.id,
      name: data.name,
      description: data.description || undefined,
      color: data.color || undefined,
      count: this.extractCount((data as any).bookmarks),
      createdAt: data.created_at,
      updatedAt: data.updated_at || undefined,
    };
  }

  async createCollection(userId: string, input: CreateCollectionInput): Promise<Collection> {
    if (!userId || !userId.trim()) {
      throw new Error('You must be signed in to create a collection.');
    }

    const trimmedName = input.name?.trim() || '';
    if (!trimmedName) {
      throw new Error('Collection name cannot be empty.');
    }

    const client = this.getClient();
    const id = this.generateId();
    const now = new Date().toISOString();

    const insertPayload = {
      id,
      user_id: userId.trim(),
      name: trimmedName,
      description: input.description !== undefined && input.description.trim() ? input.description.trim() : null,
      color: input.color !== undefined && input.color.trim() ? input.color.trim() : null,
      created_at: now,
      updated_at: now,
    };

    const { data, error } = await client
      .from('collections')
      .insert(insertPayload)
      .select('id, name, description, color, created_at, updated_at')
      .single();

    if (error) {
      throw translateSupabaseError(error, { entityType: 'collection', name: trimmedName });
    }

    return {
      id: data.id,
      name: data.name,
      description: data.description || undefined,
      color: data.color || undefined,
      count: 0,
      createdAt: data.created_at,
      updatedAt: data.updated_at || undefined,
    };
  }

  async updateCollection(
    userId: string,
    id: string,
    input: UpdateCollectionInput
  ): Promise<Collection> {
    if (!userId || !userId.trim()) {
      throw new Error('You must be signed in to update a collection.');
    }
    if (!id || !id.trim()) {
      throw new Error('Collection ID is required.');
    }

    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    let trimmedName: string | undefined;
    if (input.name !== undefined) {
      trimmedName = input.name.trim();
      if (!trimmedName) {
        throw new Error('Collection name cannot be empty.');
      }
      updates.name = trimmedName;
    }

    if (input.description !== undefined) {
      updates.description = input.description.trim() || null;
    }

    if (input.color !== undefined) {
      updates.color = input.color.trim() || null;
    }

    const client = this.getClient();
    const { data, error } = await client
      .from('collections')
      .update(updates)
      .eq('id', id.trim())
      .eq('user_id', userId.trim())
      .select('id, name, description, color, created_at, updated_at, bookmarks(count)')
      .single();

    if (error) {
      throw translateSupabaseError(error, { entityType: 'collection', name: trimmedName });
    }

    return {
      id: data.id,
      name: data.name,
      description: data.description || undefined,
      color: data.color || undefined,
      count: this.extractCount((data as any).bookmarks),
      createdAt: data.created_at,
      updatedAt: data.updated_at || undefined,
    };
  }

  async deleteCollection(userId: string, id: string): Promise<void> {
    if (!userId || !userId.trim()) {
      throw new Error('You must be signed in to delete a collection.');
    }
    if (!id || !id.trim()) return;

    const client = this.getClient();
    const { error } = await client
      .from('collections')
      .delete()
      .eq('id', id.trim())
      .eq('user_id', userId.trim());

    if (error) {
      throw translateSupabaseError(error, { entityType: 'collection' });
    }
  }
}

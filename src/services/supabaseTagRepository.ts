import type { SupabaseClient } from '@supabase/supabase-js';
import type { Tag } from '../types';
import {
  type CreateTagInput,
  type UpdateTagInput,
  type ITagRepository,
} from './tagService';
import { getSupabaseClient } from '../lib/supabase';
import { translateSupabaseError } from './supabaseError';

/**
 * Supabase-backed implementation of the tag repository.
 * Operates directly against the public.tags table under authenticated RLS.
 */
export class SupabaseTagRepository implements ITagRepository {
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
    return `tag_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  async getTags(userId: string): Promise<Tag[]> {
    if (!userId || !userId.trim()) return [];

    const client = this.getClient();
    const { data, error } = await client
      .from('tags')
      .select('id, name, created_at, updated_at')
      .eq('user_id', userId.trim())
      .order('created_at', { ascending: false });

    if (error) {
      throw translateSupabaseError(error, { entityType: 'tag' });
    }

    if (!data || !Array.isArray(data)) return [];

    return data.map((row: any): Tag => ({
      id: row.id,
      name: row.name,
      createdAt: row.created_at,
      updatedAt: row.updated_at || undefined,
    }));
  }

  async getTagById(userId: string, id: string): Promise<Tag | null> {
    if (!userId || !userId.trim() || !id || !id.trim()) return null;

    const client = this.getClient();
    const { data, error } = await client
      .from('tags')
      .select('id, name, created_at, updated_at')
      .eq('id', id.trim())
      .eq('user_id', userId.trim())
      .maybeSingle();

    if (error) {
      throw translateSupabaseError(error, { entityType: 'tag' });
    }

    if (!data) return null;

    return {
      id: data.id,
      name: data.name,
      createdAt: data.created_at,
      updatedAt: data.updated_at || undefined,
    };
  }

  async createTag(userId: string, input: CreateTagInput): Promise<Tag> {
    if (!userId || !userId.trim()) {
      throw new Error('You must be signed in to create a tag.');
    }

    const trimmedName = input.name?.trim() || '';
    if (!trimmedName) {
      throw new Error('Tag name cannot be empty.');
    }

    const client = this.getClient();
    const id = this.generateId();
    const now = new Date().toISOString();

    const insertPayload = {
      id,
      user_id: userId.trim(),
      name: trimmedName,
      created_at: now,
      updated_at: now,
    };

    const { data, error } = await client
      .from('tags')
      .insert(insertPayload)
      .select('id, name, created_at, updated_at')
      .single();

    if (error) {
      throw translateSupabaseError(error, { entityType: 'tag', name: trimmedName });
    }

    return {
      id: data.id,
      name: data.name,
      createdAt: data.created_at,
      updatedAt: data.updated_at || undefined,
    };
  }

  async updateTag(userId: string, id: string, input: UpdateTagInput): Promise<Tag> {
    if (!userId || !userId.trim()) {
      throw new Error('You must be signed in to update a tag.');
    }
    if (!id || !id.trim()) {
      throw new Error('Tag ID is required.');
    }

    const trimmedName = input.name?.trim() || '';
    if (!trimmedName) {
      throw new Error('Tag name cannot be empty.');
    }

    const client = this.getClient();
    const { data, error } = await client
      .from('tags')
      .update({
        name: trimmedName,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id.trim())
      .eq('user_id', userId.trim())
      .select('id, name, created_at, updated_at')
      .single();

    if (error) {
      throw translateSupabaseError(error, { entityType: 'tag', name: trimmedName });
    }

    return {
      id: data.id,
      name: data.name,
      createdAt: data.created_at,
      updatedAt: data.updated_at || undefined,
    };
  }

  async deleteTag(userId: string, id: string): Promise<void> {
    if (!userId || !userId.trim()) {
      throw new Error('You must be signed in to delete a tag.');
    }
    if (!id || !id.trim()) return;

    const client = this.getClient();
    const { error } = await client
      .from('tags')
      .delete()
      .eq('id', id.trim())
      .eq('user_id', userId.trim());

    if (error) {
      throw translateSupabaseError(error, { entityType: 'tag' });
    }
  }
}

import type { Tag } from '../types';
import { SupabaseTagRepository } from './supabaseTagRepository';

export interface CreateTagInput {
  name: string;
}

export interface UpdateTagInput {
  name: string;
}

export interface ITagRepository {
  getTags(userId: string): Promise<Tag[]>;
  getTagById(userId: string, id: string): Promise<Tag | null>;
  createTag(userId: string, input: CreateTagInput): Promise<Tag>;
  updateTag(userId: string, id: string, input: UpdateTagInput): Promise<Tag>;
  deleteTag(userId: string, id: string): Promise<void>;
}

/**
 * LocalStorage-backed implementation of the tag repository.
 * Keeps storage operations strictly scoped to the authenticated user ID.
 * Follows the same isolation and safety guarantees as Bookmark & Collection repositories.
 */
export class LocalTagRepository implements ITagRepository {
  private getStorageKey(userId: string): string {
    if (!userId || !userId.trim()) {
      throw new Error('Authentication required: Cannot access tags without a valid user ID.');
    }
    return `shelf_tags_${userId.trim()}`;
  }

  private readStorage(userId: string): Tag[] {
    try {
      const key = this.getStorageKey(userId);
      const data = localStorage.getItem(key);
      if (!data) return [];
      const parsed = JSON.parse(data);
      if (!Array.isArray(parsed)) return [];
      // Defensive schema validation
      return parsed.filter(
        (item): item is Tag =>
          Boolean(item && typeof item === 'object' && typeof item.id === 'string' && typeof item.name === 'string')
      );
    } catch (err) {
      console.error('[Shelf Tag Repository] Error reading from storage:', err);
      return [];
    }
  }

  private writeStorage(userId: string, tags: Tag[]): void {
    try {
      const key = this.getStorageKey(userId);
      localStorage.setItem(key, JSON.stringify(tags));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('shelf-tags-updated', { detail: { userId } }));
      }
    } catch (err) {
      console.error('[Shelf Tag Repository] Error writing to storage:', err);
      throw new Error('Unable to save tag. Browser storage may be full or disabled.');
    }
  }

  private generateId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return `tag_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  async getTags(userId: string): Promise<Tag[]> {
    if (!userId) return [];
    return this.readStorage(userId);
  }

  async getTagById(userId: string, id: string): Promise<Tag | null> {
    if (!userId || !id) return null;
    const tags = this.readStorage(userId);
    return tags.find((t) => t.id === id) || null;
  }

  async createTag(userId: string, input: CreateTagInput): Promise<Tag> {
    if (!userId || !userId.trim()) {
      throw new Error('You must be signed in to create a tag.');
    }

    const trimmedName = input.name?.trim() || '';
    if (!trimmedName) {
      throw new Error('Tag name cannot be empty.');
    }

    const existing = this.readStorage(userId);

    // Case-insensitive duplicate check
    const isDuplicate = existing.some(
      (t) => t.name.trim().toLowerCase() === trimmedName.toLowerCase()
    );
    if (isDuplicate) {
      throw new Error(`A tag named "${trimmedName}" already exists.`);
    }

    const now = new Date().toISOString();
    const newTag: Tag = {
      id: this.generateId(),
      name: trimmedName,
      createdAt: now,
      updatedAt: now,
    };

    const updated = [...existing, newTag];
    this.writeStorage(userId, updated);

    return newTag;
  }

  async updateTag(userId: string, id: string, input: UpdateTagInput): Promise<Tag> {
    if (!userId || !userId.trim()) {
      throw new Error('You must be signed in to update a tag.');
    }

    const existing = this.readStorage(userId);
    const index = existing.findIndex((t) => t.id === id);
    if (index === -1) {
      throw new Error('Tag not found.');
    }

    const current = existing[index];
    const trimmed = input.name?.trim() || '';
    if (!trimmed) {
      throw new Error('Tag name cannot be empty.');
    }

    // Check duplicates with other tags (case-insensitive)
    const isDuplicate = existing.some(
      (t) => t.id !== id && t.name.trim().toLowerCase() === trimmed.toLowerCase()
    );
    if (isDuplicate) {
      throw new Error(`A tag named "${trimmed}" already exists.`);
    }

    const now = new Date().toISOString();
    const updatedTag: Tag = {
      ...current,
      name: trimmed,
      id: current.id, // Immutable ID
      createdAt: current.createdAt, // Immutable creation timestamp
      updatedAt: now,
    };

    existing[index] = updatedTag;
    this.writeStorage(userId, existing);

    return updatedTag;
  }

  async deleteTag(userId: string, id: string): Promise<void> {
    if (!userId || !userId.trim()) {
      throw new Error('You must be signed in to delete a tag.');
    }

    const existing = this.readStorage(userId);
    const filtered = existing.filter((t) => t.id !== id);
    this.writeStorage(userId, filtered);
  }
}

// Singleton repository instance — switched to Supabase in Stage 5.4 Increment 4
export const tagRepository: ITagRepository = new SupabaseTagRepository();

// Export Supabase repository implementation for Stage 5 cloud persistence
export { SupabaseTagRepository } from './supabaseTagRepository';


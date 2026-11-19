import type { Collection } from '../types';
import { SupabaseCollectionRepository } from './supabaseCollectionRepository';

export interface CreateCollectionInput {
  name: string;
  description?: string;
  color?: string;
}

export interface UpdateCollectionInput {
  name?: string;
  description?: string;
  color?: string;
}

export interface ICollectionRepository {
  getCollections(userId: string): Promise<Collection[]>;
  getCollectionById(userId: string, id: string): Promise<Collection | null>;
  createCollection(userId: string, input: CreateCollectionInput): Promise<Collection>;
  updateCollection(userId: string, id: string, input: UpdateCollectionInput): Promise<Collection>;
  deleteCollection(userId: string, id: string): Promise<void>;
}

/**
 * LocalStorage-backed implementation of the collection repository.
 * Keeps storage operations strictly scoped to the authenticated user ID.
 * Matches the existing bookmark repository architecture.
 */
export class LocalCollectionRepository implements ICollectionRepository {
  private getStorageKey(userId: string): string {
    if (!userId || !userId.trim()) {
      throw new Error('Authentication required: Cannot access collections without a valid user ID.');
    }
    return `shelf_collections_${userId.trim()}`;
  }

  private readStorage(userId: string): Collection[] {
    try {
      const key = this.getStorageKey(userId);
      const data = localStorage.getItem(key);
      if (!data) return [];
      const parsed = JSON.parse(data);
      if (!Array.isArray(parsed)) return [];
      // Defensive schema validation
      return parsed.filter(
        (item): item is Collection =>
          Boolean(item && typeof item === 'object' && typeof item.id === 'string' && typeof item.name === 'string')
      );
    } catch (err) {
      console.error('[Shelf Collection Repository] Error reading from storage:', err);
      return [];
    }
  }

  private writeStorage(userId: string, collections: Collection[]): void {
    try {
      const key = this.getStorageKey(userId);
      localStorage.setItem(key, JSON.stringify(collections));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('shelf-collections-updated', { detail: { userId } }));
      }
    } catch (err) {
      console.error('[Shelf Collection Repository] Error writing to storage:', err);
      throw new Error('Unable to save collection. Browser storage may be full or disabled.');
    }
  }

  private generateId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return `col_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  async getCollections(userId: string): Promise<Collection[]> {
    if (!userId) return [];
    return this.readStorage(userId);
  }

  async getCollectionById(userId: string, id: string): Promise<Collection | null> {
    if (!userId || !id) return null;
    const collections = this.readStorage(userId);
    return collections.find((c) => c.id === id) || null;
  }

  async createCollection(userId: string, input: CreateCollectionInput): Promise<Collection> {
    if (!userId || !userId.trim()) {
      throw new Error('You must be signed in to create a collection.');
    }

    const trimmedName = input.name?.trim() || '';
    if (!trimmedName) {
      throw new Error('Collection name cannot be empty.');
    }

    const existing = this.readStorage(userId);

    // Case-insensitive duplicate check
    const isDuplicate = existing.some(
      (c) => c.name.trim().toLowerCase() === trimmedName.toLowerCase()
    );
    if (isDuplicate) {
      throw new Error(`A collection named "${trimmedName}" already exists.`);
    }

    const now = new Date().toISOString();
    const newCollection: Collection = {
      id: this.generateId(),
      name: trimmedName,
      description: input.description?.trim() || undefined,
      color: input.color || undefined,
      count: 0,
      createdAt: now,
      updatedAt: now,
    };

    const updated = [...existing, newCollection];
    this.writeStorage(userId, updated);

    return newCollection;
  }

  async updateCollection(userId: string, id: string, input: UpdateCollectionInput): Promise<Collection> {
    if (!userId || !userId.trim()) {
      throw new Error('You must be signed in to update a collection.');
    }

    const existing = this.readStorage(userId);
    const index = existing.findIndex((c) => c.id === id);
    if (index === -1) {
      throw new Error('Collection not found.');
    }

    const current = existing[index];
    let nextName = current.name;

    if (input.name !== undefined) {
      const trimmed = input.name.trim();
      if (!trimmed) {
        throw new Error('Collection name cannot be empty.');
      }

      // Check duplicates with other collections (case-insensitive)
      const isDuplicate = existing.some(
        (c) => c.id !== id && c.name.trim().toLowerCase() === trimmed.toLowerCase()
      );
      if (isDuplicate) {
        throw new Error(`A collection named "${trimmed}" already exists.`);
      }

      nextName = trimmed;
    }

    const now = new Date().toISOString();
    const updatedCollection: Collection = {
      ...current,
      name: nextName,
      description: input.description !== undefined ? input.description.trim() || undefined : current.description,
      color: input.color !== undefined ? input.color : current.color,
      id: current.id, // Preserves immutable ID
      createdAt: current.createdAt, // Preserves immutable creation timestamp
      updatedAt: now,
    };

    existing[index] = updatedCollection;
    this.writeStorage(userId, existing);

    return updatedCollection;
  }

  async deleteCollection(userId: string, id: string): Promise<void> {
    if (!userId || !userId.trim()) {
      throw new Error('You must be signed in to delete a collection.');
    }

    const existing = this.readStorage(userId);
    const filtered = existing.filter((c) => c.id !== id);
    this.writeStorage(userId, filtered);
  }
}

// Singleton repository instance — switched to Supabase in Stage 5.4 Increment 4
export const collectionRepository: ICollectionRepository = new SupabaseCollectionRepository();

// Export Supabase repository implementation for Stage 5 cloud persistence
export { SupabaseCollectionRepository } from './supabaseCollectionRepository';


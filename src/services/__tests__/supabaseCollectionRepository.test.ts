import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SupabaseCollectionRepository } from '../supabaseCollectionRepository';

describe('SupabaseCollectionRepository', () => {
  let mockClient: any;
  let mockQueryBuilder: any;
  let repository: SupabaseCollectionRepository;

  const userId = 'user_col_test_123';

  beforeEach(() => {
    mockQueryBuilder = {
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      single: vi.fn(),
      maybeSingle: vi.fn(),
      then: vi.fn((resolve) => resolve({ data: null, error: null })),
    };

    mockClient = {
      from: vi.fn().mockReturnValue(mockQueryBuilder),
      rpc: vi.fn(),
    };

    repository = new SupabaseCollectionRepository(mockClient);
  });

  describe('getCollections', () => {
    it('returns empty array if userId is empty', async () => {
      const result = await repository.getCollections('');
      expect(result).toEqual([]);
      expect(mockClient.from).not.toHaveBeenCalled();
    });

    it('queries collections ordered by created_at DESC with relational bookmark count', async () => {
      const mockRows = [
        {
          id: 'col-1',
          name: 'Reading List',
          description: 'Articles to read',
          color: '#3B82F6',
          created_at: '2026-11-18T10:00:00.000Z',
          updated_at: '2026-11-18T10:00:00.000Z',
          bookmarks: [{ count: 5 }],
        },
        {
          id: 'col-2',
          name: 'Recipes',
          description: null,
          color: null,
          created_at: '2026-11-17T10:00:00.000Z',
          updated_at: '2026-11-17T10:00:00.000Z',
          bookmarks: [{ count: 0 }],
        },
      ];

      mockQueryBuilder.order.mockResolvedValue({ data: mockRows, error: null });

      const collections = await repository.getCollections(userId);

      expect(mockClient.from).toHaveBeenCalledWith('collections');
      expect(mockQueryBuilder.select).toHaveBeenCalledWith(
        'id, name, description, color, created_at, updated_at, bookmarks(count)'
      );
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('user_id', userId);
      expect(mockQueryBuilder.order).toHaveBeenCalledWith('created_at', { ascending: false });

      expect(collections).toHaveLength(2);
      expect(collections[0]).toEqual({
        id: 'col-1',
        name: 'Reading List',
        description: 'Articles to read',
        color: '#3B82F6',
        count: 5,
        createdAt: '2026-11-18T10:00:00.000Z',
        updatedAt: '2026-11-18T10:00:00.000Z',
      });
      expect(collections[1].count).toBe(0);
      expect(collections[1].description).toBeUndefined();
      expect(collections[1].color).toBeUndefined();
    });

    it('translates network error when fetching collections', async () => {
      mockQueryBuilder.order.mockResolvedValue({
        data: null,
        error: { message: 'Failed to fetch', code: '' },
      });

      await expect(repository.getCollections(userId)).rejects.toThrow(
        'Unable to connect to Shelf cloud. Please check your internet connection.'
      );
    });
  });

  describe('getCollectionById', () => {
    it('returns null if not found or id is missing', async () => {
      expect(await repository.getCollectionById(userId, '')).toBeNull();

      mockQueryBuilder.maybeSingle.mockResolvedValue({ data: null, error: null });
      const result = await repository.getCollectionById(userId, 'non-existent');
      expect(result).toBeNull();
    });

    it('returns mapped collection when found', async () => {
      const mockRow = {
        id: 'col-found',
        name: 'Design Systems',
        description: 'Design tokens and components',
        color: '#10B981',
        created_at: '2026-11-15T00:00:00.000Z',
        updated_at: '2026-11-16T00:00:00.000Z',
        bookmarks: [{ count: 12 }],
      };

      mockQueryBuilder.maybeSingle.mockResolvedValue({ data: mockRow, error: null });

      const col = await repository.getCollectionById(userId, 'col-found');

      expect(col).not.toBeNull();
      expect(col?.id).toBe('col-found');
      expect(col?.name).toBe('Design Systems');
      expect(col?.count).toBe(12);
    });
  });

  describe('createCollection', () => {
    it('validates authentication and non-empty name', async () => {
      await expect(repository.createCollection('', { name: 'Work' })).rejects.toThrow(
        'You must be signed in to create a collection.'
      );

      await expect(repository.createCollection(userId, { name: '' })).rejects.toThrow(
        'Collection name cannot be empty.'
      );

      await expect(repository.createCollection(userId, { name: '   ' })).rejects.toThrow(
        'Collection name cannot be empty.'
      );
    });

    it('creates and returns collection on success', async () => {
      const mockCreated = {
        id: 'col-new-123',
        name: 'Work Projects',
        description: 'Quarterly OKRs',
        color: '#8B5CF6',
        created_at: '2026-11-18T12:00:00.000Z',
        updated_at: '2026-11-18T12:00:00.000Z',
      };

      mockQueryBuilder.single.mockResolvedValue({ data: mockCreated, error: null });

      const created = await repository.createCollection(userId, {
        name: '  Work Projects  ',
        description: 'Quarterly OKRs',
        color: '#8B5CF6',
      });

      expect(mockClient.from).toHaveBeenCalledWith('collections');
      expect(mockQueryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: userId,
          name: 'Work Projects',
          description: 'Quarterly OKRs',
          color: '#8B5CF6',
        })
      );

      expect(created.id).toBe('col-new-123');
      expect(created.name).toBe('Work Projects');
      expect(created.count).toBe(0);
    });

    it('translates 23505 unique error to friendly duplicate message', async () => {
      mockQueryBuilder.single.mockResolvedValue({
        data: null,
        error: {
          code: '23505',
          message: 'duplicate key value violates unique constraint "idx_collections_user_lower_name"',
        },
      });

      await expect(
        repository.createCollection(userId, { name: 'Reading List' })
      ).rejects.toThrow('A collection named "Reading List" already exists.');
    });
  });

  describe('updateCollection', () => {
    it('updates collection and returns updated entity', async () => {
      const mockUpdated = {
        id: 'col-1',
        name: 'Updated Name',
        description: 'New Description',
        color: '#EF4444',
        created_at: '2026-11-01T00:00:00.000Z',
        updated_at: '2026-11-18T13:00:00.000Z',
        bookmarks: [{ count: 3 }],
      };

      mockQueryBuilder.single.mockResolvedValue({ data: mockUpdated, error: null });

      const updated = await repository.updateCollection(userId, 'col-1', {
        name: 'Updated Name',
        description: 'New Description',
        color: '#EF4444',
      });

      expect(mockQueryBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Updated Name',
          description: 'New Description',
          color: '#EF4444',
        })
      );
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('id', 'col-1');
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('user_id', userId);
      expect(updated.name).toBe('Updated Name');
      expect(updated.count).toBe(3);
    });

    it('translates 23505 unique violation on rename', async () => {
      mockQueryBuilder.single.mockResolvedValue({
        data: null,
        error: {
          code: '23505',
          message: 'duplicate key value violates unique constraint "idx_collections_user_lower_name"',
        },
      });

      await expect(
        repository.updateCollection(userId, 'col-1', { name: 'Existing Collection' })
      ).rejects.toThrow('A collection named "Existing Collection" already exists.');
    });
  });

  describe('deleteCollection', () => {
    it('deletes collection scoped to user and collection ID', async () => {
      mockQueryBuilder.then = vi.fn((resolve) => resolve({ data: null, error: null }));

      await repository.deleteCollection(userId, 'col-to-delete');

      expect(mockClient.from).toHaveBeenCalledWith('collections');
      expect(mockQueryBuilder.delete).toHaveBeenCalled();
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('id', 'col-to-delete');
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('user_id', userId);
    });

    it('translates session expiration on delete', async () => {
      mockQueryBuilder.then = vi.fn((resolve) =>
        resolve({
          data: null,
          error: { status: 401, message: 'JWT expired', code: 'PGRST301' },
        })
      );

      await expect(repository.deleteCollection(userId, 'col-1')).rejects.toThrow(
        'Your session has expired. Please sign in again.'
      );
    });
  });
});

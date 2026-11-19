import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SupabaseTagRepository } from '../supabaseTagRepository';

describe('SupabaseTagRepository', () => {
  let mockClient: any;
  let mockQueryBuilder: any;
  let repository: SupabaseTagRepository;

  const userId = 'user_tag_test_456';

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

    repository = new SupabaseTagRepository(mockClient);
  });

  describe('getTags', () => {
    it('returns empty array if userId is empty', async () => {
      const result = await repository.getTags('');
      expect(result).toEqual([]);
      expect(mockClient.from).not.toHaveBeenCalled();
    });

    it('queries tags ordered by created_at DESC', async () => {
      const mockRows = [
        {
          id: 'tag-1',
          name: 'typescript',
          created_at: '2026-11-18T10:00:00.000Z',
          updated_at: '2026-11-18T10:00:00.000Z',
        },
        {
          id: 'tag-2',
          name: 'react',
          created_at: '2026-11-17T10:00:00.000Z',
          updated_at: '2026-11-17T10:00:00.000Z',
        },
      ];

      mockQueryBuilder.order.mockResolvedValue({ data: mockRows, error: null });

      const tags = await repository.getTags(userId);

      expect(mockClient.from).toHaveBeenCalledWith('tags');
      expect(mockQueryBuilder.select).toHaveBeenCalledWith('id, name, created_at, updated_at');
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('user_id', userId);
      expect(mockQueryBuilder.order).toHaveBeenCalledWith('created_at', { ascending: false });

      expect(tags).toHaveLength(2);
      expect(tags[0]).toEqual({
        id: 'tag-1',
        name: 'typescript',
        createdAt: '2026-11-18T10:00:00.000Z',
        updatedAt: '2026-11-18T10:00:00.000Z',
      });
      expect(tags[1].name).toBe('react');
    });

    it('translates network error when fetching tags', async () => {
      mockQueryBuilder.order.mockResolvedValue({
        data: null,
        error: { message: 'Failed to fetch', code: '' },
      });

      await expect(repository.getTags(userId)).rejects.toThrow(
        'Unable to connect to Shelf cloud. Please check your internet connection.'
      );
    });
  });

  describe('getTagById', () => {
    it('returns null if not found or id is missing', async () => {
      expect(await repository.getTagById(userId, '')).toBeNull();

      mockQueryBuilder.maybeSingle.mockResolvedValue({ data: null, error: null });
      const result = await repository.getTagById(userId, 'non-existent');
      expect(result).toBeNull();
    });

    it('returns mapped tag when found', async () => {
      const mockRow = {
        id: 'tag-found',
        name: 'design-tokens',
        created_at: '2026-11-15T00:00:00.000Z',
        updated_at: '2026-11-16T00:00:00.000Z',
      };

      mockQueryBuilder.maybeSingle.mockResolvedValue({ data: mockRow, error: null });

      const tag = await repository.getTagById(userId, 'tag-found');

      expect(tag).not.toBeNull();
      expect(tag?.id).toBe('tag-found');
      expect(tag?.name).toBe('design-tokens');
    });
  });

  describe('createTag', () => {
    it('validates authentication and non-empty name', async () => {
      await expect(repository.createTag('', { name: 'tools' })).rejects.toThrow(
        'You must be signed in to create a tag.'
      );

      await expect(repository.createTag(userId, { name: '' })).rejects.toThrow(
        'Tag name cannot be empty.'
      );

      await expect(repository.createTag(userId, { name: '   ' })).rejects.toThrow(
        'Tag name cannot be empty.'
      );
    });

    it('creates and returns tag on success', async () => {
      const mockCreated = {
        id: 'tag-new-789',
        name: 'architecture',
        created_at: '2026-11-18T12:00:00.000Z',
        updated_at: '2026-11-18T12:00:00.000Z',
      };

      mockQueryBuilder.single.mockResolvedValue({ data: mockCreated, error: null });

      const created = await repository.createTag(userId, { name: '  architecture  ' });

      expect(mockClient.from).toHaveBeenCalledWith('tags');
      expect(mockQueryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: userId,
          name: 'architecture',
        })
      );

      expect(created.id).toBe('tag-new-789');
      expect(created.name).toBe('architecture');
    });

    it('translates 23505 unique violation into friendly duplicate message', async () => {
      mockQueryBuilder.single.mockResolvedValue({
        data: null,
        error: {
          code: '23505',
          message: 'duplicate key value violates unique constraint "idx_tags_user_lower_name"',
        },
      });

      await expect(repository.createTag(userId, { name: 'react' })).rejects.toThrow(
        'A tag named "react" already exists.'
      );
    });
  });

  describe('updateTag', () => {
    it('updates tag and returns updated entity', async () => {
      const mockUpdated = {
        id: 'tag-1',
        name: 'frontend',
        created_at: '2026-11-01T00:00:00.000Z',
        updated_at: '2026-11-18T13:00:00.000Z',
      };

      mockQueryBuilder.single.mockResolvedValue({ data: mockUpdated, error: null });

      const updated = await repository.updateTag(userId, 'tag-1', { name: '  frontend  ' });

      expect(mockQueryBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'frontend' })
      );
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('id', 'tag-1');
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('user_id', userId);
      expect(updated.name).toBe('frontend');
    });

    it('rejects empty tag name on update', async () => {
      await expect(repository.updateTag(userId, 'tag-1', { name: '' })).rejects.toThrow(
        'Tag name cannot be empty.'
      );
    });

    it('translates 23505 unique violation on tag rename', async () => {
      mockQueryBuilder.single.mockResolvedValue({
        data: null,
        error: {
          code: '23505',
          message: 'duplicate key value violates unique constraint "idx_tags_user_lower_name"',
        },
      });

      await expect(repository.updateTag(userId, 'tag-1', { name: 'existing-tag' })).rejects.toThrow(
        'A tag named "existing-tag" already exists.'
      );
    });
  });

  describe('deleteTag', () => {
    it('deletes tag scoped to user and tag ID', async () => {
      mockQueryBuilder.then = vi.fn((resolve) => resolve({ data: null, error: null }));

      await repository.deleteTag(userId, 'tag-to-delete');

      expect(mockClient.from).toHaveBeenCalledWith('tags');
      expect(mockQueryBuilder.delete).toHaveBeenCalled();
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('id', 'tag-to-delete');
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('user_id', userId);
    });

    it('translates session expiration on delete', async () => {
      mockQueryBuilder.then = vi.fn((resolve) =>
        resolve({
          data: null,
          error: { status: 401, message: 'JWT expired', code: 'PGRST301' },
        })
      );

      await expect(repository.deleteTag(userId, 'tag-1')).rejects.toThrow(
        'Your session has expired. Please sign in again.'
      );
    });
  });
});

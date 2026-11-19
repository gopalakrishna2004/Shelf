import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SupabaseBookmarkRepository } from '../supabaseBookmarkRepository';

describe('SupabaseBookmarkRepository', () => {
  let mockClient: any;
  let mockQueryBuilder: any;
  let repository: SupabaseBookmarkRepository;

  const userId = 'user_bm_test_789';

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

    repository = new SupabaseBookmarkRepository(mockClient);
  });

  describe('getBookmarks', () => {
    it('returns empty array if userId is empty', async () => {
      const result = await repository.getBookmarks('');
      expect(result).toEqual([]);
      expect(mockClient.from).not.toHaveBeenCalled();
    });

    it('queries bookmarks with collection and tag joins and maps snake_case to camelCase', async () => {
      const mockRows = [
        {
          id: 'bm-1',
          url: 'https://react.dev',
          title: 'React Documentation',
          domain: 'react.dev',
          description: 'Official React documentation',
          favicon: 'https://react.dev/favicon.ico',
          preview_image: 'https://react.dev/og.png',
          collection_id: 'col-dev',
          is_favourite: true,
          created_at: '2026-11-18T10:00:00.000Z',
          updated_at: '2026-11-18T11:00:00.000Z',
          collections: { name: 'Development' },
          bookmark_tags: [{ tag_id: 'tag-react' }, { tag_id: 'tag-frontend' }],
        },
        {
          id: 'bm-2',
          url: 'https://news.ycombinator.com',
          title: 'Hacker News',
          domain: 'news.ycombinator.com',
          description: null,
          favicon: null,
          preview_image: null,
          collection_id: null,
          is_favourite: false,
          created_at: '2026-11-17T09:00:00.000Z',
          updated_at: null,
          collections: null,
          bookmark_tags: [],
        },
      ];

      mockQueryBuilder.order.mockResolvedValue({ data: mockRows, error: null });

      const bookmarks = await repository.getBookmarks(userId);

      expect(mockClient.from).toHaveBeenCalledWith('bookmarks');
      expect(mockQueryBuilder.select).toHaveBeenCalled();
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('user_id', userId);
      expect(mockQueryBuilder.order).toHaveBeenCalledWith('created_at', { ascending: false });

      expect(bookmarks).toHaveLength(2);

      // Verify bm-1 mapping
      expect(bookmarks[0]).toEqual({
        id: 'bm-1',
        url: 'https://react.dev',
        title: 'React Documentation',
        domain: 'react.dev',
        description: 'Official React documentation',
        favicon: 'https://react.dev/favicon.ico',
        previewImage: 'https://react.dev/og.png',
        collectionId: 'col-dev',
        collectionName: 'Development',
        tags: ['tag-react', 'tag-frontend'],
        isFavourite: true,
        createdAt: '2026-11-18T10:00:00.000Z',
        updatedAt: '2026-11-18T11:00:00.000Z',
      });

      // Verify bm-2 clean fallback mapping
      expect(bookmarks[1].collectionId).toBeUndefined();
      expect(bookmarks[1].collectionName).toBeUndefined();
      expect(bookmarks[1].tags).toBeUndefined();
      expect(bookmarks[1].isFavourite).toBe(false);
      expect(bookmarks[1].previewImage).toBeUndefined();
    });

    it('translates network error when fetching bookmarks', async () => {
      mockQueryBuilder.order.mockResolvedValue({
        data: null,
        error: { message: 'Failed to fetch', code: '' },
      });

      await expect(repository.getBookmarks(userId)).rejects.toThrow(
        'Unable to connect to Shelf cloud. Please check your internet connection.'
      );
    });
  });

  describe('getBookmarkById', () => {
    it('returns null if not found or id is missing', async () => {
      expect(await repository.getBookmarkById(userId, '')).toBeNull();

      mockQueryBuilder.maybeSingle.mockResolvedValue({ data: null, error: null });
      const result = await repository.getBookmarkById(userId, 'missing-id');
      expect(result).toBeNull();
    });

    it('returns mapped bookmark when found', async () => {
      const mockRow = {
        id: 'bm-found',
        url: 'https://vite.dev',
        title: 'Vite',
        domain: 'vite.dev',
        collection_id: 'col-tools',
        is_favourite: false,
        created_at: '2026-11-10T00:00:00.000Z',
        collections: [{ name: 'Build Tools' }],
        bookmark_tags: [{ tag_id: 'tag-bundler' }],
      };

      mockQueryBuilder.maybeSingle.mockResolvedValue({ data: mockRow, error: null });

      const bookmark = await repository.getBookmarkById(userId, 'bm-found');

      expect(bookmark).not.toBeNull();
      expect(bookmark?.id).toBe('bm-found');
      expect(bookmark?.title).toBe('Vite');
      expect(bookmark?.collectionName).toBe('Build Tools');
      expect(bookmark?.tags).toEqual(['tag-bundler']);
    });
  });

  describe('addBookmark', () => {
    it('validates authentication and URL format', async () => {
      await expect(repository.addBookmark('', { url: 'https://example.com' })).rejects.toThrow(
        'You must be signed in to save bookmarks to your shelf.'
      );

      await expect(repository.addBookmark(userId, { url: '' })).rejects.toThrow(
        'Please enter a website URL.'
      );

      await expect(repository.addBookmark(userId, { url: 'not-a-valid-url' })).rejects.toThrow(
        'Please enter a valid website URL'
      );
    });

    it('prevents adding duplicate URLs for the same user', async () => {
      mockQueryBuilder.then = vi.fn((resolve) =>
        resolve({
          data: [{ id: 'bm-existing', url: 'https://github.com' }],
          error: null,
        })
      );

      await expect(
        repository.addBookmark(userId, { url: 'https://github.com/' })
      ).rejects.toThrow('This link is already saved in your shelf.');
    });

    it('calls save_bookmark_with_tags RPC and returns resolved entity on success', async () => {
      // 1. Duplicate check returns empty list
      mockQueryBuilder.then = vi.fn((resolve) => resolve({ data: [], error: null }));

      // 2. RPC call returns resolved bookmark
      const mockRpcResult = {
        id: 'bm-generated-uuid',
        url: 'https://github.com',
        title: 'GitHub',
        domain: 'github.com',
        description: 'Code hosting',
        favicon: 'https://github.com/favicon.ico',
        previewImage: null,
        collectionId: 'col-dev',
        collectionName: 'Development',
        tags: ['git', 'code'],
        isFavourite: true,
        createdAt: '2026-11-18T12:00:00.000Z',
        updatedAt: '2026-11-18T12:00:00.000Z',
      };

      mockClient.rpc.mockResolvedValue({ data: mockRpcResult, error: null });

      const created = await repository.addBookmark(userId, {
        url: 'https://github.com',
        title: 'GitHub',
        description: 'Code hosting',
        collectionId: 'col-dev',
        tags: ['git', 'code', 'git'], // Contains dupe tag
        isFavourite: true,
      });

      expect(mockClient.rpc).toHaveBeenCalledWith('save_bookmark_with_tags', {
        p_bookmark: expect.objectContaining({
          url: 'https://github.com',
          title: 'GitHub',
          domain: 'github.com',
          description: 'Code hosting',
          collectionId: 'col-dev',
          isFavourite: true,
        }),
        p_tag_ids: ['git', 'code'], // Deduplicated
      });

      expect(created.id).toBe('bm-generated-uuid');
      expect(created.collectionName).toBe('Development');
      expect(created.tags).toEqual(['git', 'code']);
      expect(created.isFavourite).toBe(true);
    });

    it('translates cross-account collision from RPC', async () => {
      mockQueryBuilder.then = vi.fn((resolve) => resolve({ data: [], error: null }));

      mockClient.rpc.mockResolvedValue({
        data: null,
        error: {
          message: 'ERR_CROSS_ACCOUNT_COLLISION: Bookmark ID belongs to another user',
        },
      });

      await expect(
        repository.addBookmark(userId, { url: 'https://collision.com' })
      ).rejects.toThrow('Bookmark ID belongs to another user or could not be updated.');
    });
  });

  describe('updateBookmark', () => {
    it('throws if bookmark does not exist', async () => {
      mockQueryBuilder.maybeSingle.mockResolvedValue({ data: null, error: null });

      await expect(
        repository.updateBookmark(userId, 'non-existent', { title: 'New Title' })
      ).rejects.toThrow('Bookmark not found.');
    });

    it('updates bookmark properties and tags via save_bookmark_with_tags RPC', async () => {
      const existingBookmark = {
        id: 'bm-1',
        url: 'https://svelte.dev',
        title: 'Svelte',
        domain: 'svelte.dev',
        collection_id: null,
        is_favourite: false,
        created_at: '2026-11-01T00:00:00.000Z',
        collections: null,
        bookmark_tags: [{ tag_id: 'tag-old' }],
      };

      // getBookmarkById lookup
      mockQueryBuilder.maybeSingle.mockResolvedValue({ data: existingBookmark, error: null });

      // RPC mock result
      const updatedRpcResult = {
        id: 'bm-1',
        url: 'https://svelte.dev',
        title: 'Svelte Framework',
        domain: 'svelte.dev',
        collectionId: 'col-fe',
        collectionName: 'Frontend',
        tags: ['tag-new-1', 'tag-new-2'],
        isFavourite: true,
        createdAt: '2026-11-01T00:00:00.000Z',
        updatedAt: '2026-11-18T14:00:00.000Z',
      };

      mockClient.rpc.mockResolvedValue({ data: updatedRpcResult, error: null });

      const result = await repository.updateBookmark(userId, 'bm-1', {
        title: 'Svelte Framework',
        collectionId: 'col-fe',
        tags: ['tag-new-1', 'tag-new-2'],
        isFavourite: true,
      });

      expect(mockClient.rpc).toHaveBeenCalledWith('save_bookmark_with_tags', {
        p_bookmark: expect.objectContaining({
          id: 'bm-1',
          url: 'https://svelte.dev',
          title: 'Svelte Framework',
          collectionId: 'col-fe',
          isFavourite: true,
        }),
        p_tag_ids: ['tag-new-1', 'tag-new-2'],
      });

      expect(result.title).toBe('Svelte Framework');
      expect(result.collectionName).toBe('Frontend');
      expect(result.tags).toEqual(['tag-new-1', 'tag-new-2']);
      expect(result.isFavourite).toBe(true);
    });

    it('detects duplicate URL when changing URL to an existing one', async () => {
      const existingBookmark = {
        id: 'bm-1',
        url: 'https://original.com',
        title: 'Original',
        domain: 'original.com',
        created_at: '2026-11-01T00:00:00.000Z',
      };

      mockQueryBuilder.maybeSingle.mockResolvedValue({ data: existingBookmark, error: null });

      // Check duplicate query returns another bookmark with the target URL
      mockQueryBuilder.then = vi.fn((resolve) =>
        resolve({
          data: [{ id: 'bm-other', url: 'https://target.com' }],
          error: null,
        })
      );

      await expect(
        repository.updateBookmark(userId, 'bm-1', { url: 'https://target.com' })
      ).rejects.toThrow('This link is already saved in your shelf.');
    });
  });

  describe('deleteBookmark', () => {
    it('deletes bookmark scoped to user and id', async () => {
      mockQueryBuilder.then = vi.fn((resolve) => resolve({ data: null, error: null }));

      await repository.deleteBookmark(userId, 'bm-to-delete');

      expect(mockClient.from).toHaveBeenCalledWith('bookmarks');
      expect(mockQueryBuilder.delete).toHaveBeenCalled();
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('id', 'bm-to-delete');
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('user_id', userId);
    });
  });

  describe('toggleFavourite', () => {
    it('inverts favourite state and calls updateBookmark', async () => {
      const existingBookmark = {
        id: 'bm-fav',
        url: 'https://favourite.com',
        title: 'Favourite Site',
        domain: 'favourite.com',
        is_favourite: false,
        created_at: '2026-11-01T00:00:00.000Z',
        collections: null,
        bookmark_tags: [],
      };

      mockQueryBuilder.maybeSingle.mockResolvedValue({ data: existingBookmark, error: null });

      const updatedRpc = {
        id: 'bm-fav',
        url: 'https://favourite.com',
        title: 'Favourite Site',
        domain: 'favourite.com',
        isFavourite: true,
        createdAt: '2026-11-01T00:00:00.000Z',
        updatedAt: '2026-11-18T15:00:00.000Z',
      };

      mockClient.rpc.mockResolvedValue({ data: updatedRpc, error: null });

      const toggled = await repository.toggleFavourite(userId, 'bm-fav');

      expect(mockClient.rpc).toHaveBeenCalledWith(
        'save_bookmark_with_tags',
        expect.objectContaining({
          p_bookmark: expect.objectContaining({ isFavourite: true }),
        })
      );
      expect(toggled.isFavourite).toBe(true);
    });
  });

  describe('relational collection and tag management', () => {
    it('updateBookmarksCollectionName is a no-op as joins resolve dynamically', async () => {
      await expect(
        repository.updateBookmarksCollectionName(userId, 'col-1', 'Renamed')
      ).resolves.toBeUndefined();
      expect(mockClient.from).not.toHaveBeenCalled();
    });

    it('removeBookmarksFromCollection unassigns collection from bookmarks', async () => {
      mockQueryBuilder.then = vi.fn((resolve) => resolve({ data: null, error: null }));

      await repository.removeBookmarksFromCollection(userId, 'col-to-unassign');

      expect(mockClient.from).toHaveBeenCalledWith('bookmarks');
      expect(mockQueryBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({ collection_id: null })
      );
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('collection_id', 'col-to-unassign');
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('user_id', userId);
    });

    it('removeTagFromBookmarks deletes join entries from bookmark_tags', async () => {
      mockQueryBuilder.then = vi.fn((resolve) => resolve({ data: null, error: null }));

      await repository.removeTagFromBookmarks(userId, 'tag-to-remove');

      expect(mockClient.from).toHaveBeenCalledWith('bookmark_tags');
      expect(mockQueryBuilder.delete).toHaveBeenCalled();
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('tag_id', 'tag-to-remove');
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('user_id', userId);
    });
  });
});

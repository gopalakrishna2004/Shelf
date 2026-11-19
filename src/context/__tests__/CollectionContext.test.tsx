import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CollectionProvider, useCollections, type CollectionContextType } from '../CollectionContext';
import { BookmarkProvider, useBookmarks, type BookmarkContextType } from '../BookmarkContext';
import { collectionRepository } from '../../services/collectionService';
import { bookmarkRepository } from '../../services/bookmarkService';
import type { Collection, Bookmark } from '../../types';

let mockCurrentUser: { id: string } | null = { id: 'user_col_1' };
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: mockCurrentUser }),
}));

describe('CollectionContext Loading, Error States, Cascades & Rename Suite', () => {
  let container: HTMLDivElement;
  let root: Root;
  let collectionContext: CollectionContextType;
  let bookmarkContext: BookmarkContextType;

  const Consumer: React.FC = () => {
    collectionContext = useCollections();
    bookmarkContext = useBookmarks();
    return null;
  };

  const sampleCollection: Collection = {
    id: 'col_1',
    name: 'Work',
    description: 'Work links',
    color: '#3B82F6',
    createdAt: '2026-11-19T00:00:00.000Z',
  };

  const sampleCollection2: Collection = {
    id: 'col_2',
    name: 'Personal',
    createdAt: '2026-11-19T01:00:00.000Z',
  };

  const sampleBookmark: Bookmark = {
    id: 'bm_1',
    url: 'https://work.com',
    title: 'Work Portal',
    domain: 'work.com',
    collectionId: 'col_1',
    collectionName: 'Work',
    isFavourite: false,
    createdAt: '2026-11-19T00:00:00.000Z',
  };

  const sampleUnrelatedBookmark: Bookmark = {
    id: 'bm_2',
    url: 'https://other.com',
    title: 'Other Site',
    domain: 'other.com',
    collectionId: 'col_2',
    collectionName: 'Personal',
    isFavourite: false,
    createdAt: '2026-11-19T00:00:00.000Z',
  };

  beforeEach(() => {
    mockCurrentUser = { id: 'user_col_1' };
    vi.clearAllMocks();
    container = document.createElement('div');
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
  });

  const renderContexts = async () => {
    await act(async () => {
      root.render(
        <BookmarkProvider>
          <CollectionProvider>
            <Consumer />
          </CollectionProvider>
        </BookmarkProvider>
      );
    });
  };

  it('1. successful initial load with data', async () => {
    vi.spyOn(collectionRepository, 'getCollections').mockResolvedValueOnce([sampleCollection, sampleCollection2]);
    vi.spyOn(bookmarkRepository, 'getBookmarks').mockResolvedValueOnce([]);

    await renderContexts();

    expect(collectionContext.isLoading).toBe(false);
    expect(collectionContext.loadError).toBeNull();
    expect(collectionContext.collections).toHaveLength(2);
    expect(collectionContext.collections[0].id).toBe('col_1');
    expect(collectionContext.collections[1].id).toBe('col_2');
  });

  it('2. successful initial load with genuinely empty data', async () => {
    vi.spyOn(collectionRepository, 'getCollections').mockResolvedValueOnce([]);
    vi.spyOn(bookmarkRepository, 'getBookmarks').mockResolvedValueOnce([]);

    await renderContexts();

    expect(collectionContext.isLoading).toBe(false);
    expect(collectionContext.loadError).toBeNull();
    expect(collectionContext.collections).toEqual([]);
  });

  it('3. initial load failure does not masquerade as successful empty data', async () => {
    vi.spyOn(collectionRepository, 'getCollections').mockRejectedValueOnce(new Error('Network offline'));
    vi.spyOn(bookmarkRepository, 'getBookmarks').mockResolvedValueOnce([]);

    await renderContexts();

    expect(collectionContext.isLoading).toBe(false);
    expect(collectionContext.loadError).not.toBeNull();
    expect(collectionContext.loadError?.message).toBe('Network offline');
  });

  it('4. retry after failure succeeds and clears the error', async () => {
    vi.spyOn(collectionRepository, 'getCollections')
      .mockRejectedValueOnce(new Error('Server error'))
      .mockResolvedValueOnce([sampleCollection]);
    vi.spyOn(bookmarkRepository, 'getBookmarks').mockResolvedValue([]);

    await renderContexts();

    expect(collectionContext.loadError).not.toBeNull();

    let retryResult: { success: boolean; error: Error | null } | undefined;
    await act(async () => {
      retryResult = await collectionContext.retryLoad();
    });

    expect(retryResult?.success).toBe(true);
    expect(retryResult?.error).toBeNull();
    expect(collectionContext.isLoading).toBe(false);
    expect(collectionContext.loadError).toBeNull();
    expect(collectionContext.collections).toEqual([sampleCollection]);
  });

  it('5. retry failure remains an error', async () => {
    vi.spyOn(collectionRepository, 'getCollections')
      .mockRejectedValueOnce(new Error('Failure 1'))
      .mockRejectedValueOnce(new Error('Failure 2'));
    vi.spyOn(bookmarkRepository, 'getBookmarks').mockResolvedValue([]);

    await renderContexts();

    let retryResult: { success: boolean; error: Error | null } | undefined;
    await act(async () => {
      retryResult = await collectionContext.retryLoad();
    });

    expect(retryResult?.success).toBe(false);
    expect(retryResult?.error?.message).toBe('Failure 2');
    expect(collectionContext.loadError?.message).toBe('Failure 2');
  });

  it('6. previous error clears when a retry starts', async () => {
    let resolveSecondAttempt: (value: Collection[]) => void;
    const secondPromise = new Promise<Collection[]>((resolve) => {
      resolveSecondAttempt = resolve;
    });

    vi.spyOn(collectionRepository, 'getCollections')
      .mockRejectedValueOnce(new Error('Initial failure'))
      .mockImplementationOnce(() => secondPromise);
    vi.spyOn(bookmarkRepository, 'getBookmarks').mockResolvedValue([]);

    await renderContexts();

    let retryPromise: Promise<{ success: boolean; error: Error | null }>;
    act(() => {
      retryPromise = collectionContext.retryLoad();
    });

    expect(collectionContext.loadError).toBeNull();
    expect(collectionContext.isLoading).toBe(true);

    await act(async () => {
      resolveSecondAttempt!([sampleCollection]);
      await retryPromise;
    });

    expect(collectionContext.isLoading).toBe(false);
    expect(collectionContext.loadError).toBeNull();
    expect(collectionContext.collections).toEqual([sampleCollection]);
  });

  it('7. user switching clears previous user data', async () => {
    vi.spyOn(collectionRepository, 'getCollections').mockResolvedValueOnce([sampleCollection]);
    vi.spyOn(bookmarkRepository, 'getBookmarks').mockResolvedValue([]);

    await renderContexts();
    expect(collectionContext.collections).toEqual([sampleCollection]);

    // Switch user
    mockCurrentUser = { id: 'user_col_2' };
    let resolveUser2: (data: Collection[]) => void;
    vi.spyOn(collectionRepository, 'getCollections').mockImplementationOnce(
      () => new Promise((resolve) => { resolveUser2 = resolve; })
    );

    act(() => {
      root.render(
        <BookmarkProvider>
          <CollectionProvider>
            <Consumer />
          </CollectionProvider>
        </BookmarkProvider>
      );
    });

    expect(collectionContext.collections).toEqual([]);
    expect(collectionContext.isLoading).toBe(true);

    await act(async () => {
      resolveUser2!([sampleCollection2]);
    });

    expect(collectionContext.collections).toEqual([sampleCollection2]);
  });

  it('8. a late response from the previous user cannot overwrite the new user state', async () => {
    let resolveUser1: (data: Collection[]) => void;
    const user1Promise = new Promise<Collection[]>((resolve) => {
      resolveUser1 = resolve;
    });

    let resolveUser2: (data: Collection[]) => void;
    const user2Promise = new Promise<Collection[]>((resolve) => {
      resolveUser2 = resolve;
    });

    vi.spyOn(collectionRepository, 'getCollections')
      .mockImplementationOnce(() => user1Promise)
      .mockImplementationOnce(() => user2Promise);
    vi.spyOn(bookmarkRepository, 'getBookmarks').mockResolvedValue([]);

    await act(async () => {
      root.render(
        <BookmarkProvider>
          <CollectionProvider>
            <Consumer />
          </CollectionProvider>
        </BookmarkProvider>
      );
    });

    mockCurrentUser = { id: 'user_col_2' };
    await act(async () => {
      root.render(
        <BookmarkProvider>
          <CollectionProvider>
            <Consumer />
          </CollectionProvider>
        </BookmarkProvider>
      );
    });

    await act(async () => {
      resolveUser2!([sampleCollection2]);
    });
    expect(collectionContext.collections).toEqual([sampleCollection2]);

    await act(async () => {
      resolveUser1!([sampleCollection]);
    });
    expect(collectionContext.collections).toEqual([sampleCollection2]);
  });

  it('9. a late response from an older request cannot overwrite a newer request', async () => {
    let resolveReq1: (data: Collection[]) => void;
    const req1Promise = new Promise<Collection[]>((resolve) => {
      resolveReq1 = resolve;
    });

    let resolveReq2: (data: Collection[]) => void;
    const req2Promise = new Promise<Collection[]>((resolve) => {
      resolveReq2 = resolve;
    });

    vi.spyOn(collectionRepository, 'getCollections')
      .mockImplementationOnce(() => req1Promise)
      .mockImplementationOnce(() => req2Promise);
    vi.spyOn(bookmarkRepository, 'getBookmarks').mockResolvedValue([]);

    await act(async () => {
      root.render(
        <BookmarkProvider>
          <CollectionProvider>
            <Consumer />
          </CollectionProvider>
        </BookmarkProvider>
      );
    });

    act(() => {
      collectionContext.retryLoad();
    });

    await act(async () => {
      resolveReq2!([sampleCollection2]);
    });
    expect(collectionContext.collections).toEqual([sampleCollection2]);

    await act(async () => {
      resolveReq1!([sampleCollection]);
    });
    expect(collectionContext.collections).toEqual([sampleCollection2]);
  });

  it('10. repeated retry calls do not corrupt state or create duplicate updates', async () => {
    vi.spyOn(collectionRepository, 'getCollections').mockResolvedValue([sampleCollection]);
    vi.spyOn(bookmarkRepository, 'getBookmarks').mockResolvedValue([]);

    await renderContexts();

    await act(async () => {
      await Promise.all([
        collectionContext.retryLoad(),
        collectionContext.retryLoad(),
        collectionContext.retryLoad(),
      ]);
    });

    expect(collectionContext.collections).toEqual([sampleCollection]);
    expect(collectionContext.isLoading).toBe(false);
    expect(collectionContext.loadError).toBeNull();
  });

  it('11. collection deletion performs exactly one persistence deletion and clears loaded bookmark association', async () => {
    vi.spyOn(collectionRepository, 'getCollections').mockResolvedValueOnce([sampleCollection, sampleCollection2]);
    vi.spyOn(bookmarkRepository, 'getBookmarks').mockResolvedValueOnce([sampleBookmark, sampleUnrelatedBookmark]);
    const deleteCollectionSpy = vi.spyOn(collectionRepository, 'deleteCollection').mockResolvedValueOnce(undefined);
    const removeBookmarksFromCollectionSpy = vi.spyOn(bookmarkRepository, 'removeBookmarksFromCollection');

    await renderContexts();

    expect(collectionContext.collections).toHaveLength(2);
    expect(bookmarkContext.bookmarks[0].collectionId).toBe('col_1');
    expect(bookmarkContext.bookmarks[0].collectionName).toBe('Work');

    let deleteResult: { success: boolean; error: Error | null } | undefined;
    await act(async () => {
      deleteResult = await collectionContext.deleteCollection('col_1');
    });

    expect(deleteResult?.success).toBe(true);
    // Exactly one persistence call was performed
    expect(deleteCollectionSpy).toHaveBeenCalledTimes(1);
    expect(deleteCollectionSpy).toHaveBeenCalledWith('user_col_1', 'col_1');
    // Bookmark repository disassociation method was NOT called (no redundant persistence call)
    expect(removeBookmarksFromCollectionSpy).not.toHaveBeenCalled();

    // Collection removed from in-memory collection state
    expect(collectionContext.collections).toHaveLength(1);
    expect(collectionContext.collections[0].id).toBe('col_2');

    // Loaded bookmark had collection association cleared in memory
    expect(bookmarkContext.bookmarks[0].collectionId).toBeUndefined();
    expect(bookmarkContext.bookmarks[0].collectionName).toBeUndefined();

    // Unrelated bookmark remains intact
    expect(bookmarkContext.bookmarks[1].collectionId).toBe('col_2');
    expect(bookmarkContext.bookmarks[1].collectionName).toBe('Personal');
  });

  it('12. failed collection deletion leaves bookmark associations and collection state unchanged', async () => {
    vi.spyOn(collectionRepository, 'getCollections').mockResolvedValueOnce([sampleCollection]);
    vi.spyOn(bookmarkRepository, 'getBookmarks').mockResolvedValueOnce([sampleBookmark]);
    vi.spyOn(collectionRepository, 'deleteCollection').mockRejectedValueOnce(new Error('Failed to delete on server'));
    const removeBookmarksFromCollectionSpy = vi.spyOn(bookmarkRepository, 'removeBookmarksFromCollection');

    await renderContexts();

    let deleteResult: { success: boolean; error: Error | null } | undefined;
    await act(async () => {
      deleteResult = await collectionContext.deleteCollection('col_1');
    });

    expect(deleteResult?.success).toBe(false);
    expect(deleteResult?.error?.message).toBe('Failed to delete on server');

    // In-memory collection remains present
    expect(collectionContext.collections).toHaveLength(1);
    expect(collectionContext.collections[0].id).toBe('col_1');

    // Bookmark associations in memory remain untouched
    expect(bookmarkContext.bookmarks[0].collectionId).toBe('col_1');
    expect(bookmarkContext.bookmarks[0].collectionName).toBe('Work');
    expect(removeBookmarksFromCollectionSpy).not.toHaveBeenCalled();
  });

  it('13. successful collection rename updates loaded bookmark collection-name snapshots immediately without separate repository call', async () => {
    vi.spyOn(collectionRepository, 'getCollections').mockResolvedValueOnce([sampleCollection, sampleCollection2]);
    vi.spyOn(bookmarkRepository, 'getBookmarks').mockResolvedValueOnce([sampleBookmark, sampleUnrelatedBookmark]);
    const updateCollectionSpy = vi.spyOn(collectionRepository, 'updateCollection').mockResolvedValueOnce({
      ...sampleCollection,
      name: 'Work & Ops',
      updatedAt: '2026-11-19T02:00:00.000Z',
    });
    const updateBookmarksCollectionNameSpy = vi.spyOn(bookmarkRepository, 'updateBookmarksCollectionName');

    await renderContexts();

    let updateResult: { collection: Collection | null; error: Error | null } | undefined;
    await act(async () => {
      updateResult = await collectionContext.updateCollection('col_1', { name: 'Work & Ops' });
    });

    expect(updateResult?.collection?.name).toBe('Work & Ops');
    expect(updateCollectionSpy).toHaveBeenCalledTimes(1);
    // Bookmark repository snapshot method was NOT called (no redundant persistence call)
    expect(updateBookmarksCollectionNameSpy).not.toHaveBeenCalled();

    // CollectionContext updated immediately
    expect(collectionContext.collections[0].name).toBe('Work & Ops');

    // BookmarkContext updated snapshot immediately
    expect(bookmarkContext.bookmarks[0].collectionName).toBe('Work & Ops');
    expect(bookmarkContext.bookmarks[0].collectionId).toBe('col_1');

    // Unrelated bookmark remains unchanged
    expect(bookmarkContext.bookmarks[1].collectionName).toBe('Personal');
    expect(bookmarkContext.bookmarks[1].collectionId).toBe('col_2');
  });

  it('14. failed collection rename does not change loaded bookmark snapshots', async () => {
    vi.spyOn(collectionRepository, 'getCollections').mockResolvedValueOnce([sampleCollection]);
    vi.spyOn(bookmarkRepository, 'getBookmarks').mockResolvedValueOnce([sampleBookmark]);
    vi.spyOn(collectionRepository, 'updateCollection').mockRejectedValueOnce(new Error('Rename collision error'));

    await renderContexts();

    let updateResult: { collection: Collection | null; error: Error | null } | undefined;
    await act(async () => {
      updateResult = await collectionContext.updateCollection('col_1', { name: 'Duplicate Name' });
    });

    expect(updateResult?.error?.message).toBe('Rename collision error');

    // Collection name unchanged
    expect(collectionContext.collections[0].name).toBe('Work');
    // Bookmark snapshot unchanged
    expect(bookmarkContext.bookmarks[0].collectionName).toBe('Work');
  });
});

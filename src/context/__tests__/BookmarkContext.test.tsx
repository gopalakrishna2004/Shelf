import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BookmarkProvider, useBookmarks, type BookmarkContextType } from '../BookmarkContext';
import { bookmarkRepository } from '../../services/bookmarkService';
import type { Bookmark } from '../../types';

// Mock useAuth
let mockCurrentUser: { id: string } | null = { id: 'user_test_1' };
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: mockCurrentUser }),
}));

describe('BookmarkContext Loading, Error States & Stale Request Suite', () => {
  let container: HTMLDivElement;
  let root: Root;
  let contextValue: BookmarkContextType;

  const Consumer: React.FC = () => {
    contextValue = useBookmarks();
    return null;
  };

  const sampleBookmark: Bookmark = {
    id: 'bm_1',
    url: 'https://example.com/one',
    title: 'Example One',
    domain: 'example.com',
    collectionId: 'col_1',
    collectionName: 'Dev',
    tags: ['tag_1', 'tag_2'],
    isFavourite: false,
    createdAt: '2026-11-19T00:00:00.000Z',
  };

  const sampleBookmark2: Bookmark = {
    id: 'bm_2',
    url: 'https://example.com/two',
    title: 'Example Two',
    domain: 'example.com',
    collectionId: 'col_2',
    collectionName: 'Articles',
    tags: ['tag_2'],
    isFavourite: true,
    createdAt: '2026-11-19T01:00:00.000Z',
  };

  beforeEach(() => {
    mockCurrentUser = { id: 'user_test_1' };
    vi.clearAllMocks();
    container = document.createElement('div');
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
  });

  const renderContext = async () => {
    await act(async () => {
      root.render(
        <BookmarkProvider>
          <Consumer />
        </BookmarkProvider>
      );
    });
  };

  it('1. successful initial load with data', async () => {
    vi.spyOn(bookmarkRepository, 'getBookmarks').mockResolvedValueOnce([sampleBookmark, sampleBookmark2]);

    await renderContext();

    expect(contextValue.isLoading).toBe(false);
    expect(contextValue.loadError).toBeNull();
    expect(contextValue.bookmarks).toHaveLength(2);
    expect(contextValue.bookmarks[0].id).toBe('bm_1');
    expect(contextValue.bookmarks[1].id).toBe('bm_2');
  });

  it('2. successful initial load with genuinely empty data', async () => {
    vi.spyOn(bookmarkRepository, 'getBookmarks').mockResolvedValueOnce([]);

    await renderContext();

    expect(contextValue.isLoading).toBe(false);
    expect(contextValue.loadError).toBeNull();
    expect(contextValue.bookmarks).toEqual([]);
  });

  it('3. initial load failure does not masquerade as successful empty data', async () => {
    const networkError = new TypeError('Failed to fetch');
    vi.spyOn(bookmarkRepository, 'getBookmarks').mockRejectedValueOnce(networkError);

    await renderContext();

    expect(contextValue.isLoading).toBe(false);
    expect(contextValue.loadError).not.toBeNull();
    expect(contextValue.loadError?.message).toContain('Unable to connect to Shelf cloud');
    // Error state is distinct from a successful empty result
    expect(contextValue.loadError).toBeInstanceOf(Error);
  });

  it('4. retry after failure succeeds and clears the error', async () => {
    vi.spyOn(bookmarkRepository, 'getBookmarks')
      .mockRejectedValueOnce(new Error('Cloud server unavailable'))
      .mockResolvedValueOnce([sampleBookmark]);

    await renderContext();

    expect(contextValue.isLoading).toBe(false);
    expect(contextValue.loadError).not.toBeNull();
    expect(contextValue.bookmarks).toEqual([]);

    let retryResult: { success: boolean; error: Error | null } | undefined;
    await act(async () => {
      retryResult = await contextValue.retryLoad();
    });

    expect(retryResult?.success).toBe(true);
    expect(retryResult?.error).toBeNull();
    expect(contextValue.isLoading).toBe(false);
    expect(contextValue.loadError).toBeNull();
    expect(contextValue.bookmarks).toEqual([sampleBookmark]);
  });

  it('5. retry failure remains an error', async () => {
    vi.spyOn(bookmarkRepository, 'getBookmarks')
      .mockRejectedValueOnce(new Error('First failure'))
      .mockRejectedValueOnce(new Error('Second failure'));

    await renderContext();

    expect(contextValue.loadError).not.toBeNull();
    expect(contextValue.loadError?.message).toBe('First failure');

    let retryResult: { success: boolean; error: Error | null } | undefined;
    await act(async () => {
      retryResult = await contextValue.retryLoad();
    });

    expect(retryResult?.success).toBe(false);
    expect(retryResult?.error?.message).toBe('Second failure');
    expect(contextValue.isLoading).toBe(false);
    expect(contextValue.loadError?.message).toBe('Second failure');
  });

  it('6. previous error clears when a retry starts', async () => {
    let resolveSecondAttempt: (value: Bookmark[]) => void;
    const secondPromise = new Promise<Bookmark[]>((resolve) => {
      resolveSecondAttempt = resolve;
    });

    vi.spyOn(bookmarkRepository, 'getBookmarks')
      .mockRejectedValueOnce(new Error('Initial failure'))
      .mockImplementationOnce(() => secondPromise);

    await renderContext();

    expect(contextValue.loadError).not.toBeNull();

    // Start retry without resolving yet
    let retryPromise: Promise<{ success: boolean; error: Error | null }>;
    act(() => {
      retryPromise = contextValue.retryLoad();
    });

    // Error is immediately cleared and isLoading is true while in-flight
    expect(contextValue.loadError).toBeNull();
    expect(contextValue.isLoading).toBe(true);

    // Resolve second attempt
    await act(async () => {
      resolveSecondAttempt!([sampleBookmark]);
      await retryPromise;
    });

    expect(contextValue.isLoading).toBe(false);
    expect(contextValue.loadError).toBeNull();
    expect(contextValue.bookmarks).toEqual([sampleBookmark]);
  });

  it('7. user switching clears previous user data immediately', async () => {
    vi.spyOn(bookmarkRepository, 'getBookmarks').mockResolvedValueOnce([sampleBookmark]);

    await renderContext();
    expect(contextValue.bookmarks).toEqual([sampleBookmark]);

    // Switch user to user_test_2
    mockCurrentUser = { id: 'user_test_2' };
    let resolveUser2: (data: Bookmark[]) => void;
    vi.spyOn(bookmarkRepository, 'getBookmarks').mockImplementationOnce(
      () => new Promise((resolve) => { resolveUser2 = resolve; })
    );

    act(() => {
      root.render(
        <BookmarkProvider>
          <Consumer />
        </BookmarkProvider>
      );
    });

    // Previous user data must be immediately cleared
    expect(contextValue.bookmarks).toEqual([]);
    expect(contextValue.isLoading).toBe(true);
    expect(contextValue.loadError).toBeNull();

    await act(async () => {
      resolveUser2!([sampleBookmark2]);
    });

    expect(contextValue.isLoading).toBe(false);
    expect(contextValue.bookmarks).toEqual([sampleBookmark2]);
  });

  it('8. a late response from the previous user cannot overwrite the new user state', async () => {
    let resolveUser1: (data: Bookmark[]) => void;
    const user1Promise = new Promise<Bookmark[]>((resolve) => {
      resolveUser1 = resolve;
    });

    let resolveUser2: (data: Bookmark[]) => void;
    const user2Promise = new Promise<Bookmark[]>((resolve) => {
      resolveUser2 = resolve;
    });

    vi.spyOn(bookmarkRepository, 'getBookmarks')
      .mockImplementationOnce(() => user1Promise)
      .mockImplementationOnce(() => user2Promise);

    // Start loading for user_test_1
    await act(async () => {
      root.render(
        <BookmarkProvider>
          <Consumer />
        </BookmarkProvider>
      );
    });
    expect(contextValue.isLoading).toBe(true);

    // User switches to user_test_2 while user 1 is in-flight
    mockCurrentUser = { id: 'user_test_2' };
    await act(async () => {
      root.render(
        <BookmarkProvider>
          <Consumer />
        </BookmarkProvider>
      );
    });

    // User 2 resolves first
    await act(async () => {
      resolveUser2!([sampleBookmark2]);
    });
    expect(contextValue.bookmarks).toEqual([sampleBookmark2]);

    // Now User 1 resolves late
    await act(async () => {
      resolveUser1!([sampleBookmark]);
    });

    // State must still strictly belong to User 2
    expect(contextValue.bookmarks).toEqual([sampleBookmark2]);
  });

  it('9. a late response from an older request cannot overwrite a newer request', async () => {
    let resolveRequest1: (data: Bookmark[]) => void;
    const req1Promise = new Promise<Bookmark[]>((resolve) => {
      resolveRequest1 = resolve;
    });

    let resolveRequest2: (data: Bookmark[]) => void;
    const req2Promise = new Promise<Bookmark[]>((resolve) => {
      resolveRequest2 = resolve;
    });

    vi.spyOn(bookmarkRepository, 'getBookmarks')
      .mockImplementationOnce(() => req1Promise)
      .mockImplementationOnce(() => req2Promise);

    // Initial load starts
    await act(async () => {
      root.render(
        <BookmarkProvider>
          <Consumer />
        </BookmarkProvider>
      );
    });
    expect(contextValue.isLoading).toBe(true);

    // Newer retry request starts while older is still pending
    act(() => {
      contextValue.retryLoad();
    });

    // Request 2 finishes first with sampleBookmark2
    await act(async () => {
      resolveRequest2!([sampleBookmark2]);
    });
    expect(contextValue.bookmarks).toEqual([sampleBookmark2]);

    // Request 1 finishes late with sampleBookmark
    await act(async () => {
      resolveRequest1!([sampleBookmark]);
    });

    // Context must NOT be overwritten by the stale older request
    expect(contextValue.bookmarks).toEqual([sampleBookmark2]);
  });

  it('10. repeated retry calls do not corrupt state or create duplicate updates', async () => {
    vi.spyOn(bookmarkRepository, 'getBookmarks').mockResolvedValue([sampleBookmark]);

    await renderContext();

    // Call retry multiple times concurrently
    let results: Array<{ success: boolean; error: Error | null }> = [];
    await act(async () => {
      results = await Promise.all([
        contextValue.retryLoad(),
        contextValue.retryLoad(),
        contextValue.retryLoad(),
      ]);
    });

    expect(results).toHaveLength(3);
    expect(contextValue.bookmarks).toEqual([sampleBookmark]);
    expect(contextValue.isLoading).toBe(false);
    expect(contextValue.loadError).toBeNull();
  });

  it('11. in-memory collection rename updates collectionName snapshot without calling repository', async () => {
    vi.spyOn(bookmarkRepository, 'getBookmarks').mockResolvedValueOnce([sampleBookmark, sampleBookmark2]);
    const updateBookmarksCollectionNameSpy = vi.spyOn(bookmarkRepository, 'updateBookmarksCollectionName');

    await renderContext();
    expect(contextValue.bookmarks[0].collectionName).toBe('Dev');

    // Rename collection in memory
    act(() => {
      contextValue.updateBookmarksCollectionName('col_1', 'Engineering');
    });

    expect(contextValue.bookmarks[0].collectionName).toBe('Engineering');
    // Unrelated bookmark is unaffected
    expect(contextValue.bookmarks[1].collectionName).toBe('Articles');
    // Repository method was NOT called
    expect(updateBookmarksCollectionNameSpy).not.toHaveBeenCalled();
  });

  it('12. in-memory collection deletion clears collectionId and collectionName without calling repository', async () => {
    vi.spyOn(bookmarkRepository, 'getBookmarks').mockResolvedValueOnce([sampleBookmark, sampleBookmark2]);
    const removeBookmarksFromCollectionSpy = vi.spyOn(bookmarkRepository, 'removeBookmarksFromCollection');

    await renderContext();
    expect(contextValue.bookmarks[0].collectionId).toBe('col_1');

    act(() => {
      contextValue.removeBookmarksFromCollection('col_1');
    });

    expect(contextValue.bookmarks[0].collectionId).toBeUndefined();
    expect(contextValue.bookmarks[0].collectionName).toBeUndefined();
    // Unrelated bookmark is unaffected
    expect(contextValue.bookmarks[1].collectionId).toBe('col_2');
    expect(removeBookmarksFromCollectionSpy).not.toHaveBeenCalled();
  });

  it('13. in-memory tag deletion strips tag ID from bookmarks without calling repository', async () => {
    vi.spyOn(bookmarkRepository, 'getBookmarks').mockResolvedValueOnce([sampleBookmark, sampleBookmark2]);
    const removeTagFromBookmarksSpy = vi.spyOn(bookmarkRepository, 'removeTagFromBookmarks');

    await renderContext();
    expect(contextValue.bookmarks[0].tags).toEqual(['tag_1', 'tag_2']);
    expect(contextValue.bookmarks[1].tags).toEqual(['tag_2']);

    act(() => {
      contextValue.removeTagFromBookmarks('tag_1');
    });

    // tag_1 removed from bm_1, leaving tag_2
    expect(contextValue.bookmarks[0].tags).toEqual(['tag_2']);
    // bm_2 did not have tag_1
    expect(contextValue.bookmarks[1].tags).toEqual(['tag_2']);

    // Now remove tag_2 (which was the only tag left on bm_2)
    act(() => {
      contextValue.removeTagFromBookmarks('tag_2');
    });

    expect(contextValue.bookmarks[0].tags).toBeUndefined();
    expect(contextValue.bookmarks[1].tags).toBeUndefined();
    expect(removeTagFromBookmarksSpy).not.toHaveBeenCalled();
  });
});

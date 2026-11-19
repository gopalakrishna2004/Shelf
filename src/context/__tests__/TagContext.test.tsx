import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TagProvider, useTags, type TagContextType } from '../TagContext';
import { BookmarkProvider, useBookmarks, type BookmarkContextType } from '../BookmarkContext';
import { tagRepository } from '../../services/tagService';
import { bookmarkRepository } from '../../services/bookmarkService';
import type { Tag, Bookmark } from '../../types';

let mockCurrentUser: { id: string } | null = { id: 'user_tag_1' };
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: mockCurrentUser }),
}));

describe('TagContext Loading, Error States & Cascade Suite', () => {
  let container: HTMLDivElement;
  let root: Root;
  let tagContext: TagContextType;
  let bookmarkContext: BookmarkContextType;

  const Consumer: React.FC = () => {
    tagContext = useTags();
    bookmarkContext = useBookmarks();
    return null;
  };

  const sampleTag1: Tag = {
    id: 'tag_1',
    name: 'react',
    createdAt: '2026-11-19T00:00:00.000Z',
  };

  const sampleTag2: Tag = {
    id: 'tag_2',
    name: 'typescript',
    createdAt: '2026-11-19T01:00:00.000Z',
  };

  const sampleBookmark: Bookmark = {
    id: 'bm_1',
    url: 'https://react.dev',
    title: 'React Documentation',
    domain: 'react.dev',
    tags: ['tag_1', 'tag_2'],
    isFavourite: false,
    createdAt: '2026-11-19T00:00:00.000Z',
  };

  const sampleBookmark2: Bookmark = {
    id: 'bm_2',
    url: 'https://typescriptlang.org',
    title: 'TypeScript Documentation',
    domain: 'typescriptlang.org',
    tags: ['tag_2'],
    isFavourite: false,
    createdAt: '2026-11-19T01:00:00.000Z',
  };

  beforeEach(() => {
    mockCurrentUser = { id: 'user_tag_1' };
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
          <TagProvider>
            <Consumer />
          </TagProvider>
        </BookmarkProvider>
      );
    });
  };

  it('1. successful initial load with data', async () => {
    vi.spyOn(tagRepository, 'getTags').mockResolvedValueOnce([sampleTag1, sampleTag2]);
    vi.spyOn(bookmarkRepository, 'getBookmarks').mockResolvedValueOnce([]);

    await renderContexts();

    expect(tagContext.isLoading).toBe(false);
    expect(tagContext.loadError).toBeNull();
    expect(tagContext.tags).toHaveLength(2);
    expect(tagContext.tags[0].name).toBe('react');
    expect(tagContext.tags[1].name).toBe('typescript');
  });

  it('2. successful initial load with genuinely empty data', async () => {
    vi.spyOn(tagRepository, 'getTags').mockResolvedValueOnce([]);
    vi.spyOn(bookmarkRepository, 'getBookmarks').mockResolvedValueOnce([]);

    await renderContexts();

    expect(tagContext.isLoading).toBe(false);
    expect(tagContext.loadError).toBeNull();
    expect(tagContext.tags).toEqual([]);
  });

  it('3. initial load failure does not masquerade as successful empty data', async () => {
    vi.spyOn(tagRepository, 'getTags').mockRejectedValueOnce(new Error('Tag service network failed'));
    vi.spyOn(bookmarkRepository, 'getBookmarks').mockResolvedValueOnce([]);

    await renderContexts();

    expect(tagContext.isLoading).toBe(false);
    expect(tagContext.loadError).not.toBeNull();
    expect(tagContext.loadError?.message).toBe('Tag service network failed');
  });

  it('4. retry after failure succeeds and clears the error', async () => {
    vi.spyOn(tagRepository, 'getTags')
      .mockRejectedValueOnce(new Error('Initial failure'))
      .mockResolvedValueOnce([sampleTag1]);
    vi.spyOn(bookmarkRepository, 'getBookmarks').mockResolvedValue([]);

    await renderContexts();

    expect(tagContext.loadError).not.toBeNull();

    let retryResult: { success: boolean; error: Error | null } | undefined;
    await act(async () => {
      retryResult = await tagContext.retryLoad();
    });

    expect(retryResult?.success).toBe(true);
    expect(retryResult?.error).toBeNull();
    expect(tagContext.isLoading).toBe(false);
    expect(tagContext.loadError).toBeNull();
    expect(tagContext.tags).toEqual([sampleTag1]);
  });

  it('5. retry failure remains an error', async () => {
    vi.spyOn(tagRepository, 'getTags')
      .mockRejectedValueOnce(new Error('Tag error 1'))
      .mockRejectedValueOnce(new Error('Tag error 2'));
    vi.spyOn(bookmarkRepository, 'getBookmarks').mockResolvedValue([]);

    await renderContexts();

    let retryResult: { success: boolean; error: Error | null } | undefined;
    await act(async () => {
      retryResult = await tagContext.retryLoad();
    });

    expect(retryResult?.success).toBe(false);
    expect(retryResult?.error?.message).toBe('Tag error 2');
    expect(tagContext.loadError?.message).toBe('Tag error 2');
  });

  it('6. previous error clears when a retry starts', async () => {
    let resolveSecondAttempt: (value: Tag[]) => void;
    const secondPromise = new Promise<Tag[]>((resolve) => {
      resolveSecondAttempt = resolve;
    });

    vi.spyOn(tagRepository, 'getTags')
      .mockRejectedValueOnce(new Error('Initial failure'))
      .mockImplementationOnce(() => secondPromise);
    vi.spyOn(bookmarkRepository, 'getBookmarks').mockResolvedValue([]);

    await renderContexts();

    let retryPromise: Promise<{ success: boolean; error: Error | null }>;
    act(() => {
      retryPromise = tagContext.retryLoad();
    });

    expect(tagContext.loadError).toBeNull();
    expect(tagContext.isLoading).toBe(true);

    await act(async () => {
      resolveSecondAttempt!([sampleTag1]);
      await retryPromise;
    });

    expect(tagContext.isLoading).toBe(false);
    expect(tagContext.loadError).toBeNull();
    expect(tagContext.tags).toEqual([sampleTag1]);
  });

  it('7. user switching clears previous user data', async () => {
    vi.spyOn(tagRepository, 'getTags').mockResolvedValueOnce([sampleTag1]);
    vi.spyOn(bookmarkRepository, 'getBookmarks').mockResolvedValue([]);

    await renderContexts();
    expect(tagContext.tags).toEqual([sampleTag1]);

    // Switch user
    mockCurrentUser = { id: 'user_tag_2' };
    let resolveUser2: (data: Tag[]) => void;
    vi.spyOn(tagRepository, 'getTags').mockImplementationOnce(
      () => new Promise((resolve) => { resolveUser2 = resolve; })
    );

    act(() => {
      root.render(
        <BookmarkProvider>
          <TagProvider>
            <Consumer />
          </TagProvider>
        </BookmarkProvider>
      );
    });

    expect(tagContext.tags).toEqual([]);
    expect(tagContext.isLoading).toBe(true);

    await act(async () => {
      resolveUser2!([sampleTag2]);
    });

    expect(tagContext.tags).toEqual([sampleTag2]);
  });

  it('8. a late response from the previous user cannot overwrite the new user state', async () => {
    let resolveUser1: (data: Tag[]) => void;
    const user1Promise = new Promise<Tag[]>((resolve) => {
      resolveUser1 = resolve;
    });

    let resolveUser2: (data: Tag[]) => void;
    const user2Promise = new Promise<Tag[]>((resolve) => {
      resolveUser2 = resolve;
    });

    vi.spyOn(tagRepository, 'getTags')
      .mockImplementationOnce(() => user1Promise)
      .mockImplementationOnce(() => user2Promise);
    vi.spyOn(bookmarkRepository, 'getBookmarks').mockResolvedValue([]);

    await act(async () => {
      root.render(
        <BookmarkProvider>
          <TagProvider>
            <Consumer />
          </TagProvider>
        </BookmarkProvider>
      );
    });

    mockCurrentUser = { id: 'user_tag_2' };
    await act(async () => {
      root.render(
        <BookmarkProvider>
          <TagProvider>
            <Consumer />
          </TagProvider>
        </BookmarkProvider>
      );
    });

    await act(async () => {
      resolveUser2!([sampleTag2]);
    });
    expect(tagContext.tags).toEqual([sampleTag2]);

    await act(async () => {
      resolveUser1!([sampleTag1]);
    });
    expect(tagContext.tags).toEqual([sampleTag2]);
  });

  it('9. a late response from an older request cannot overwrite a newer request', async () => {
    let resolveReq1: (data: Tag[]) => void;
    const req1Promise = new Promise<Tag[]>((resolve) => {
      resolveReq1 = resolve;
    });

    let resolveReq2: (data: Tag[]) => void;
    const req2Promise = new Promise<Tag[]>((resolve) => {
      resolveReq2 = resolve;
    });

    vi.spyOn(tagRepository, 'getTags')
      .mockImplementationOnce(() => req1Promise)
      .mockImplementationOnce(() => req2Promise);
    vi.spyOn(bookmarkRepository, 'getBookmarks').mockResolvedValue([]);

    await act(async () => {
      root.render(
        <BookmarkProvider>
          <TagProvider>
            <Consumer />
          </TagProvider>
        </BookmarkProvider>
      );
    });

    act(() => {
      tagContext.retryLoad();
    });

    await act(async () => {
      resolveReq2!([sampleTag2]);
    });
    expect(tagContext.tags).toEqual([sampleTag2]);

    await act(async () => {
      resolveReq1!([sampleTag1]);
    });
    expect(tagContext.tags).toEqual([sampleTag2]);
  });

  it('10. repeated retry calls do not corrupt state or create duplicate updates', async () => {
    vi.spyOn(tagRepository, 'getTags').mockResolvedValue([sampleTag1]);
    vi.spyOn(bookmarkRepository, 'getBookmarks').mockResolvedValue([]);

    await renderContexts();

    await act(async () => {
      await Promise.all([
        tagContext.retryLoad(),
        tagContext.retryLoad(),
        tagContext.retryLoad(),
      ]);
    });

    expect(tagContext.tags).toEqual([sampleTag1]);
    expect(tagContext.isLoading).toBe(false);
    expect(tagContext.loadError).toBeNull();
  });

  it('11. tag deletion performs exactly one persistence deletion and removes tag from loaded bookmarks in memory', async () => {
    vi.spyOn(tagRepository, 'getTags').mockResolvedValueOnce([sampleTag1, sampleTag2]);
    vi.spyOn(bookmarkRepository, 'getBookmarks').mockResolvedValueOnce([sampleBookmark, sampleBookmark2]);
    const deleteTagSpy = vi.spyOn(tagRepository, 'deleteTag').mockResolvedValueOnce(undefined);
    const removeTagFromBookmarksSpy = vi.spyOn(bookmarkRepository, 'removeTagFromBookmarks');

    await renderContexts();

    expect(tagContext.tags).toHaveLength(2);
    expect(bookmarkContext.bookmarks[0].tags).toEqual(['tag_1', 'tag_2']);
    expect(bookmarkContext.bookmarks[1].tags).toEqual(['tag_2']);

    let deleteResult: { success: boolean; error: Error | null } | undefined;
    await act(async () => {
      deleteResult = await tagContext.deleteTag('tag_1');
    });

    expect(deleteResult?.success).toBe(true);
    // Exactly one persistence call was performed
    expect(deleteTagSpy).toHaveBeenCalledTimes(1);
    expect(deleteTagSpy).toHaveBeenCalledWith('user_tag_1', 'tag_1');
    // Bookmark repository disassociation method was NOT called (no redundant persistence call)
    expect(removeTagFromBookmarksSpy).not.toHaveBeenCalled();

    // Tag removed from in-memory tag state
    expect(tagContext.tags).toHaveLength(1);
    expect(tagContext.tags[0].id).toBe('tag_2');

    // Loaded bookmarks had tag_1 removed in memory
    expect(bookmarkContext.bookmarks[0].tags).toEqual(['tag_2']);
    // bm_2 did not have tag_1, remains unchanged
    expect(bookmarkContext.bookmarks[1].tags).toEqual(['tag_2']);
  });

  it('12. failed tag deletion leaves bookmark tag IDs and tag state unchanged', async () => {
    vi.spyOn(tagRepository, 'getTags').mockResolvedValueOnce([sampleTag1]);
    vi.spyOn(bookmarkRepository, 'getBookmarks').mockResolvedValueOnce([sampleBookmark]);
    vi.spyOn(tagRepository, 'deleteTag').mockRejectedValueOnce(new Error('Tag deletion failed on server'));
    const removeTagFromBookmarksSpy = vi.spyOn(bookmarkRepository, 'removeTagFromBookmarks');

    await renderContexts();

    let deleteResult: { success: boolean; error: Error | null } | undefined;
    await act(async () => {
      deleteResult = await tagContext.deleteTag('tag_1');
    });

    expect(deleteResult?.success).toBe(false);
    expect(deleteResult?.error?.message).toBe('Tag deletion failed on server');

    // In-memory tag remains present
    expect(tagContext.tags).toHaveLength(1);
    expect(tagContext.tags[0].id).toBe('tag_1');

    // Bookmark tags in memory remain untouched
    expect(bookmarkContext.bookmarks[0].tags).toEqual(['tag_1', 'tag_2']);
    expect(removeTagFromBookmarksSpy).not.toHaveBeenCalled();
  });
});

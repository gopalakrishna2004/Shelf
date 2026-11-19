import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  setPendingTagId,
  getPendingTagId,
  consumePendingTagId,
  clearPendingTagId,
} from '../../lib/tagNavigation';
import type { Bookmark, Tag } from '../../types';

describe('Tags → View Links Regression Suite', () => {
  beforeEach(() => {
    clearPendingTagId();
  });

  const mockTags: Tag[] = [
    { id: 'tag-fun', name: 'fun', createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'tag-work', name: 'work', createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'tag-reading', name: 'reading', createdAt: '2026-01-01T00:00:00.000Z' },
  ];

  const mockBookmarks: Bookmark[] = [
    {
      id: 'bm-1',
      url: 'https://games.example.com',
      title: 'Cool Web Game',
      domain: 'games.example.com',
      description: 'A fun interactive game',
      tags: ['tag-fun'],
      isFavourite: false,
      createdAt: '2026-01-01T10:00:00.000Z',
    },
    {
      id: 'bm-2',
      url: 'https://work.example.com/project',
      title: 'Sprint Planning',
      domain: 'work.example.com',
      description: 'Work sprint roadmap',
      collectionId: 'col-office',
      tags: ['tag-work'],
      isFavourite: true,
      createdAt: '2026-01-02T10:00:00.000Z',
    },
    {
      id: 'bm-3',
      url: 'https://books.example.com/essay',
      title: 'Design Philosophy Essay',
      domain: 'books.example.com',
      description: 'Long form essay on design and fun interactive details',
      collectionId: 'col-reading',
      tags: ['tag-fun', 'tag-reading'],
      isFavourite: true,
      createdAt: '2026-01-03T10:00:00.000Z',
    },
    {
      id: 'bm-4',
      url: 'https://reference.example.com',
      title: 'General Documentation',
      domain: 'reference.example.com',
      tags: [],
      isFavourite: false,
      createdAt: '2026-01-04T10:00:00.000Z',
    },
  ];

  // Pure filtering logic used in AllBookmarksPage
  const applyAllBookmarksFilter = (
    bookmarks: Bookmark[],
    query: string,
    collectionId: string,
    tagId: string
  ): Bookmark[] => {
    return bookmarks.filter((b) => {
      const matchesSearch =
        b.title.toLowerCase().includes(query.toLowerCase()) ||
        b.url.toLowerCase().includes(query.toLowerCase()) ||
        Boolean(b.description && b.description.toLowerCase().includes(query.toLowerCase()));

      const matchesCollection =
        collectionId === 'all'
          ? true
          : collectionId === 'unassigned'
          ? !b.collectionId
          : b.collectionId === collectionId;

      const matchesTag =
        tagId === 'all'
          ? true
          : Boolean(b.tags && b.tags.includes(tagId));

      return matchesSearch && matchesCollection && matchesTag;
    });
  };

  describe('1. Clicking View Links Selects the Correct Tag', () => {
    it('sets pending tag ID and triggers navigation with the tag stable ID', () => {
      const onNavigate = vi.fn();
      const targetTag = mockTags[0]; // { id: 'tag-fun', name: 'fun' }

      // Simulate what TagsPage handleSelectTag does
      setPendingTagId(targetTag.id);
      onNavigate('all');
      window.dispatchEvent(
        new CustomEvent('shelf-select-tag', { detail: { tagId: targetTag.id } })
      );

      expect(onNavigate).toHaveBeenCalledWith('all');
      expect(getPendingTagId()).toBe('tag-fun');
    });

    it('captures shelf-select-tag custom events automatically even before listeners mount', () => {
      // Dispatching shelf-select-tag should populate pendingTagId via global listener
      window.dispatchEvent(
        new CustomEvent('shelf-select-tag', { detail: { tagId: 'tag-work' } })
      );

      expect(getPendingTagId()).toBe('tag-work');
    });
  });

  describe('2. The Tag Filter Still Works After Navigating to All Bookmarks', () => {
    it('initializes selectedTag state from pending selection when AllBookmarksPage mounts', () => {
      // 1. User on TagsPage clicks "View links" on tag-fun
      setPendingTagId('tag-fun');

      // 2. AllBookmarksPage mounts and consumes pending tag selection
      const initialSelectedTag = consumePendingTagId() || 'all';
      expect(initialSelectedTag).toBe('tag-fun');

      // 3. Pending tag is now consumed so subsequent mounts without selection default to all
      expect(consumePendingTagId()).toBeNull();
      const subsequentMountSelectedTag = consumePendingTagId() || 'all';
      expect(subsequentMountSelectedTag).toBe('all');
    });

    it('keeps the tag filter active while searching and changing collections', () => {
      const activeTag = 'tag-fun';

      // Initially filtered to 'tag-fun'
      const initialResults = applyAllBookmarksFilter(mockBookmarks, '', 'all', activeTag);
      expect(initialResults.map((b) => b.id)).toEqual(['bm-1', 'bm-3']);

      // User performs a search while tag filter is active
      const searchedResults = applyAllBookmarksFilter(mockBookmarks, 'game', 'all', activeTag);
      expect(searchedResults.map((b) => b.id)).toEqual(['bm-1']);

      // User filters by a collection while tag filter is active
      const collectionResults = applyAllBookmarksFilter(mockBookmarks, '', 'col-reading', activeTag);
      expect(collectionResults.map((b) => b.id)).toEqual(['bm-3']);

      // User searches for non-matching term under the active tag
      const noMatch = applyAllBookmarksFilter(mockBookmarks, 'nonexistent', 'all', activeTag);
      expect(noMatch.length).toBe(0);
    });

    it('allows clearing the tag filter normally back to all bookmarks', () => {
      let selectedTag = 'tag-fun';
      let results = applyAllBookmarksFilter(mockBookmarks, '', 'all', selectedTag);
      expect(results.length).toBe(2);

      // Clearing tag filter
      selectedTag = 'all';
      results = applyAllBookmarksFilter(mockBookmarks, '', 'all', selectedTag);
      expect(results.length).toBe(4);
    });
  });

  describe('3. Only Bookmarks Assigned to the Tag are Displayed', () => {
    it('displays only bookmarks containing the exact tag ID', () => {
      const funBookmarks = applyAllBookmarksFilter(mockBookmarks, '', 'all', 'tag-fun');
      expect(funBookmarks.length).toBe(2);
      expect(funBookmarks.every((b) => b.tags?.includes('tag-fun'))).toBe(true);

      const workBookmarks = applyAllBookmarksFilter(mockBookmarks, '', 'all', 'tag-work');
      expect(workBookmarks.length).toBe(1);
      expect(workBookmarks[0].id).toBe('bm-2');
      expect(workBookmarks[0].tags).toContain('tag-work');
    });

    it('displays 0 bookmarks when tag ID has no assigned bookmarks', () => {
      const emptyResults = applyAllBookmarksFilter(mockBookmarks, '', 'all', 'tag-unused');
      expect(emptyResults.length).toBe(0);
    });

    it('bookmark count and displayed results agree', () => {
      mockTags.forEach((tag) => {
        const expectedCount = mockBookmarks.filter((b) => b.tags?.includes(tag.id)).length;
        const displayed = applyAllBookmarksFilter(mockBookmarks, '', 'all', tag.id);
        expect(displayed.length).toBe(expectedCount);
      });
    });
  });
});

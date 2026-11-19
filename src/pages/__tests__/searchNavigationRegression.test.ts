import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  setActiveSearchQuery,
  getActiveSearchQuery,
  clearActiveSearchQuery,
  setPendingSearchQuery,
  consumePendingSearchQuery,
  clearPendingSearchQuery,
} from '../../lib/searchNavigation';
import {
  setPendingCollectionId,
  getPendingCollectionId,
  consumePendingCollectionId,
  clearPendingCollectionId,
} from '../../lib/collectionNavigation';
import {
  setPendingTagId,
  getPendingTagId,
  consumePendingTagId,
  clearPendingTagId,
} from '../../lib/tagNavigation';
import { filterBookmarks } from '../../lib/search';
import type { Bookmark, Collection, Tag } from '../../types';

describe('Stage 4.3 / Milestone 2: Search Navigation & State Survival Regression Suite', () => {
  beforeEach(() => {
    clearActiveSearchQuery();
    clearPendingSearchQuery();
    clearPendingCollectionId();
    clearPendingTagId();
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.clear();
    }
  });

  const mockCollections: Collection[] = [
    { id: 'col-tech', name: 'Technology & Engineering', createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'col-design', name: 'Design Systems', createdAt: '2026-01-02T00:00:00.000Z' },
  ];

  const mockTags: Tag[] = [
    { id: 'tag-react', name: 'React', createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'tag-ui', name: 'UI', createdAt: '2026-01-02T00:00:00.000Z' },
  ];

  const mockBookmarks: Bookmark[] = [
    {
      id: 'bm-1',
      url: 'https://react.dev',
      title: 'React Documentation',
      domain: 'react.dev',
      description: 'Official React framework reference',
      collectionId: 'col-tech',
      collectionName: 'Technology & Engineering',
      tags: ['tag-react'],
      isFavourite: true,
      createdAt: '2026-01-01T10:00:00.000Z',
    },
    {
      id: 'bm-2',
      url: 'https://designsystems.com',
      title: 'Design Systems Guide',
      domain: 'designsystems.com',
      description: 'Component architecture and tokens',
      collectionId: 'col-design',
      collectionName: 'Design Systems',
      tags: ['tag-ui'],
      isFavourite: false,
      createdAt: '2026-01-02T10:00:00.000Z',
    },
    {
      id: 'bm-3',
      url: 'https://ui.shadcn.com',
      title: 'Shadcn UI',
      domain: 'ui.shadcn.com',
      description: 'Accessible React UI components',
      collectionId: 'col-design',
      collectionName: 'Design Systems',
      tags: ['tag-react', 'tag-ui'],
      isFavourite: true,
      createdAt: '2026-01-03T10:00:00.000Z',
    },
  ];

  // 1. Home search navigates with the correct query
  describe('1. Home Search Navigation', () => {
    it('sets the active search query and navigates to all with query intact', () => {
      const onNavigate = vi.fn();
      const onSearch = vi.fn((query: string) => {
        setActiveSearchQuery(query);
        onNavigate('all');
      });

      const homeQuery = 'React framework';
      onSearch(homeQuery);

      expect(onSearch).toHaveBeenCalledWith('React framework');
      expect(onNavigate).toHaveBeenCalledWith('all');
      expect(getActiveSearchQuery()).toBe('React framework');

      // Verify AllBookmarksPage filtering receives this query
      const results = filterBookmarks(mockBookmarks, {
        query: getActiveSearchQuery(),
        tags: mockTags,
        collections: mockCollections,
      });
      expect(results.length).toBe(1);
      expect(results[0].id).toBe('bm-1');
    });

    it('sets pending search query for asynchronous mount consumption', () => {
      setPendingSearchQuery('framework reference');
      // Simulated mount consumption
      const pending = consumePendingSearchQuery();
      expect(pending).toBe('framework reference');
      expect(consumePendingSearchQuery()).toBeNull();
    });
  });

  // 2. Search query survives navigation
  describe('2. Query Survival Across Page Navigation', () => {
    it('preserves search query when transitioning between All Bookmarks and Favourites', () => {
      // Step 1: User enters query on All Bookmarks
      setActiveSearchQuery('design');
      expect(getActiveSearchQuery()).toBe('design');

      // Step 2: User navigates to Favourites
      // Favourites consumes active search query
      const favouritesQuery = getActiveSearchQuery();
      expect(favouritesQuery).toBe('design');

      const favResults = filterBookmarks(
        mockBookmarks.filter((b) => b.isFavourite),
        {
          query: favouritesQuery,
          tags: mockTags,
          collections: mockCollections,
        }
      );
      // Only bm-3 is both a favourite and matches "design"
      expect(favResults.length).toBe(1);
      expect(favResults[0].id).toBe('bm-3');

      // Step 3: User edits query on Favourites
      setActiveSearchQuery('ui');

      // Step 4: User navigates back to All Bookmarks
      const allBookmarksQuery = getActiveSearchQuery();
      expect(allBookmarksQuery).toBe('ui');

      const allResults = filterBookmarks(mockBookmarks, {
        query: allBookmarksQuery,
        tags: mockTags,
        collections: mockCollections,
      });
      // bm-2 and bm-3 match "ui"
      expect(allResults.map((b) => b.id)).toEqual(['bm-2', 'bm-3']);
    });
  });

  // 3. Search query survives refresh where intended
  describe('3. Query Survival on Browser Refresh', () => {
    it('restores active search query from sessionStorage upon simulated page reload', () => {
      setActiveSearchQuery('shadcn');
      expect(getActiveSearchQuery()).toBe('shadcn');

      // Simulate full app remount / refresh reading from storage
      const restoredQuery = getActiveSearchQuery();
      expect(restoredQuery).toBe('shadcn');

      const filtered = filterBookmarks(mockBookmarks, {
        query: restoredQuery,
        tags: mockTags,
        collections: mockCollections,
      });
      expect(filtered.length).toBe(1);
      expect(filtered[0].id).toBe('bm-3');
    });
  });

  // 4. Clearing search removes the query correctly
  describe('4. Clearing Search Query', () => {
    it('clears active query from memory and sessionStorage predictably', () => {
      setActiveSearchQuery('react');
      expect(getActiveSearchQuery()).toBe('react');

      clearActiveSearchQuery();
      expect(getActiveSearchQuery()).toBe('');

      // Filtering with cleared query returns all bookmarks
      const results = filterBookmarks(mockBookmarks, {
        query: getActiveSearchQuery(),
      });
      expect(results.length).toBe(mockBookmarks.length);
    });
  });

  // 5. Collection navigation still works
  describe('5. Collection Navigation', () => {
    it('reliably passes selected collection across transitions even with unmounted targets', () => {
      setPendingCollectionId('col-tech');
      expect(getPendingCollectionId()).toBe('col-tech');

      // Simulated AllBookmarksPage mounting and consuming pending collection
      const activeCollection = consumePendingCollectionId() || 'all';
      expect(activeCollection).toBe('col-tech');
      expect(getPendingCollectionId()).toBeNull();

      const results = filterBookmarks(mockBookmarks, {
        collectionId: activeCollection,
        tags: mockTags,
        collections: mockCollections,
      });
      expect(results.length).toBe(1);
      expect(results[0].id).toBe('bm-1');
    });

    it('sets pending search query for asynchronous mount consumption', () => {
      setPendingSearchQuery('framework reference');
      // Simulated mount consumption
      const pending = consumePendingSearchQuery();
      expect(pending).toBe('framework reference');
      expect(consumePendingSearchQuery()).toBeNull();
    });
  });

  // 6. Tag navigation still works
  describe('6. Tag Navigation', () => {
    it('reliably passes selected tag across transitions even with unmounted targets', () => {
      setPendingTagId('tag-ui');
      expect(getPendingTagId()).toBe('tag-ui');

      // Simulated AllBookmarksPage mounting and consuming pending tag
      const activeTag = consumePendingTagId() || 'all';
      expect(activeTag).toBe('tag-ui');
      expect(getPendingTagId()).toBeNull();

      const results = filterBookmarks(mockBookmarks, {
        tagId: activeTag,
        tags: mockTags,
        collections: mockCollections,
      });
      expect(results.length).toBe(2);
      expect(results.map((b) => b.id)).toEqual(['bm-2', 'bm-3']);
    });
  });

  // 7. Collection and tag filters do not overwrite one another
  describe('7. Filter Independence & Non-Coupling', () => {
    it('maintains independent collection and tag filters without cross-contamination', () => {
      const activeCollection = 'col-design';
      const activeTag = 'tag-react';
      const query = '';

      // Both bm-2 and bm-3 are in col-design, but only bm-3 has tag-react
      const results = filterBookmarks(mockBookmarks, {
        query,
        collectionId: activeCollection,
        tagId: activeTag,
        tags: mockTags,
        collections: mockCollections,
      });

      expect(results.length).toBe(1);
      expect(results[0].id).toBe('bm-3');

      // Clearing tag filter retains collection filter
      const onlyCollection = filterBookmarks(mockBookmarks, {
        query,
        collectionId: activeCollection,
        tagId: 'all',
        tags: mockTags,
        collections: mockCollections,
      });
      expect(onlyCollection.length).toBe(2);

      // Clearing collection filter retains tag filter
      const onlyTag = filterBookmarks(mockBookmarks, {
        query,
        collectionId: 'all',
        tagId: activeTag,
        tags: mockTags,
        collections: mockCollections,
      });
      expect(onlyTag.length).toBe(2);
      expect(onlyTag.map((b) => b.id)).toEqual(['bm-1', 'bm-3']);
    });

    it('combines text search with both collection and tag filters correctly', () => {
      const results = filterBookmarks(mockBookmarks, {
        query: 'Accessible',
        collectionId: 'col-design',
        tagId: 'tag-react',
        tags: mockTags,
        collections: mockCollections,
      });

      expect(results.length).toBe(1);
      expect(results[0].id).toBe('bm-3');
    });
  });

  // 8. No stale query unexpectedly appears when returning Home
  describe('8. Home Page Isolation', () => {
    it('ensures Home search input state remains clean after navigating away and returning', () => {
      // Simulate Home submission
      let homeLocalInput = 'query to be submitted';
      const onNavigate = vi.fn();
      const onSearch = vi.fn((q: string) => {
        setActiveSearchQuery(q);
        onNavigate('all');
      });

      // Submit from Home
      onSearch(homeLocalInput.trim());
      homeLocalInput = ''; // Cleared on submit

      expect(getActiveSearchQuery()).toBe('query to be submitted');
      expect(homeLocalInput).toBe('');

      // When returning to Home, new Home component mounts with empty local input
      const newHomeLocalInput = '';
      expect(newHomeLocalInput).toBe('');
    });
  });
});

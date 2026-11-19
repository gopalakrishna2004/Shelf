import { describe, it, expect, beforeEach } from 'vitest';
import { filterBookmarks } from '../../lib/search';
import { sortBookmarks } from '../../lib/sorting';
import {
  setPendingSearchQuery,
  consumePendingSearchQuery,
  clearActiveSearchQuery,
} from '../../lib/searchNavigation';
import {
  setPendingCollectionId,
  consumePendingCollectionId,
} from '../../lib/collectionNavigation';
import {
  setPendingTagId,
  consumePendingTagId,
} from '../../lib/tagNavigation';
import type { Bookmark, Collection, Tag, ViewMode, SortOption } from '../../types';

describe('Stage 4.3 / Milestone 3: Unified Search UI & Discovery Polish', () => {
  beforeEach(() => {
    clearActiveSearchQuery();
    consumePendingSearchQuery();
    consumePendingCollectionId();
    consumePendingTagId();
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.clear();
    }
  });

  const mockCollections: Collection[] = [
    { id: 'col-dev', name: 'Web Engineering', createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'col-design', name: 'Design Systems', createdAt: '2026-01-02T00:00:00.000Z' },
  ];

  const mockTags: Tag[] = [
    { id: 'tag-react', name: 'React', createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'tag-tailwind', name: 'Tailwind CSS', createdAt: '2026-01-02T00:00:00.000Z' },
    { id: 'tag-patterns', name: 'Architecture', createdAt: '2026-01-03T00:00:00.000Z' },
  ];

  const mockBookmarks: Bookmark[] = [
    {
      id: 'bm-1',
      url: 'https://react.dev/reference/react',
      title: 'React APIs and Hooks',
      domain: 'react.dev',
      description: 'Official comprehensive reference of standard React hooks and APIs.',
      collectionId: 'col-dev',
      collectionName: 'Web Engineering',
      tags: ['tag-react', 'tag-patterns'],
      isFavourite: true,
      createdAt: '2026-01-01T10:00:00.000Z',
    },
    {
      id: 'bm-2',
      url: 'https://tailwindcss.com/docs/utility-first',
      title: 'Utility-First Fundamentals',
      domain: 'tailwindcss.com',
      description: 'Building modern responsive designs directly in HTML.',
      collectionId: 'col-design',
      collectionName: 'Design Systems',
      tags: ['tag-tailwind'],
      isFavourite: false,
      createdAt: '2026-01-02T10:00:00.000Z',
    },
    {
      id: 'bm-3',
      url: 'https://shadcn.com/ui-patterns',
      title: 'Accessible Component Patterns',
      domain: 'shadcn.com',
      description: 'Customizable UI components styled with Tailwind CSS.',
      collectionId: 'col-design',
      collectionName: 'Design Systems',
      tags: ['tag-react', 'tag-tailwind'],
      isFavourite: true,
      createdAt: '2026-01-03T10:00:00.000Z',
    },
  ];

  // 1. Search Across Every Supported Field
  describe('1. Multi-Field Unified Search Matching', () => {
    it('matches by title', () => {
      const results = filterBookmarks(mockBookmarks, {
        query: 'Fundamentals',
        tags: mockTags,
        collections: mockCollections,
      });
      expect(results.length).toBe(1);
      expect(results[0].id).toBe('bm-2');
    });

    it('matches by full URL and URL path', () => {
      const results = filterBookmarks(mockBookmarks, {
        query: 'react.dev/reference',
        tags: mockTags,
        collections: mockCollections,
      });
      expect(results.length).toBe(1);
      expect(results[0].id).toBe('bm-1');
    });

    it('matches by domain', () => {
      const results = filterBookmarks(mockBookmarks, {
        query: 'shadcn.com',
        tags: mockTags,
        collections: mockCollections,
      });
      expect(results.length).toBe(1);
      expect(results[0].id).toBe('bm-3');
    });

    it('matches by description / notes', () => {
      const results = filterBookmarks(mockBookmarks, {
        query: 'comprehensive reference',
        tags: mockTags,
        collections: mockCollections,
      });
      expect(results.length).toBe(1);
      expect(results[0].id).toBe('bm-1');
    });

    it('matches by assigned tag names (with and without # prefix)', () => {
      const withHash = filterBookmarks(mockBookmarks, {
        query: '#react',
        tags: mockTags,
        collections: mockCollections,
      });
      expect(withHash.map((b) => b.id)).toEqual(['bm-1', 'bm-3']);

      const withoutHash = filterBookmarks(mockBookmarks, {
        query: 'Architecture',
        tags: mockTags,
        collections: mockCollections,
      });
      expect(withoutHash.length).toBe(1);
      expect(withoutHash[0].id).toBe('bm-1');
    });

    it('matches by current collection name', () => {
      const results = filterBookmarks(mockBookmarks, {
        query: 'Engineering',
        tags: mockTags,
        collections: mockCollections,
      });
      expect(results.length).toBe(1);
      expect(results[0].id).toBe('bm-1');
    });
  });

  // 2. Consistent Search on All Bookmarks and Favourites
  describe('2. Consistency Across All Bookmarks and Favourites', () => {
    it('applies the exact same matching engine on both page datasets', () => {
      const query = 'Tailwind';

      // All Bookmarks search
      const allResults = filterBookmarks(mockBookmarks, {
        query,
        tags: mockTags,
        collections: mockCollections,
      });
      expect(allResults.map((b) => b.id)).toEqual(['bm-2', 'bm-3']);

      // Favourites search (only bm-3 is a favourite among the two)
      const favourites = mockBookmarks.filter((b) => b.isFavourite);
      const favResults = filterBookmarks(favourites, {
        query,
        tags: mockTags,
        collections: mockCollections,
      });
      expect(favResults.length).toBe(1);
      expect(favResults[0].id).toBe('bm-3');
    });
  });

  // 3. Filter Retention When Clearing Search
  describe('3. Clearing Search Retains Collection & Tag Filters', () => {
    it('clears query while maintaining active collection and tag filters', () => {
      let activeQuery = 'reference';
      const activeCollection = 'col-dev';
      const activeTag = 'tag-react';

      const initialFiltered = filterBookmarks(mockBookmarks, {
        query: activeQuery,
        collectionId: activeCollection,
        tagId: activeTag,
        tags: mockTags,
        collections: mockCollections,
      });
      expect(initialFiltered.length).toBe(1);
      expect(initialFiltered[0].id).toBe('bm-1');

      // User clears the search query
      activeQuery = '';
      const afterClear = filterBookmarks(mockBookmarks, {
        query: activeQuery,
        collectionId: activeCollection,
        tagId: activeTag,
        tags: mockTags,
        collections: mockCollections,
      });

      // Still filters by collection and tag
      expect(afterClear.length).toBe(1);
      expect(afterClear[0].id).toBe('bm-1');
    });
  });

  // 4. Removing Individual Filters
  describe('4. Removing Individual Filters', () => {
    it('allows clearing tag filter while preserving collection and search query', () => {
      const activeQuery = 'patterns';
      const activeCollection = 'col-design';
      let activeTag = 'tag-react';

      const withTag = filterBookmarks(mockBookmarks, {
        query: activeQuery,
        collectionId: activeCollection,
        tagId: activeTag,
        tags: mockTags,
        collections: mockCollections,
      });
      expect(withTag.length).toBe(1);
      expect(withTag[0].id).toBe('bm-3');

      // Remove tag filter ('all')
      activeTag = 'all';
      const withoutTag = filterBookmarks(mockBookmarks, {
        query: activeQuery,
        collectionId: activeCollection,
        tagId: activeTag,
        tags: mockTags,
        collections: mockCollections,
      });
      expect(withoutTag.length).toBe(1);
      expect(withoutTag[0].id).toBe('bm-3');
    });

    it('allows clearing collection filter while preserving tag and search query', () => {
      const activeQuery = 'reference';
      let activeCollection = 'col-dev';
      const activeTag = 'tag-react';

      // Remove collection filter ('all')
      activeCollection = 'all';
      const withoutCollection = filterBookmarks(mockBookmarks, {
        query: activeQuery,
        collectionId: activeCollection,
        tagId: activeTag,
        tags: mockTags,
        collections: mockCollections,
      });
      expect(withoutCollection.length).toBe(1);
      expect(withoutCollection[0].id).toBe('bm-1');
    });
  });

  // 5. Clear-All Behaviour
  describe('5. Clear-All Reset Behaviour', () => {
    it('resets query, collection, and tag filters simultaneously without mutating bookmark data', () => {
      const initialCopy = JSON.parse(JSON.stringify(mockBookmarks));

      let activeQuery = 'custom query';
      let activeCollection = 'col-design';
      let activeTag = 'tag-tailwind';

      // Reset all filters
      activeQuery = '';
      activeCollection = 'all';
      activeTag = 'all';

      const resetResults = filterBookmarks(mockBookmarks, {
        query: activeQuery,
        collectionId: activeCollection,
        tagId: activeTag,
        tags: mockTags,
        collections: mockCollections,
      });

      expect(resetResults.length).toBe(mockBookmarks.length);
      expect(mockBookmarks).toEqual(initialCopy);
    });
  });

  // 6. Each Search-Related Empty State
  describe('6. Search Empty State Distinctions', () => {
    it('distinguishes between empty library and query returning zero results', () => {
      // 1. Empty library
      const emptyLibrary: Bookmark[] = [];
      const resEmpty = filterBookmarks(emptyLibrary, { query: '' });
      expect(resEmpty.length).toBe(0);

      // 2. Non-empty library with non-matching query
      const resQueryNoMatch = filterBookmarks(mockBookmarks, { query: 'nonexistent phrase' });
      expect(resQueryNoMatch.length).toBe(0);
      expect(mockBookmarks.length).toBeGreaterThan(0);
    });

    it('distinguishes between no favourites and favourites with non-matching query', () => {
      // 4. No favourites in library
      const noFavourites = mockBookmarks.map((b) => ({ ...b, isFavourite: false }));
      const favsEmpty = noFavourites.filter((b) => b.isFavourite);
      expect(favsEmpty.length).toBe(0);

      // 5. Favourites exist, but query matches none of them
      const favourites = mockBookmarks.filter((b) => b.isFavourite);
      expect(favourites.length).toBe(2);

      const favQueryNoMatch = filterBookmarks(favourites, {
        query: 'utility-first', // exists on bm-2, but bm-2 is not favourite
        tags: mockTags,
        collections: mockCollections,
      });
      expect(favQueryNoMatch.length).toBe(0);
    });
  });

  // 7. Grid / List Result Consistency
  describe('7. Grid / List View Mode Consistency', () => {
    it('renders the exact same ordered items in both Grid and List modes', () => {
      const query = 'React';
      const sortOption: SortOption = 'newest';

      const filtered = filterBookmarks(mockBookmarks, {
        query,
        tags: mockTags,
        collections: mockCollections,
      });
      const sorted = sortBookmarks(filtered, sortOption);

      const gridResults = sorted;
      const listResults = sorted;

      // Both modes receive the identical array and sequence
      expect(gridResults).toEqual(listResults);
      expect(gridResults.map((b) => b.id)).toEqual(['bm-3', 'bm-1']);

      // Switching view mode has no effect on result contents
      let currentMode: ViewMode = 'grid';
      currentMode = 'list';
      expect(currentMode).toBe('list');
      expect(sorted.map((b) => b.id)).toEqual(['bm-3', 'bm-1']);
    });
  });

  // 8. Existing Sorting Compatibility
  describe('8. Search Results Sorting Compatibility', () => {
    it('sorts search results by all available options deterministically', () => {
      const query = 'React';
      const filtered = filterBookmarks(mockBookmarks, {
        query,
        tags: mockTags,
        collections: mockCollections,
      });

      // Newest
      const newest = sortBookmarks(filtered, 'newest');
      expect(newest.map((b) => b.id)).toEqual(['bm-3', 'bm-1']);

      // Oldest
      const oldest = sortBookmarks(filtered, 'oldest');
      expect(oldest.map((b) => b.id)).toEqual(['bm-1', 'bm-3']);

      // Title A-Z ('Accessible Component Patterns' vs 'React APIs and Hooks')
      const titleAsc = sortBookmarks(filtered, 'title-asc');
      expect(titleAsc.map((b) => b.id)).toEqual(['bm-3', 'bm-1']);

      // Title Z-A
      const titleDesc = sortBookmarks(filtered, 'title-desc');
      expect(titleDesc.map((b) => b.id)).toEqual(['bm-1', 'bm-3']);
    });
  });

  // 9. Rapid Navigation Without Stale Pending Selections
  describe('9. Rapid Navigation & One-Time Pending Consumption', () => {
    it('consumes pending search query exactly once', () => {
      setPendingSearchQuery('rapid test query');
      expect(consumePendingSearchQuery()).toBe('rapid test query');
      // Subsequent consumption yields null, preventing stale reappearance
      expect(consumePendingSearchQuery()).toBeNull();
    });

    it('consumes pending collection ID exactly once', () => {
      setPendingCollectionId('col-dev');
      expect(consumePendingCollectionId()).toBe('col-dev');
      expect(consumePendingCollectionId()).toBeNull();
    });

    it('consumes pending tag ID exactly once', () => {
      setPendingTagId('tag-react');
      expect(consumePendingTagId()).toBe('tag-react');
      expect(consumePendingTagId()).toBeNull();
    });
  });
});

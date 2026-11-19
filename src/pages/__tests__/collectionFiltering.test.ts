import { describe, it, expect } from 'vitest';
import type { Bookmark, SortOption } from '../../types';
import { sortBookmarks } from '../../lib/sorting';

describe('Collection Filtering and Sorting Integration', () => {
  const sampleBookmarks: Bookmark[] = [
    {
      id: '1',
      url: 'https://react.dev',
      title: 'React Documentation',
      domain: 'react.dev',
      description: 'UI library documentation',
      collectionId: 'col_tech',
      collectionName: 'Technology',
      isFavourite: true,
      createdAt: '2026-01-01T10:00:00.000Z',
    },
    {
      id: '2',
      url: 'https://alistapart.com',
      title: 'A List Apart',
      domain: 'alistapart.com',
      description: 'Articles for web creators',
      collectionId: 'col_design',
      collectionName: 'Design Systems',
      isFavourite: false,
      createdAt: '2026-01-02T10:00:00.000Z',
    },
    {
      id: '3',
      url: 'https://designsystems.com',
      title: 'Design Systems Repo',
      domain: 'designsystems.com',
      description: 'Pattern libraries and style guides',
      collectionId: 'col_design',
      collectionName: 'Design Systems',
      isFavourite: true,
      createdAt: '2026-01-03T10:00:00.000Z',
    },
    {
      id: '4',
      url: 'https://wikipedia.org',
      title: 'General Reference',
      domain: 'wikipedia.org',
      description: 'Online encyclopedia',
      isFavourite: false,
      createdAt: '2026-01-04T10:00:00.000Z',
    },
  ];

  const filterBookmarks = (
    bookmarks: Bookmark[],
    searchQuery: string,
    selectedCollection: string,
    sortOption: SortOption
  ) => {
    const filtered = bookmarks.filter((b) => {
      const matchesSearch =
        b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.url.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (b.description && b.description.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesCollection =
        selectedCollection === 'all'
          ? true
          : selectedCollection === 'unassigned'
          ? !b.collectionId
          : b.collectionId === selectedCollection;

      return matchesSearch && matchesCollection;
    });

    return sortBookmarks(filtered, sortOption);
  };

  it('filters all bookmarks when collection is "all"', () => {
    const results = filterBookmarks(sampleBookmarks, '', 'all', 'newest');
    expect(results.length).toBe(4);
  });

  it('filters only unassigned bookmarks when collection is "unassigned"', () => {
    const results = filterBookmarks(sampleBookmarks, '', 'unassigned', 'newest');
    expect(results.length).toBe(1);
    expect(results[0].title).toBe('General Reference');
  });

  it('filters bookmarks matching a specific collection ID', () => {
    const designBookmarks = filterBookmarks(sampleBookmarks, '', 'col_design', 'newest');
    expect(designBookmarks.length).toBe(2);
    expect(designBookmarks.map((b) => b.id)).toEqual(['3', '2']);

    const techBookmarks = filterBookmarks(sampleBookmarks, '', 'col_tech', 'newest');
    expect(techBookmarks.length).toBe(1);
    expect(techBookmarks[0].id).toBe('1');
  });

  it('combines text search with collection filtering and sorting order', () => {
    // Search "Systems" inside "Design Systems" sorted A-Z
    const results = filterBookmarks(sampleBookmarks, 'Systems', 'col_design', 'title-asc');
    expect(results.length).toBe(1);
    expect(results[0].title).toBe('Design Systems Repo');

    // Search query that matches in title or description within collection
    const searchResult = filterBookmarks(sampleBookmarks, 'articles', 'col_design', 'newest');
    expect(searchResult.length).toBe(1);
    expect(searchResult[0].title).toBe('A List Apart');

    // Search query matching items outside the selected collection returns empty
    const noMatch = filterBookmarks(sampleBookmarks, 'React', 'col_design', 'newest');
    expect(noMatch.length).toBe(0);
  });

  it('correctly applies title sorting when filtering a collection', () => {
    const asc = filterBookmarks(sampleBookmarks, '', 'col_design', 'title-asc');
    expect(asc[0].title).toBe('A List Apart');
    expect(asc[1].title).toBe('Design Systems Repo');

    const desc = filterBookmarks(sampleBookmarks, '', 'col_design', 'title-desc');
    expect(desc[0].title).toBe('Design Systems Repo');
    expect(desc[1].title).toBe('A List Apart');
  });
});

import { describe, it, expect } from 'vitest';
import { filterBookmarks } from '../search';
import type { Bookmark, Collection, Tag } from '../../types';

describe('filterBookmarks (Unified Search Engine)', () => {
  const sampleCollections: Collection[] = [
    {
      id: 'col_dev',
      name: 'Engineering & Architecture',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'col_design',
      name: 'Design Systems',
      createdAt: '2026-01-02T00:00:00.000Z',
    },
    {
      id: 'col_reading',
      name: 'Longform Essays',
      createdAt: '2026-01-03T00:00:00.000Z',
    },
  ];

  const sampleTags: Tag[] = [
    { id: 'tag_react', name: 'React', createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'tag_frontend', name: 'Frontend', createdAt: '2026-01-02T00:00:00.000Z' },
    { id: 'tag_ui', name: 'UI/UX', createdAt: '2026-01-03T00:00:00.000Z' },
    { id: 'tag_css', name: 'Tailwind CSS', createdAt: '2026-01-04T00:00:00.000Z' },
  ];

  const sampleBookmarks: Bookmark[] = [
    {
      id: 'bm_1',
      url: 'https://react.dev/learn',
      title: 'Quick Start with React 19',
      domain: 'react.dev',
      description: 'Official interactive documentation and tutorial for modern web interfaces.',
      collectionId: 'col_dev',
      collectionName: 'Old Stale Collection Name', // Will test entity name preference
      tags: ['tag_react', 'tag_frontend'],
      isFavourite: true,
      createdAt: '2026-01-10T10:00:00.000Z',
    },
    {
      id: 'bm_2',
      url: 'https://alistapart.com/article/design-tokens-quick-reference',
      title: 'Design Tokens in Practice',
      domain: 'alistapart.com',
      description: 'Structuring scalable design systems with atomic design tokens.',
      collectionId: 'col_design',
      collectionName: 'Design Systems',
      tags: ['tag_ui', 'tag_css'],
      isFavourite: false,
      createdAt: '2026-01-11T10:00:00.000Z',
    },
    {
      id: 'bm_3',
      url: 'https://paulgraham.com/lesson.html',
      title: 'The Lessons of History',
      domain: 'paulgraham.com',
      description: 'An insightful reflective essay on technology and ambition.',
      collectionId: 'col_reading',
      collectionName: 'Longform Essays',
      tags: [],
      isFavourite: true,
      createdAt: '2026-01-12T10:00:00.000Z',
    },
    {
      id: 'bm_4',
      url: 'https://github.com/facebook/react',
      title: 'React Repository',
      domain: 'github.com',
      description: undefined,
      collectionId: undefined,
      collectionName: undefined,
      tags: ['tag_react'],
      isFavourite: false,
      createdAt: '2026-01-13T10:00:00.000Z',
    },
  ];

  // 1. Title matching
  it('matches bookmarks by title', () => {
    const results = filterBookmarks(sampleBookmarks, {
      query: 'Tokens in Practice',
      tags: sampleTags,
      collections: sampleCollections,
    });
    expect(results.length).toBe(1);
    expect(results[0].id).toBe('bm_2');
  });

  // 2. URL matching
  it('matches bookmarks by full URL or URL path', () => {
    const results = filterBookmarks(sampleBookmarks, {
      query: 'paulgraham.com/lesson',
      tags: sampleTags,
      collections: sampleCollections,
    });
    expect(results.length).toBe(1);
    expect(results[0].id).toBe('bm_3');
  });

  // 3. Domain matching
  it('matches bookmarks by explicit or derived domain', () => {
    const results = filterBookmarks(sampleBookmarks, {
      query: 'github.com',
      tags: sampleTags,
      collections: sampleCollections,
    });
    expect(results.length).toBe(1);
    expect(results[0].id).toBe('bm_4');
  });

  // 4. Description matching
  it('matches bookmarks by description / notes', () => {
    const results = filterBookmarks(sampleBookmarks, {
      query: 'interactive documentation',
      tags: sampleTags,
      collections: sampleCollections,
    });
    expect(results.length).toBe(1);
    expect(results[0].id).toBe('bm_1');
  });

  // 5. Tag-name matching
  it('matches bookmarks by resolved tag name', () => {
    const results = filterBookmarks(sampleBookmarks, {
      query: 'Tailwind CSS',
      tags: sampleTags,
      collections: sampleCollections,
    });
    expect(results.length).toBe(1);
    expect(results[0].id).toBe('bm_2');
  });

  // 6. Tag matching with '#' prefix
  it('matches tags with or without leading "#" prefix', () => {
    const withHash = filterBookmarks(sampleBookmarks, {
      query: '#react',
      tags: sampleTags,
      collections: sampleCollections,
    });
    expect(withHash.map((b) => b.id)).toEqual(['bm_1', 'bm_4']);

    const withoutHash = filterBookmarks(sampleBookmarks, {
      query: 'react',
      tags: sampleTags,
      collections: sampleCollections,
    });
    expect(withoutHash.map((b) => b.id)).toEqual(['bm_1', 'bm_4']);
  });

  it('does not match raw tag IDs when tags collection is omitted or unknown', () => {
    const results = filterBookmarks(sampleBookmarks, {
      query: 'tag_react',
      tags: [], // No tag entities provided to map IDs to names
      collections: sampleCollections,
    });
    expect(results.length).toBe(0);
  });

  // 7. Collection-name matching
  it('matches bookmarks by collection name, preferring the live collection entity name', () => {
    // col_dev entity name is "Engineering & Architecture", while bm_1.collectionName has stale "Old Stale Collection Name"
    const resultsEntity = filterBookmarks(sampleBookmarks, {
      query: 'Engineering',
      tags: sampleTags,
      collections: sampleCollections,
    });
    expect(resultsEntity.length).toBe(1);
    expect(resultsEntity[0].id).toBe('bm_1');

    // Searching stale collection name should not match when live entity overrides it
    const resultsStale = filterBookmarks(sampleBookmarks, {
      query: 'Old Stale',
      tags: sampleTags,
      collections: sampleCollections,
    });
    expect(resultsStale.length).toBe(0);
  });

  it('falls back to bookmark.collectionName if collection entity is not found in collections option', () => {
    const fallbackResults = filterBookmarks(sampleBookmarks, {
      query: 'Old Stale',
      tags: sampleTags,
      collections: [], // No collections provided
    });
    expect(fallbackResults.length).toBe(1);
    expect(fallbackResults[0].id).toBe('bm_1');
  });

  // 8. Case-insensitive matching
  it('performs case-insensitive matching across all fields', () => {
    const resultsUpper = filterBookmarks(sampleBookmarks, {
      query: 'QUICK START',
      tags: sampleTags,
      collections: sampleCollections,
    });
    const resultsLower = filterBookmarks(sampleBookmarks, {
      query: 'quick start',
      tags: sampleTags,
      collections: sampleCollections,
    });
    expect(resultsUpper).toEqual(resultsLower);
    expect(resultsUpper.length).toBe(1);
    expect(resultsUpper[0].id).toBe('bm_1');
  });

  // 9. Leading/trailing whitespace
  it('trims leading and trailing whitespace from the query', () => {
    const results = filterBookmarks(sampleBookmarks, {
      query: '   paulgraham.com   ',
      tags: sampleTags,
      collections: sampleCollections,
    });
    expect(results.length).toBe(1);
    expect(results[0].id).toBe('bm_3');
  });

  // 10. Multiple consecutive spaces
  it('normalizes multiple consecutive spaces into distinct search tokens', () => {
    const results = filterBookmarks(sampleBookmarks, {
      query: 'Tokens    Practice',
      tags: sampleTags,
      collections: sampleCollections,
    });
    expect(results.length).toBe(1);
    expect(results[0].id).toBe('bm_2');
  });

  // 11. Multi-word queries matching across different fields
  it('matches multi-word queries where tokens match different fields', () => {
    // "React" in title/tag, "documentation" in description, "Engineering" in collection
    const results = filterBookmarks(sampleBookmarks, {
      query: 'React tutorial Engineering',
      tags: sampleTags,
      collections: sampleCollections,
    });
    expect(results.length).toBe(1);
    expect(results[0].id).toBe('bm_1');
  });

  // 12. All-token requirement
  it('requires all query tokens to match (AND semantics)', () => {
    // "React" exists in bm_1 and bm_4, but "nonexistentword" does not exist anywhere
    const results = filterBookmarks(sampleBookmarks, {
      query: 'React nonexistentword',
      tags: sampleTags,
      collections: sampleCollections,
    });
    expect(results.length).toBe(0);
  });

  // 13. Empty query
  it('returns all bookmarks when query is empty, undefined, or whitespace only', () => {
    expect(filterBookmarks(sampleBookmarks, {})).toEqual(sampleBookmarks);
    expect(filterBookmarks(sampleBookmarks, { query: '' })).toEqual(sampleBookmarks);
    expect(filterBookmarks(sampleBookmarks, { query: '    ' })).toEqual(sampleBookmarks);
  });

  // 14. Missing optional fields
  it('handles missing or undefined optional fields safely without throwing', () => {
    const sparseBookmarks: Bookmark[] = [
      {
        id: 'bm_sparse',
        url: 'https://minimal.com',
        title: 'Minimal Entry',
        domain: '',
        description: undefined,
        collectionId: undefined,
        collectionName: undefined,
        tags: undefined,
        isFavourite: false,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ];

    expect(() => {
      const results = filterBookmarks(sparseBookmarks, {
        query: 'minimal',
        tags: undefined,
        collections: undefined,
      });
      expect(results.length).toBe(1);
    }).not.toThrow();

    expect(() => {
      const results = filterBookmarks(sparseBookmarks, {
        query: 'nonexistent',
      });
      expect(results.length).toBe(0);
    }).not.toThrow();
  });

  // 15. Combined collection and tag filters
  it('combines independent collection and tag filters correctly', () => {
    // Filter by collection 'col_dev'
    const devCol = filterBookmarks(sampleBookmarks, {
      collectionId: 'col_dev',
    });
    expect(devCol.length).toBe(1);
    expect(devCol[0].id).toBe('bm_1');

    // Filter by tag 'tag_react' (bm_1 and bm_4)
    const reactTag = filterBookmarks(sampleBookmarks, {
      tagId: 'tag_react',
    });
    expect(reactTag.map((b) => b.id)).toEqual(['bm_1', 'bm_4']);

    // Intersection: collection 'col_dev' AND tag 'tag_react'
    const devAndReact = filterBookmarks(sampleBookmarks, {
      collectionId: 'col_dev',
      tagId: 'tag_react',
    });
    expect(devAndReact.length).toBe(1);
    expect(devAndReact[0].id).toBe('bm_1');

    // Intersection with no match: collection 'col_reading' AND tag 'tag_react'
    const readingAndReact = filterBookmarks(sampleBookmarks, {
      collectionId: 'col_reading',
      tagId: 'tag_react',
    });
    expect(readingAndReact.length).toBe(0);
  });

  it('filters unassigned collection correctly', () => {
    const unassigned = filterBookmarks(sampleBookmarks, {
      collectionId: 'unassigned',
    });
    expect(unassigned.length).toBe(1);
    expect(unassigned[0].id).toBe('bm_4');
  });

  it('treats "all" as no filter for collectionId and tagId', () => {
    const allResults = filterBookmarks(sampleBookmarks, {
      collectionId: 'all',
      tagId: 'all',
    });
    expect(allResults.length).toBe(sampleBookmarks.length);
  });

  // 16. Search combined with both dropdown filters
  it('intersects text search with both collection and tag dropdown filters', () => {
    // bm_1 satisfies query "interactive" AND collection "col_dev" AND tag "tag_frontend"
    const resultsMatch = filterBookmarks(sampleBookmarks, {
      query: 'interactive',
      collectionId: 'col_dev',
      tagId: 'tag_frontend',
      tags: sampleTags,
      collections: sampleCollections,
    });
    expect(resultsMatch.length).toBe(1);
    expect(resultsMatch[0].id).toBe('bm_1');

    // If query doesn't match, entire filter fails even if collection and tag match
    const resultsNoMatch = filterBookmarks(sampleBookmarks, {
      query: 'design tokens',
      collectionId: 'col_dev',
      tagId: 'tag_frontend',
      tags: sampleTags,
      collections: sampleCollections,
    });
    expect(resultsNoMatch.length).toBe(0);
  });

  // 17. Original input array remains unchanged
  it('does not mutate the original bookmarks array', () => {
    const originalCopy = JSON.parse(JSON.stringify(sampleBookmarks));
    const results = filterBookmarks(sampleBookmarks, {
      query: 'React',
      collectionId: 'col_dev',
      tagId: 'tag_react',
      tags: sampleTags,
      collections: sampleCollections,
    });

    expect(results.length).toBe(1);
    expect(sampleBookmarks).toEqual(originalCopy);
    expect(results).not.toBe(sampleBookmarks);
  });

  // 18. Invalid or malformed inputs
  it('handles invalid or non-array inputs defensively', () => {
    expect(filterBookmarks(null as any)).toEqual([]);
    expect(filterBookmarks(undefined as any)).toEqual([]);
    expect(filterBookmarks('not-an-array' as any)).toEqual([]);
  });
});

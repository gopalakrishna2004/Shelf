import { describe, it, expect } from 'vitest';
import type { Bookmark } from '../../types';
import { sortBookmarks } from '../../lib/sorting';

describe('Tag Filtering & Sorting Logic', () => {
  const sampleBookmarks: Bookmark[] = [
    {
      id: 'bm-1',
      url: 'https://linear.app',
      title: 'Linear Issue Tracking',
      domain: 'linear.app',
      description: 'The issue tracking tool you will enjoy using',
      collectionId: 'col-tools',
      collectionName: 'Tools',
      tags: ['tag-design', 'tag-productivity'],
      isFavourite: true,
      createdAt: '2026-01-01T10:00:00.000Z',
    },
    {
      id: 'bm-2',
      url: 'https://rauno.me',
      title: 'Craft and Details',
      domain: 'rauno.me',
      description: 'Interaction design reflections',
      collectionId: 'col-reading',
      collectionName: 'Reading',
      tags: ['tag-design', 'tag-craft'],
      isFavourite: false,
      createdAt: '2026-01-02T10:00:00.000Z',
    },
    {
      id: 'bm-3',
      url: 'https://arxiv.org/abs/1706.03762',
      title: 'Attention Is All You Need',
      domain: 'arxiv.org',
      description: 'The Transformer architecture paper',
      collectionId: 'col-reading',
      collectionName: 'Reading',
      tags: ['tag-ai', 'tag-research'],
      isFavourite: true,
      createdAt: '2026-01-03T10:00:00.000Z',
    },
    {
      id: 'bm-4',
      url: 'https://news.ycombinator.com',
      title: 'Hacker News',
      domain: 'news.ycombinator.com',
      isFavourite: false,
      createdAt: '2026-01-04T10:00:00.000Z',
    },
  ];

  const filterBookmarks = (
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

  it('returns all bookmarks when selectedTag is "all"', () => {
    const results = filterBookmarks(sampleBookmarks, '', 'all', 'all');
    expect(results.length).toBe(4);
  });

  it('filters accurately by a specific tag', () => {
    const designResults = filterBookmarks(sampleBookmarks, '', 'all', 'tag-design');
    expect(designResults.length).toBe(2);
    expect(designResults.map((b) => b.id)).toEqual(['bm-1', 'bm-2']);

    const aiResults = filterBookmarks(sampleBookmarks, '', 'all', 'tag-ai');
    expect(aiResults.length).toBe(1);
    expect(aiResults[0].id).toBe('bm-3');
  });

  it('combines collection filter with tag filter', () => {
    // Both bm-1 and bm-2 have tag-design, but only bm-1 is in col-tools
    const toolsDesignResults = filterBookmarks(sampleBookmarks, '', 'col-tools', 'tag-design');
    expect(toolsDesignResults.length).toBe(1);
    expect(toolsDesignResults[0].id).toBe('bm-1');

    // bm-2 is in col-reading and has tag-design
    const readingDesignResults = filterBookmarks(sampleBookmarks, '', 'col-reading', 'tag-design');
    expect(readingDesignResults.length).toBe(1);
    expect(readingDesignResults[0].id).toBe('bm-2');
  });

  it('combines search query with tag filter', () => {
    const searchTagResults = filterBookmarks(sampleBookmarks, 'interaction', 'all', 'tag-design');
    expect(searchTagResults.length).toBe(1);
    expect(searchTagResults[0].id).toBe('bm-2');
  });

  it('returns empty array when no bookmarks match the requested tag', () => {
    const emptyResults = filterBookmarks(sampleBookmarks, '', 'all', 'tag-nonexistent');
    expect(emptyResults.length).toBe(0);
  });

  it('preserves sorting order within tag-filtered results', () => {
    const designResults = filterBookmarks(sampleBookmarks, '', 'all', 'tag-design');

    const newest = sortBookmarks(designResults, 'newest');
    expect(newest.map((b) => b.id)).toEqual(['bm-2', 'bm-1']);

    const oldest = sortBookmarks(designResults, 'oldest');
    expect(oldest.map((b) => b.id)).toEqual(['bm-1', 'bm-2']);

    const alphaAsc = sortBookmarks(designResults, 'title-asc');
    expect(alphaAsc.map((b) => b.id)).toEqual(['bm-2', 'bm-1']); // "Craft and Details" before "Linear Issue Tracking"
  });
});

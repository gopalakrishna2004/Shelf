import { describe, it, expect } from 'vitest';
import { sortBookmarks, safeGetTimestamp } from '../sorting';
import type { Bookmark } from '../../types';

describe('Bookmark Sorting Engine (src/lib/sorting.ts)', () => {
  const createMockBookmark = (
    id: string,
    title: string,
    createdAt: string | null | undefined
  ): Bookmark => ({
    id,
    title,
    url: `https://example.com/${id}`,
    domain: 'example.com',
    isFavourite: false,
    createdAt: createdAt as any,
  });

  const sampleBookmarks: Bookmark[] = [
    createMockBookmark('b1', 'Design Systems Guide', '2026-05-10T12:00:00.000Z'),
    createMockBookmark('b2', 'Apple Design Philosophy', '2026-01-01T00:00:00.000Z'),
    createMockBookmark('b3', 'Typography Fundamentals', '2026-11-15T09:30:00.000Z'),
    createMockBookmark('b4', 'Minimalist Architecture', '2026-08-20T18:00:00.000Z'),
  ];

  // 1. Newest First
  it('1. sorts bookmarks newest first (descending by createdAt)', () => {
    const sorted = sortBookmarks(sampleBookmarks, 'newest');
    expect(sorted.map((b) => b.id)).toEqual(['b3', 'b4', 'b1', 'b2']);
    expect(sorted[0].title).toBe('Typography Fundamentals'); // Nov 2026
    expect(sorted[sorted.length - 1].title).toBe('Apple Design Philosophy'); // Jan 2026
  });

  // 2. Oldest First
  it('2. sorts bookmarks oldest first (ascending by createdAt)', () => {
    const sorted = sortBookmarks(sampleBookmarks, 'oldest');
    expect(sorted.map((b) => b.id)).toEqual(['b2', 'b1', 'b4', 'b3']);
    expect(sorted[0].title).toBe('Apple Design Philosophy'); // Jan 2026
    expect(sorted[sorted.length - 1].title).toBe('Typography Fundamentals'); // Nov 2026
  });

  // 3. Title A→Z
  it('3. sorts bookmarks alphabetically A → Z (case-insensitive title)', () => {
    const sorted = sortBookmarks(sampleBookmarks, 'title-asc');
    expect(sorted.map((b) => b.title)).toEqual([
      'Apple Design Philosophy',
      'Design Systems Guide',
      'Minimalist Architecture',
      'Typography Fundamentals',
    ]);
  });

  // 4. Title Z→A
  it('4. sorts bookmarks alphabetically Z → A (case-insensitive title)', () => {
    const sorted = sortBookmarks(sampleBookmarks, 'title-desc');
    expect(sorted.map((b) => b.title)).toEqual([
      'Typography Fundamentals',
      'Minimalist Architecture',
      'Design Systems Guide',
      'Apple Design Philosophy',
    ]);
  });

  // 5. Invalid or missing timestamp fallbacks
  it('5. handles invalid, null, undefined, or malformed timestamps safely via safeGetTimestamp', () => {
    expect(safeGetTimestamp(null)).toBe(0);
    expect(safeGetTimestamp(undefined)).toBe(0);
    expect(safeGetTimestamp('')).toBe(0);
    expect(safeGetTimestamp('not-a-valid-date')).toBe(0);
    expect(safeGetTimestamp('2026-01-01T00:00:00.000Z')).toBeGreaterThan(0);

    const bookmarksWithInvalidDates: Bookmark[] = [
      createMockBookmark('valid_recent', 'Recent Valid', '2026-10-01T00:00:00.000Z'),
      createMockBookmark('invalid_date', 'Corrupted Date', 'invalid-timestamp-string'),
      createMockBookmark('null_date', 'Missing Date', null),
      createMockBookmark('valid_older', 'Older Valid', '2026-02-01T00:00:00.000Z'),
    ];

    const sortedNewest = sortBookmarks(bookmarksWithInvalidDates, 'newest');
    // Valid dates must come first in newest sort
    expect(sortedNewest[0].id).toBe('valid_recent');
    expect(sortedNewest[1].id).toBe('valid_older');
    // Items with timestamp 0 fall to the bottom and sort alphabetically by title
    expect(sortedNewest[2].id).toBe('invalid_date'); // "Corrupted Date"
    expect(sortedNewest[3].id).toBe('null_date'); // "Missing Date"
  });

  // 6. Deterministic ordering when timestamps or titles are equal
  it('6. provides deterministic secondary ordering when primary sort values are identical', () => {
    // Two bookmarks with identical timestamps: should tie-break alphabetically by title
    const sameTimestampBookmarks: Bookmark[] = [
      createMockBookmark('z_item', 'Zebra Patterns', '2026-06-01T00:00:00.000Z'),
      createMockBookmark('a_item', 'Alpha Patterns', '2026-06-01T00:00:00.000Z'),
    ];

    const newestSorted = sortBookmarks(sameTimestampBookmarks, 'newest');
    expect(newestSorted[0].title).toBe('Alpha Patterns');
    expect(newestSorted[1].title).toBe('Zebra Patterns');

    const oldestSorted = sortBookmarks(sameTimestampBookmarks, 'oldest');
    expect(oldestSorted[0].title).toBe('Alpha Patterns');
    expect(oldestSorted[1].title).toBe('Zebra Patterns');

    // Two bookmarks with identical titles: should tie-break newest-first by createdAt
    const sameTitleBookmarks: Bookmark[] = [
      createMockBookmark('older_same_title', 'Identical Title', '2026-01-01T00:00:00.000Z'),
      createMockBookmark('newer_same_title', 'Identical Title', '2026-09-01T00:00:00.000Z'),
    ];

    const titleAscSorted = sortBookmarks(sameTitleBookmarks, 'title-asc');
    expect(titleAscSorted[0].id).toBe('newer_same_title');
    expect(titleAscSorted[1].id).toBe('older_same_title');

    const titleDescSorted = sortBookmarks(sameTitleBookmarks, 'title-desc');
    expect(titleDescSorted[0].id).toBe('newer_same_title');
    expect(titleDescSorted[1].id).toBe('older_same_title');
  });

  // 7. Non-mutating contract
  it('7. confirms the input bookmarks array is never mutated', () => {
    const originalInput = [...sampleBookmarks];
    const originalOrder = originalInput.map((b) => b.id);

    const result = sortBookmarks(originalInput, 'newest');

    // Returned array is a new reference
    expect(result).not.toBe(originalInput);
    // Original input array order is untouched
    expect(originalInput.map((b) => b.id)).toEqual(originalOrder);
  });

  // 8. Empty and single-item boundary arrays
  it('8. cleanly handles empty and single-element arrays without error', () => {
    expect(sortBookmarks([], 'newest')).toEqual([]);
    expect(sortBookmarks([], 'title-asc')).toEqual([]);

    const single = [sampleBookmarks[0]];
    expect(sortBookmarks(single, 'oldest')).toEqual(single);
  });
});

import type { Bookmark, SortOption } from '../types';

/**
 * Safely parses a date string into milliseconds.
 * Returns 0 if the date string is missing, null, undefined, or invalid,
 * preventing NaN comparison anomalies.
 */
export function safeGetTimestamp(dateStr?: string | null): number {
  if (!dateStr || typeof dateStr !== 'string') return 0;
  const time = new Date(dateStr).getTime();
  return Number.isNaN(time) ? 0 : time;
}

/**
 * Sorts an array of bookmarks according to the provided SortOption.
 * Strictly non-mutating: returns a new sorted array and leaves the input array untouched.
 *
 * Supported options:
 * - 'newest': Most recently created bookmarks first (createdAt descending).
 * - 'oldest': Earliest created bookmarks first (createdAt ascending).
 * - 'title-asc': Alphabetical order A → Z (case-insensitive).
 * - 'title-desc': Alphabetical order Z → A (case-insensitive).
 */
export function sortBookmarks(bookmarks: Bookmark[], sortOption: SortOption): Bookmark[] {
  return [...bookmarks].sort((a, b) => {
    switch (sortOption) {
      case 'newest': {
        const timeA = safeGetTimestamp(a.createdAt);
        const timeB = safeGetTimestamp(b.createdAt);
        if (timeA !== timeB) {
          return timeB - timeA;
        }
        // Deterministic secondary sort: alphabetical
        return (a.title || '').localeCompare(b.title || '', undefined, {
          sensitivity: 'base',
          numeric: true,
        });
      }

      case 'oldest': {
        const timeA = safeGetTimestamp(a.createdAt);
        const timeB = safeGetTimestamp(b.createdAt);
        if (timeA !== timeB) {
          return timeA - timeB;
        }
        // Deterministic secondary sort: alphabetical
        return (a.title || '').localeCompare(b.title || '', undefined, {
          sensitivity: 'base',
          numeric: true,
        });
      }

      case 'title-asc': {
        const titleA = (a.title || '').trim();
        const titleB = (b.title || '').trim();
        const cmp = titleA.localeCompare(titleB, undefined, {
          sensitivity: 'base',
          numeric: true,
        });
        if (cmp !== 0) return cmp;
        // Deterministic secondary sort: newest first
        return safeGetTimestamp(b.createdAt) - safeGetTimestamp(a.createdAt);
      }

      case 'title-desc': {
        const titleA = (a.title || '').trim();
        const titleB = (b.title || '').trim();
        const cmp = titleB.localeCompare(titleA, undefined, {
          sensitivity: 'base',
          numeric: true,
        });
        if (cmp !== 0) return cmp;
        // Deterministic secondary sort: newest first
        return safeGetTimestamp(b.createdAt) - safeGetTimestamp(a.createdAt);
      }

      default:
        return 0;
    }
  });
}

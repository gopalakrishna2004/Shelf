import type { Bookmark, Collection, Tag } from '../types';
import { extractDomain } from './utils';

export interface FilterBookmarksOptions {
  query?: string;
  collectionId?: string;
  tagId?: string;
  tags?: Tag[];
  collections?: Collection[];
}

interface SearchableBookmark {
  title: string;
  url: string;
  domain: string;
  description: string;
  collectionName: string;
  tagNames: string[];
}

/**
 * Checks whether a single query token matches any of the bookmark's searchable fields.
 */
function matchesToken(token: string, searchable: SearchableBookmark): boolean {
  // 1. Direct substring match against text fields
  if (
    searchable.title.includes(token) ||
    searchable.url.includes(token) ||
    searchable.domain.includes(token) ||
    searchable.description.includes(token) ||
    searchable.collectionName.includes(token)
  ) {
    return true;
  }

  // 2. Tag name matching:
  // Supports tokens with or without the leading '#' prefix (e.g. '#design' or 'design').
  const strippedToken = token.startsWith('#') ? token.slice(1) : token;
  if (
    strippedToken &&
    searchable.tagNames.some(
      (tagName) =>
        tagName.includes(strippedToken) ||
        `#${tagName}`.includes(token)
    )
  ) {
    return true;
  }

  return false;
}

/**
 * Pure, reusable bookmark filtering engine.
 *
 * Filters bookmarks across multiple searchable fields (title, URL, domain,
 * description, assigned tag names, and collection name) and intersects with
 * independent collection and tag dropdown filters.
 *
 * Strictly non-mutating: returns a new array and leaves the input array untouched.
 */
export function filterBookmarks(
  bookmarks: Bookmark[],
  options: FilterBookmarksOptions = {}
): Bookmark[] {
  if (!bookmarks || !Array.isArray(bookmarks)) {
    return [];
  }

  const { query, collectionId, tagId, tags = [], collections = [] } = options;

  // 1. Normalize query tokens: trim whitespace, split on consecutive spaces, lowercase
  const rawQuery = (query || '').trim().toLowerCase();
  const tokens = rawQuery ? rawQuery.split(/\s+/).filter(Boolean) : [];

  // Pre-index collections and tags for O(1) lookups
  const collectionMap = new Map<string, string>();
  for (const c of collections) {
    if (c && c.id && c.name) {
      collectionMap.set(c.id, c.name.toLowerCase());
    }
  }

  const tagMap = new Map<string, string>();
  for (const t of tags) {
    if (t && t.id && t.name) {
      tagMap.set(t.id, t.name.toLowerCase());
    }
  }

  return bookmarks.filter((bookmark) => {
    if (!bookmark || typeof bookmark !== 'object') {
      return false;
    }

    // --- Independent Collection Filter ---
    if (collectionId && collectionId !== 'all') {
      if (collectionId === 'unassigned') {
        if (bookmark.collectionId) {
          return false;
        }
      } else if (bookmark.collectionId !== collectionId) {
        return false;
      }
    }

    // --- Independent Tag Filter ---
    if (tagId && tagId !== 'all') {
      if (!bookmark.tags || !Array.isArray(bookmark.tags) || !bookmark.tags.includes(tagId)) {
        return false;
      }
    }

    // --- Text Query Matching ---
    if (tokens.length === 0) {
      return true;
    }

    // Resolve current collection name (prefer collection entity, fall back to stored collectionName)
    let resolvedCollectionName = '';
    if (bookmark.collectionId && collectionMap.has(bookmark.collectionId)) {
      resolvedCollectionName = collectionMap.get(bookmark.collectionId) || '';
    } else if (bookmark.collectionName) {
      resolvedCollectionName = bookmark.collectionName.toLowerCase();
    }

    // Resolve tag names from Tag IDs (do not match raw tag IDs as tag names)
    const resolvedTagNames: string[] = [];
    if (Array.isArray(bookmark.tags)) {
      for (const id of bookmark.tags) {
        if (id && tagMap.has(id)) {
          resolvedTagNames.push(tagMap.get(id)!);
        }
      }
    }

    const searchable: SearchableBookmark = {
      title: (bookmark.title || '').toLowerCase(),
      url: (bookmark.url || '').toLowerCase(),
      domain: (bookmark.domain || extractDomain(bookmark.url || '') || '').toLowerCase(),
      description: (bookmark.description || '').toLowerCase(),
      collectionName: resolvedCollectionName,
      tagNames: resolvedTagNames,
    };

    // All query tokens must match somewhere in the bookmark's searchable fields
    return tokens.every((token) => matchesToken(token, searchable));
  });
}

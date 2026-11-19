/**
 * Tag Navigation & Pending Selection Service
 *
 * Bridges the gap during cross-page navigation between TagsPage and AllBookmarksPage.
 * Because navigation causes AllBookmarksPage to mount asynchronously (after the route
 * state update), synchronous DOM custom events dispatched during the click handler
 * are missed by unmounted listeners.
 *
 * This module reliably preserves the selected tag ID across the transition
 * and allows AllBookmarksPage to consume it upon mounting without introducing
 * any second, competing filter state.
 */

const STORAGE_KEY = 'shelf-pending-tag-id';

let memoryPendingTagId: string | null = null;

/**
 * Stores the pending tag ID to be applied upon navigating to All Bookmarks.
 */
export function setPendingTagId(tagId: string | null): void {
  memoryPendingTagId = tagId;

  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      if (tagId) {
        window.sessionStorage.setItem(STORAGE_KEY, tagId);
      } else {
        window.sessionStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // Graceful fallback if sessionStorage is restricted or disabled
    }
  }
}

/**
 * Returns the currently pending tag ID without consuming it.
 */
export function getPendingTagId(): string | null {
  if (memoryPendingTagId) {
    return memoryPendingTagId;
  }

  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      return window.sessionStorage.getItem(STORAGE_KEY);
    } catch {
      // Ignore
    }
  }

  return null;
}

/**
 * Consumes and clears the pending tag ID.
 * Returns the tag ID that was pending, or null if none was set.
 */
export function consumePendingTagId(): string | null {
  const current = getPendingTagId();
  clearPendingTagId();
  return current;
}

/**
 * Clears the pending tag ID from both memory and sessionStorage.
 */
export function clearPendingTagId(): void {
  memoryPendingTagId = null;

  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      window.sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore
    }
  }
}

// Global listener: If any component dispatches 'shelf-select-tag' while AllBookmarksPage
// is unmounted, capture and store it as a pending selection automatically.
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('shelf-select-tag', ((e: Event) => {
    const customEvent = e as CustomEvent<{ tagId?: string }>;
    if (customEvent.detail?.tagId) {
      setPendingTagId(customEvent.detail.tagId);
    }
  }) as EventListener);
}

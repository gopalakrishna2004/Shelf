/**
 * Collection Navigation & Pending Selection Service
 *
 * Bridges the gap during cross-page navigation between CollectionsPage/Sidebar
 * and AllBookmarksPage.
 *
 * Because navigation causes AllBookmarksPage to mount asynchronously (after the route
 * state update), synchronous DOM custom events dispatched during the click handler
 * can be missed by unmounted listeners.
 *
 * This module reliably preserves the selected collection ID across the transition
 * and allows AllBookmarksPage to consume it upon mounting without introducing
 * any second, competing filter state.
 */

const STORAGE_KEY = 'shelf-pending-collection-id';

let memoryPendingCollectionId: string | null = null;

/**
 * Stores the pending collection ID to be applied upon navigating to All Bookmarks.
 */
export function setPendingCollectionId(collectionId: string | null): void {
  memoryPendingCollectionId = collectionId;

  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      if (collectionId) {
        window.sessionStorage.setItem(STORAGE_KEY, collectionId);
      } else {
        window.sessionStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // Graceful fallback if sessionStorage is restricted or disabled
    }
  }
}

/**
 * Returns the currently pending collection ID without consuming it.
 */
export function getPendingCollectionId(): string | null {
  if (memoryPendingCollectionId) {
    return memoryPendingCollectionId;
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
 * Consumes and clears the pending collection ID.
 * Returns the collection ID that was pending, or null if none was set.
 */
export function consumePendingCollectionId(): string | null {
  const current = getPendingCollectionId();
  clearPendingCollectionId();
  return current;
}

/**
 * Clears the pending collection ID from both memory and sessionStorage.
 */
export function clearPendingCollectionId(): void {
  memoryPendingCollectionId = null;

  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      window.sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore
    }
  }
}

// Global listener: If any component dispatches 'shelf-select-collection' while AllBookmarksPage
// is unmounted, capture and store it as a pending selection automatically.
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('shelf-select-collection', ((e: Event) => {
    const customEvent = e as CustomEvent<{ collectionId?: string }>;
    if (customEvent.detail?.collectionId) {
      setPendingCollectionId(customEvent.detail.collectionId);
    }
  }) as EventListener);
}

/**
 * Search Navigation & State Survival Service
 *
 * Manages active and pending search queries across cross-page transitions,
 * component unmounts, and browser refreshes.
 *
 * Designed to provide persistent and predictable search state across All Bookmarks
 * and Favourites, seamless query submission from Home, and clean resets.
 */

const ACTIVE_SEARCH_KEY = 'shelf-active-search-query';
const PENDING_SEARCH_KEY = 'shelf-pending-search-query';

let memoryActiveSearchQuery = '';
let memoryPendingSearchQuery: string | null = null;

/**
 * Returns the currently active search query from memory or sessionStorage.
 */
export function getActiveSearchQuery(): string {
  if (memoryActiveSearchQuery) {
    return memoryActiveSearchQuery;
  }

  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      const stored = window.sessionStorage.getItem(ACTIVE_SEARCH_KEY);
      if (stored) {
        memoryActiveSearchQuery = stored;
        return stored;
      }
    } catch {
      // Ignore
    }
  }

  return '';
}

/**
 * Sets the active search query in memory and sessionStorage,
 * and notifies listeners.
 */
export function setActiveSearchQuery(query: string): void {
  const normalized = (query || '').trim();
  memoryActiveSearchQuery = normalized;

  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      if (normalized) {
        window.sessionStorage.setItem(ACTIVE_SEARCH_KEY, normalized);
      } else {
        window.sessionStorage.removeItem(ACTIVE_SEARCH_KEY);
      }
    } catch {
      // Ignore
    }
  }

  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(
      new CustomEvent('shelf-search-query-change', { detail: { query: normalized } })
    );
  }
}

/**
 * Clears the active search query.
 */
export function clearActiveSearchQuery(): void {
  setActiveSearchQuery('');
}

/**
 * Sets a pending search query to survive upcoming navigation (e.g. from Home).
 */
export function setPendingSearchQuery(query: string | null): void {
  const normalized = query ? query.trim() : null;
  memoryPendingSearchQuery = normalized;

  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      if (normalized) {
        window.sessionStorage.setItem(PENDING_SEARCH_KEY, normalized);
      } else {
        window.sessionStorage.removeItem(PENDING_SEARCH_KEY);
      }
    } catch {
      // Ignore
    }
  }
}

/**
 * Returns the pending search query without consuming it.
 */
export function getPendingSearchQuery(): string | null {
  if (memoryPendingSearchQuery !== null) {
    return memoryPendingSearchQuery;
  }

  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      return window.sessionStorage.getItem(PENDING_SEARCH_KEY);
    } catch {
      // Ignore
    }
  }

  return null;
}

/**
 * Consumes and clears the pending search query.
 */
export function consumePendingSearchQuery(): string | null {
  const current = getPendingSearchQuery();
  clearPendingSearchQuery();
  return current;
}

/**
 * Clears the pending search query.
 */
export function clearPendingSearchQuery(): void {
  memoryPendingSearchQuery = null;

  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      window.sessionStorage.removeItem(PENDING_SEARCH_KEY);
    } catch {
      // Ignore
    }
  }
}

// Global listener for cross-component triggers
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('shelf-set-search-query', ((e: Event) => {
    const customEvent = e as CustomEvent<{ query?: string }>;
    if (customEvent.detail?.query !== undefined) {
      const q = customEvent.detail.query;
      setActiveSearchQuery(q);
      setPendingSearchQuery(q);
    }
  }) as EventListener);
}

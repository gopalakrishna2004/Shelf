import { useState, useEffect, useCallback } from 'react';

export const SIDEBAR_COLLAPSED_STORAGE_KEY = 'shelf-sidebar-collapsed-preference';

/**
 * Reads the persisted sidebar collapse preference from localStorage.
 * Defaults to false (expanded mode).
 */
export function getStoredSidebarCollapsed(): boolean {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const stored = localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY);
      if (stored !== null) {
        return stored === 'true';
      }
    }
  } catch {
    // Defensive fallback against blocked storage
  }
  return false; // Default to expanded mode
}

/**
 * Persists the sidebar collapse preference to localStorage and broadcasts the change.
 * Event dispatch is deferred via queueMicrotask to prevent re-entrant React state collisions.
 */
export function setStoredSidebarCollapsed(collapsed: boolean): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(collapsed));
      // Dispatch asynchronously to avoid interrupting active React render/state updater loops
      if (typeof queueMicrotask === 'function') {
        queueMicrotask(() => {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(
              new CustomEvent('shelf-sidebar-collapse-change', { detail: { collapsed } })
            );
          }
        });
      } else {
        window.dispatchEvent(
          new CustomEvent('shelf-sidebar-collapse-change', { detail: { collapsed } })
        );
      }
    }
  } catch {
    // Defensive fallback
  }
}

export function useSidebarCollapse() {
  const [isCollapsed, setIsCollapsedState] = useState<boolean>(getStoredSidebarCollapsed);

  const setIsCollapsed = useCallback((collapsed: boolean) => {
    setIsCollapsedState(collapsed);
    setStoredSidebarCollapsed(collapsed);
  }, []);

  const toggleSidebar = useCallback(() => {
    setIsCollapsedState((prev) => {
      const next = !prev;
      setStoredSidebarCollapsed(next);
      return next;
    });
  }, []);

  useEffect(() => {
    const handleSync = (e: Event) => {
      const customEvent = e as CustomEvent<{ collapsed?: boolean }>;
      const next = customEvent.detail?.collapsed !== undefined
        ? customEvent.detail.collapsed
        : getStoredSidebarCollapsed();

      setIsCollapsedState((current) => (current === next ? current : next));
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('shelf-sidebar-collapse-change', handleSync);
      window.addEventListener('storage', handleSync);
      return () => {
        window.removeEventListener('shelf-sidebar-collapse-change', handleSync);
        window.removeEventListener('storage', handleSync);
      };
    }
  }, []);

  return {
    isCollapsed,
    setIsCollapsed,
    toggleSidebar,
  };
}

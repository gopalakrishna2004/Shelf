import { useState, useEffect } from 'react';
import type { ViewMode, SortOption } from '../types';

const VIEW_STORAGE_KEY = 'shelf-view-mode-preference';

export function useBookmarksView() {
  const [viewMode, setViewModeState] = useState<ViewMode>(() => {
    try {
      const saved = localStorage.getItem(VIEW_STORAGE_KEY) as ViewMode | null;
      if (saved === 'grid' || saved === 'list') {
        return saved;
      }
    } catch {
      // Ignore localStorage errors
    }
    return 'grid';
  });

  const [sortOption, setSortOption] = useState<SortOption>('newest');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCollection, setSelectedCollection] = useState<string>('all');

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, viewMode);
    } catch {
      // Ignore
    }
  }, [viewMode]);

  return {
    viewMode,
    setViewMode: setViewModeState,
    sortOption,
    setSortOption,
    searchQuery,
    setSearchQuery,
    selectedCollection,
    setSelectedCollection,
  };
}

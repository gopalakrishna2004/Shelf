import React, { useState, useMemo, useEffect } from 'react';
import { Star, Search, ArrowUpDown, X } from 'lucide-react';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { ViewModeSwitcher } from '../components/ui/ViewModeSwitcher';
import { BookmarkEmptyState } from '../components/bookmark/BookmarkEmptyState';
import { BookmarkCard } from '../components/bookmark/BookmarkCard';
import { Badge } from '../components/ui/Badge';
import { useBookmarks } from '../context/BookmarkContext';
import { useCollections } from '../context/CollectionContext';
import { useTags } from '../context/TagContext';
import { sortBookmarks } from '../lib/sorting';
import { filterBookmarks } from '../lib/search';
import { getActiveSearchQuery, setActiveSearchQuery } from '../lib/searchNavigation';
import type { ViewMode, SortOption, PageId } from '../types';

export interface FavouritesPageProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onNavigate: (page: PageId, id?: string) => void;
  searchQuery?: string;
  onSearchQueryChange?: (query: string) => void;
}

export const FavouritesPage: React.FC<FavouritesPageProps> = ({
  viewMode,
  onViewModeChange,
  onNavigate,
  searchQuery: propSearchQuery,
  onSearchQueryChange,
}) => {
  const { bookmarks } = useBookmarks();
  const { collections } = useCollections();
  const { tags } = useTags();

  const [sortOption, setSortOption] = useState<SortOption>('newest');
  const [localSearchQuery, setLocalSearchQuery] = useState<string>(() => {
    return propSearchQuery ?? getActiveSearchQuery() ?? '';
  });

  const searchQuery = propSearchQuery !== undefined ? propSearchQuery : localSearchQuery;

  const handleSearchQueryChange = (val: string) => {
    setLocalSearchQuery(val);
    if (onSearchQueryChange) {
      onSearchQueryChange(val);
    } else {
      setActiveSearchQuery(val);
    }
  };

  useEffect(() => {
    const handleSearchEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ query?: string }>;
      if (customEvent.detail?.query !== undefined) {
        handleSearchQueryChange(customEvent.detail.query);
      }
    };
    window.addEventListener('shelf-search-query-change', handleSearchEvent);
    return () => window.removeEventListener('shelf-search-query-change', handleSearchEvent);
  }, []);

  const favouriteBookmarks = useMemo(
    () => bookmarks.filter((b) => b.isFavourite),
    [bookmarks]
  );

  const displayedFavourites = useMemo(() => {
    const filtered = filterBookmarks(favouriteBookmarks, {
      query: searchQuery,
      tags,
      collections,
    });
    return sortBookmarks(filtered, sortOption);
  }, [favouriteBookmarks, searchQuery, tags, collections, sortOption]);

  const sortOptions = [
    { value: 'newest', label: 'Newest first' },
    { value: 'oldest', label: 'Oldest first' },
    { value: 'title-asc', label: 'Title (A–Z)' },
    { value: 'title-desc', label: 'Title (Z–A)' },
  ];

  return (
    <div className="space-y-6 py-2">
      {/* Header */}
      <div className="flex items-end justify-between pb-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <h1 className="font-editorial text-3xl sm:text-4xl font-medium tracking-tight text-shelf-dark dark:text-shelf-ivory flex items-center gap-3">
              <span className="p-1.5 rounded-[12px] bg-shelf-terracottaMuted border border-shelf-terracotta/20 flex items-center justify-center shadow-xs">
                <Star className="w-6 h-6 text-shelf-terracotta fill-shelf-terracotta" />
              </span>
              Favourites
            </h1>
            <Badge variant="accent" className="font-mono text-xs">
              {favouriteBookmarks.length}
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-shelf-muted dark:text-shelf-mutedDark leading-relaxed">
            Your most essential essays, references, and daily tools kept within immediate reach.
          </p>
        </div>
      </div>

      {/* Floating Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-2.5 bg-white dark:bg-shelf-surfaceDark border border-shelf-borderLight/80 dark:border-shelf-borderDark/80 rounded-[18px] shadow-[0_4px_20px_rgba(36,35,33,0.03)] dark:shadow-[0_6px_24px_rgba(0,0,0,0.3)]">
        <div className="flex-1 max-w-md">
          <Input
            icon={<Search className="w-4 h-4 text-shelf-terracotta" />}
            type="search"
            placeholder="Search within favourites..."
            value={searchQuery}
            onChange={(e) => handleSearchQueryChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape' && searchQuery) {
                e.preventDefault();
                handleSearchQueryChange('');
              }
            }}
            rightElement={
              searchQuery ? (
                <button
                  type="button"
                  onClick={() => handleSearchQueryChange('')}
                  aria-label="Clear search"
                  className="p-1 rounded-full text-shelf-muted dark:text-shelf-mutedDark hover:text-shelf-dark dark:hover:text-shelf-ivory hover:bg-shelf-stone/20 dark:hover:bg-white/10 transition-colors focus-ring"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              ) : undefined
            }
            className="border-transparent bg-shelf-surfaceSubtle dark:bg-shelf-dark text-xs py-2 rounded-[12px]"
          />
        </div>

        <div className="flex items-center gap-2 pr-1">
          <Select
            id="favourites-sort-select"
            label="Sort favourites"
            icon={<ArrowUpDown className="w-3.5 h-3.5" />}
            options={sortOptions}
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value as SortOption)}
          />
          <ViewModeSwitcher viewMode={viewMode} onChange={onViewModeChange} />
        </div>
      </div>

      {/* Active Search Filter Indicator */}
      {searchQuery && (
        <div className="flex items-center gap-2 flex-wrap pt-1 text-xs">
          <span className="text-[11px] font-mono text-shelf-muted dark:text-shelf-mutedDark">
            Active filters:
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-shelf-stone/20 dark:bg-shelf-surfaceDark text-shelf-dark dark:text-shelf-ivory border border-shelf-borderLight dark:border-shelf-borderDark text-xs font-medium">
            <span>Query: "{searchQuery}"</span>
            <button
              type="button"
              onClick={() => handleSearchQueryChange('')}
              className="hover:bg-shelf-stone/40 rounded-full p-0.5"
              title="Clear query"
              aria-label="Clear query"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
          <button
            type="button"
            onClick={() => handleSearchQueryChange('')}
            className="text-[11px] text-shelf-terracotta hover:underline font-medium ml-1"
          >
            Clear
          </button>
        </div>
      )}

      {/* Content Area */}
      {displayedFavourites.length === 0 ? (
        (() => {
          if (favouriteBookmarks.length === 0) {
            return (
              <BookmarkEmptyState
                type="favourites"
                actionLabel="Browse All Bookmarks"
                onAction={() => onNavigate('all')}
              />
            );
          }

          return (
            <BookmarkEmptyState
              type="search"
              title="No matching favourites found"
              description={`None of your starred bookmarks match "${searchQuery}".`}
              actionLabel="Clear search"
              onAction={() => handleSearchQueryChange('')}
            />
          );
        })()
      ) : (
        <div
          className={
            viewMode === 'grid'
              ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
              : "flex flex-col gap-3"
          }
        >
          {displayedFavourites.map((bookmark) => (
            <BookmarkCard
              key={bookmark.id}
              bookmark={bookmark}
              viewMode={viewMode}
            />
          ))}
        </div>
      )}
    </div>
  );
};

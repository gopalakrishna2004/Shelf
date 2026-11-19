import React, { useState, useMemo, useEffect } from 'react';
import { Search, Filter, ArrowUpDown, Tag as TagIcon, X } from 'lucide-react';
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
import { getActiveSearchQuery, setActiveSearchQuery, consumePendingSearchQuery } from '../lib/searchNavigation';
import type { ViewMode, SortOption } from '../types';

export interface AllBookmarksPageProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onOpenQuickAdd?: () => void;
  initialTagId?: string;
  searchQuery?: string;
  onSearchQueryChange?: (query: string) => void;
}

export const AllBookmarksPage: React.FC<AllBookmarksPageProps> = ({
  viewMode,
  onViewModeChange,
  onOpenQuickAdd,
  initialTagId,
  searchQuery: propSearchQuery,
  onSearchQueryChange,
}) => {
  const { bookmarks } = useBookmarks();
  const { collections } = useCollections();
  const { tags, isLoading: isTagsLoading } = useTags();

  const [localSearchQuery, setLocalSearchQuery] = useState<string>(() => {
    return propSearchQuery ?? consumePendingSearchQuery() ?? getActiveSearchQuery() ?? '';
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

  const [sortOption, setSortOption] = useState<SortOption>('newest');
  const [selectedCollection, setSelectedCollection] = useState<string>('all');
  const [selectedTag, setSelectedTag] = useState<string>(() => {
    return initialTagId || 'all';
  });

  // Support incoming search events or pending search queries
  useEffect(() => {
    const pending = consumePendingSearchQuery();
    if (pending !== null) {
      handleSearchQueryChange(pending);
    }

    const handleSearchEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ query?: string }>;
      if (customEvent.detail?.query !== undefined) {
        handleSearchQueryChange(customEvent.detail.query);
      }
    };
    window.addEventListener('shelf-search-query-change', handleSearchEvent);
    return () => window.removeEventListener('shelf-search-query-change', handleSearchEvent);
  }, []);

  // Safeguard: If active collection was deleted, reset filter to 'all'
  useEffect(() => {
    if (selectedCollection !== 'all' && selectedCollection !== 'unassigned') {
      const exists = collections.some((c) => c.id === selectedCollection);
      if (!exists) {
        setSelectedCollection('all');
      }
    }
  }, [collections, selectedCollection]);

  // Safeguard: If active tag was deleted, reset filter to 'all'
  useEffect(() => {
    if (isTagsLoading) return;
    if (selectedTag !== 'all') {
      const exists = tags.some((t) => t.id === selectedTag);
      if (!exists) {
        setSelectedTag('all');
      }
    }
  }, [tags, selectedTag, isTagsLoading]);

  // Dynamically constructed collection options with accurate bookmark counts
  const collectionOptions = useMemo(() => {
    const unassignedCount = bookmarks.filter((b) => !b.collectionId).length;
    const options = [
      { value: 'all', label: `All Shelves (${bookmarks.length})` },
      { value: 'unassigned', label: `Unassigned (${unassignedCount})` },
    ];

    collections.forEach((col) => {
      const count = bookmarks.filter((b) => b.collectionId === col.id).length;
      options.push({
        value: col.id,
        label: `${col.name} (${count})`,
      });
    });

    return options;
  }, [collections, bookmarks]);

  // Dynamically constructed tag options with accurate bookmark counts
  const tagOptions = useMemo(() => {
    const options = [
      { value: 'all', label: `All Tags (${tags.length})` },
    ];

    tags.forEach((t) => {
      const count = bookmarks.filter((b) => b.tags?.includes(t.id)).length;
      options.push({
        value: t.id,
        label: `#${t.name} (${count})`,
      });
    });

    return options;
  }, [tags, bookmarks]);

  // Filtered and sorted bookmarks
  const displayedBookmarks = useMemo(() => {
    const filtered = filterBookmarks(bookmarks, {
      query: searchQuery,
      collectionId: selectedCollection,
      tagId: selectedTag,
      tags,
      collections,
    });

    return sortBookmarks(filtered, sortOption);
  }, [bookmarks, searchQuery, selectedCollection, selectedTag, tags, collections, sortOption]);

  const sortOptions = [
    { value: 'newest', label: 'Newest first' },
    { value: 'oldest', label: 'Oldest first' },
    { value: 'title-asc', label: 'Title (A → Z)' },
    { value: 'title-desc', label: 'Title (Z → A)' },
  ];

  const hasActiveFilters = Boolean(
    searchQuery || selectedCollection !== 'all' || selectedTag !== 'all'
  );

  const activeTagObj = tags.find((t) => t.id === selectedTag);
  const activeCollectionObj = collections.find((c) => c.id === selectedCollection);

  return (
    <div className="space-y-6 py-2">
      {/* Page Header */}
      <div className="flex items-end justify-between pb-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <h1 className="font-editorial text-3xl sm:text-4xl font-medium tracking-tight text-shelf-dark dark:text-shelf-ivory">
              All <span className="text-shelf-terracotta italic font-serif">Bookmarks</span>
            </h1>
            <Badge variant="accent" className="font-mono text-xs">
              {bookmarks.length}
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-shelf-muted dark:text-shelf-mutedDark leading-relaxed">
            The complete, permanent index of your saved links, essays, and references.
          </p>
        </div>
      </div>

      {/* Floating Tactile Desktop Toolbar */}
      <div className="flex flex-col xl:flex-row items-stretch xl:items-center gap-3 p-2.5 bg-white dark:bg-shelf-surfaceDark border border-shelf-borderLight/80 dark:border-shelf-borderDark/80 rounded-[18px] shadow-[0_4px_20px_rgba(36,35,33,0.03)] dark:shadow-[0_6px_24px_rgba(0,0,0,0.3)]">
        {/* Search Field (flex-1) */}
        <div className="flex-1 min-w-[200px]">
          <Input
            icon={<Search className="w-4 h-4 text-shelf-terracotta" />}
            type="search"
            placeholder="Search by title, domain, notes, or tags..."
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

        {/* Controls Container */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* Collection Filter Dropdown */}
          <Select
            id="collection-filter-select"
            label="Filter by collection"
            icon={<Filter className="w-3.5 h-3.5 text-shelf-terracotta" />}
            options={collectionOptions}
            value={selectedCollection}
            onChange={(e) => setSelectedCollection(e.target.value)}
          />

          {/* Tag Filter Dropdown */}
          <Select
            id="tag-filter-select"
            label="Filter by tag"
            icon={<TagIcon className="w-3.5 h-3.5 text-shelf-terracotta" />}
            options={tagOptions}
            value={selectedTag}
            onChange={(e) => setSelectedTag(e.target.value)}
          />

          {/* Sort Order Dropdown */}
          <Select
            id="sort-order-select"
            label="Sort bookmarks order"
            icon={<ArrowUpDown className="w-3.5 h-3.5" />}
            options={sortOptions}
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value as SortOption)}
          />

          {/* View Mode Switcher */}
          <div className="pl-1">
            <ViewModeSwitcher viewMode={viewMode} onChange={onViewModeChange} />
          </div>
        </div>
      </div>

      {/* Active Filter Indicators Bar */}
      {hasActiveFilters && (
        <div className="flex items-center gap-2 flex-wrap pt-1 text-xs">
          <span className="text-[11px] font-mono text-shelf-muted dark:text-shelf-mutedDark">
            Active filters:
          </span>
          {selectedCollection !== 'all' && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-shelf-terracottaMuted text-shelf-terracotta border border-shelf-terracotta/20 text-xs font-medium">
              <span>Shelf: {selectedCollection === 'unassigned' ? 'Unassigned' : (activeCollectionObj?.name || selectedCollection)}</span>
              <button
                type="button"
                onClick={() => setSelectedCollection('all')}
                className="hover:bg-shelf-terracotta/15 rounded-full p-0.5"
                title="Clear shelf filter"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {selectedTag !== 'all' && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-shelf-terracottaMuted text-shelf-terracotta border border-shelf-terracotta/20 text-xs font-medium">
              <span>Tag: #{activeTagObj?.name || selectedTag}</span>
              <button
                type="button"
                onClick={() => setSelectedTag('all')}
                className="hover:bg-shelf-terracotta/15 rounded-full p-0.5"
                title="Clear tag filter"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {searchQuery && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-shelf-stone/20 dark:bg-shelf-surfaceDark text-shelf-dark dark:text-shelf-ivory border border-shelf-borderLight dark:border-shelf-borderDark text-xs font-medium">
              <span>Query: "{searchQuery}"</span>
              <button
                type="button"
                onClick={() => handleSearchQueryChange('')}
                className="hover:bg-shelf-stone/40 rounded-full p-0.5"
                title="Clear query"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          <button
            type="button"
            onClick={() => {
              handleSearchQueryChange('');
              setSelectedCollection('all');
              setSelectedTag('all');
            }}
            className="text-[11px] text-shelf-terracotta hover:underline font-medium ml-1"
          >
            Reset all
          </button>
        </div>
      )}

      {/* Content Area */}
      {displayedBookmarks.length === 0 ? (
        (() => {
          if (bookmarks.length === 0) {
            return (
              <BookmarkEmptyState
                type="all"
                actionLabel="Add your first link"
                onAction={() => {
                  if (onOpenQuickAdd) onOpenQuickAdd();
                  else window.dispatchEvent(new Event('shelf-open-quick-add'));
                }}
              />
            );
          }

          if (searchQuery && (selectedCollection !== 'all' || selectedTag !== 'all')) {
            return (
              <BookmarkEmptyState
                type="search"
                title="No matching bookmarks found"
                description={`No bookmarks match "${searchQuery}" with the active collection and tag filters.`}
                actionLabel="Reset all filters"
                onAction={() => {
                  handleSearchQueryChange('');
                  setSelectedCollection('all');
                  setSelectedTag('all');
                }}
              />
            );
          }

          if (searchQuery) {
            return (
              <BookmarkEmptyState
                type="search"
                title="No matching bookmarks found"
                description={`No bookmarks in your library match "${searchQuery}". Try a different search term or clear the search query.`}
                actionLabel="Clear search"
                onAction={() => handleSearchQueryChange('')}
              />
            );
          }

          const filterType =
            selectedCollection !== 'all' && selectedTag !== 'all'
              ? 'collection and tag'
              : selectedCollection !== 'all'
              ? 'collection'
              : 'tag';

          return (
            <BookmarkEmptyState
              type="search"
              title="No bookmarks in this filter"
              description={`There are no bookmarks currently matching the selected ${filterType} filter.`}
              actionLabel="Clear filters"
              onAction={() => {
                setSelectedCollection('all');
                setSelectedTag('all');
              }}
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
          {displayedBookmarks.map((bookmark) => (
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

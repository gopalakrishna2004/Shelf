import React, { useState, useMemo, useEffect } from 'react';
import {
  Folder,
  Search,
  ArrowUpDown,
  ArrowLeft,
  Plus,
  X,
  Layers,
} from 'lucide-react';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Button } from '../components/ui/Button';
import { ViewModeSwitcher } from '../components/ui/ViewModeSwitcher';
import { BookmarkEmptyState } from '../components/bookmark/BookmarkEmptyState';
import { BookmarkCard } from '../components/bookmark/BookmarkCard';
import { Badge } from '../components/ui/Badge';
import { useBookmarks } from '../context/BookmarkContext';
import { useCollections } from '../context/CollectionContext';
import { useTags } from '../context/TagContext';
import { sortBookmarks } from '../lib/sorting';
import { filterBookmarks } from '../lib/search';
import type { ViewMode, SortOption, PageId } from '../types';

export interface CollectionDetailPageProps {
  collectionId: string;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onNavigate: (page: PageId, id?: string) => void;
}

export const CollectionDetailPage: React.FC<CollectionDetailPageProps> = ({
  collectionId,
  viewMode,
  onViewModeChange,
  onNavigate,
}) => {
  const { bookmarks } = useBookmarks();
  const { collections, isLoading: isCollectionsLoading } = useCollections();
  const { tags } = useTags();

  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState<SortOption>('newest');

  // Find the active collection in live state
  const currentCollection = useMemo(
    () => collections.find((c) => c.id === collectionId),
    [collections, collectionId]
  );

  // Graceful redirection if collection was deleted
  useEffect(() => {
    if (!isCollectionsLoading && collections.length > 0 && !currentCollection) {
      onNavigate('collections');
    }
  }, [currentCollection, collections, isCollectionsLoading, onNavigate]);

  // All bookmarks belonging strictly to this collection
  const collectionBookmarks = useMemo(
    () => bookmarks.filter((b) => b.collectionId === collectionId),
    [bookmarks, collectionId]
  );

  // Filter within this collection's bookmarks
  const displayedBookmarks = useMemo(() => {
    const filtered = filterBookmarks(collectionBookmarks, {
      query: searchQuery,
      tags,
      collections,
    });
    return sortBookmarks(filtered, sortOption);
  }, [collectionBookmarks, searchQuery, tags, collections, sortOption]);

  const sortOptions = [
    { value: 'newest', label: 'Newest first' },
    { value: 'oldest', label: 'Oldest first' },
    { value: 'title-asc', label: 'Title (A–Z)' },
    { value: 'title-desc', label: 'Title (Z–A)' },
  ];

  if (!currentCollection) {
    return (
      <div className="py-12 text-center space-y-4">
        <BookmarkEmptyState
          type="collections"
          title="Collection Not Found"
          description="This shelf may have been removed or does not exist."
          actionLabel="Return to Collections"
          onAction={() => onNavigate('collections')}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 py-2">
      {/* Top Breadcrumb & Navigation Link */}
      <nav
        aria-label="Breadcrumb"
        className="flex items-center gap-2 text-xs font-mono text-shelf-muted dark:text-shelf-mutedDark"
      >
        <button
          type="button"
          onClick={() => onNavigate('collections')}
          className="hover:text-shelf-terracotta dark:hover:text-shelf-terracotta transition-colors flex items-center gap-1.5 focus-ring rounded-[6px]"
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Collections</span>
        </button>
        <span className="text-shelf-muted/40">/</span>
        <span className="text-shelf-dark dark:text-shelf-ivory font-medium truncate max-w-[200px] sm:max-w-xs">
          {currentCollection.name}
        </span>
      </nav>

      {/* Header Area */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-2">
        <div className="space-y-1.5">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-[14px] bg-shelf-terracottaMuted border border-shelf-terracotta/20 flex items-center justify-center shadow-xs">
              <Folder className="w-6 h-6 text-shelf-terracotta" />
            </span>
            <div className="flex items-center gap-2.5">
              <h1 className="font-editorial text-3xl sm:text-4xl font-medium tracking-tight text-shelf-dark dark:text-shelf-ivory">
                {currentCollection.name}
              </h1>
              <Badge variant="accent" className="font-mono text-xs">
                {collectionBookmarks.length}
              </Badge>
            </div>
          </div>
          {currentCollection.description ? (
            <p className="text-xs sm:text-sm text-shelf-muted dark:text-shelf-mutedDark leading-relaxed max-w-2xl pl-1">
              {currentCollection.description}
            </p>
          ) : (
            <p className="text-xs sm:text-sm text-shelf-muted dark:text-shelf-mutedDark leading-relaxed pl-1">
              Curated shelf in your personal library.
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onNavigate('collections')}
            icon={<ArrowLeft className="w-3.5 h-3.5" />}
          >
            All Collections
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              window.dispatchEvent(
                new CustomEvent('shelf-open-quick-add', {
                  detail: { bookmark: { collectionId: currentCollection.id } as any },
                })
              );
            }}
            icon={<Plus className="w-3.5 h-3.5" />}
          >
            Add Bookmark
          </Button>
        </div>
      </div>

      {/* Floating Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-2.5 bg-white dark:bg-shelf-surfaceDark border border-shelf-borderLight/80 dark:border-shelf-borderDark/80 rounded-[18px] shadow-[0_4px_20px_rgba(36,35,33,0.03)] dark:shadow-[0_6px_24px_rgba(0,0,0,0.3)]">
        <div className="flex-1 max-w-md">
          <Input
            icon={<Search className="w-4 h-4 text-shelf-terracotta" />}
            type="search"
            placeholder={`Search within ${currentCollection.name}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape' && searchQuery) {
                e.preventDefault();
                setSearchQuery('');
              }
            }}
            rightElement={
              searchQuery ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
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
            id="collection-detail-sort-select"
            label="Sort bookmarks order"
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
              onClick={() => setSearchQuery('')}
              className="hover:bg-shelf-stone/40 rounded-full p-0.5"
              title="Clear query"
              aria-label="Clear query"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="text-[11px] text-shelf-terracotta hover:underline font-medium ml-1"
          >
            Clear
          </button>
        </div>
      )}

      {/* Content Area */}
      {displayedBookmarks.length === 0 ? (
        collectionBookmarks.length === 0 ? (
          <BookmarkEmptyState
            type="collections"
            title="This shelf is empty"
            description={`No bookmarks have been filed into "${currentCollection.name}" yet.`}
            actionLabel="Add a bookmark"
            onAction={() => {
              window.dispatchEvent(
                new CustomEvent('shelf-open-quick-add', {
                  detail: { bookmark: { collectionId: currentCollection.id } as any },
                })
              );
            }}
          />
        ) : (
          <BookmarkEmptyState
            type="search"
            title="No matching bookmarks found"
            description={`None of the bookmarks in "${currentCollection.name}" match "${searchQuery}".`}
            actionLabel="Clear search"
            onAction={() => setSearchQuery('')}
          />
        )
      ) : (
        <div
          className={
            viewMode === 'grid'
              ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5'
              : 'flex flex-col gap-3'
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

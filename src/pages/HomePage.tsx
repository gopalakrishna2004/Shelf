import React, { useState } from 'react';
import { Plus, Search, ArrowRight, Layers, Bookmark as BookmarkIcon, Star, Sparkles, FolderPlus, Link2, Clock, Loader2, AlertCircle, CheckCircle2, X } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { BookmarkEmptyState } from '../components/bookmark/BookmarkEmptyState';
import { BookmarkCard } from '../components/bookmark/BookmarkCard';
import { Badge } from '../components/ui/Badge';
import { useBookmarks } from '../context/BookmarkContext';
import { normalizeUrl, isValidUrl, fetchOpenGraphImage } from '../lib/metadata';
import { sortBookmarks } from '../lib/sorting';
import { setActiveSearchQuery, setPendingSearchQuery } from '../lib/searchNavigation';
import type { PageId, Bookmark } from '../types';

export interface HomePageProps {
  onNavigate: (page: PageId) => void;
  onOpenCreateCollection: () => void;
  onSearch?: (query: string) => void;
}

export const HomePage: React.FC<HomePageProps> = ({
  onNavigate,
  onOpenCreateCollection,
  onSearch,
}) => {
  const { bookmarks, addBookmark } = useBookmarks();
  const [quickAddUrl, setQuickAddUrl] = useState('');
  const [quickAddNotice, setQuickAddNotice] = useState<string | null>(null);
  const [quickAddError, setQuickAddError] = useState<string | null>(null);
  const [lastSavedBookmark, setLastSavedBookmark] = useState<Bookmark | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [homeSearchQuery, setHomeSearchQuery] = useState('');

  const handleQuickAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setQuickAddError(null);
    setQuickAddNotice(null);

    const rawUrl = quickAddUrl.trim();
    if (!rawUrl) {
      setQuickAddError('Please enter a website URL.');
      return;
    }

    const normalized = normalizeUrl(rawUrl);
    if (!normalized || !isValidUrl(normalized)) {
      setQuickAddError('Please enter a valid website URL (e.g. https://example.com).');
      return;
    }

    setIsSubmitting(true);

    let resolvedOgImage: string | undefined;
    try {
      resolvedOgImage = await fetchOpenGraphImage(normalized, 1800);
    } catch {
      // Graceful fallback to default thumbnail service
    }

    const { bookmark, error } = await addBookmark({
      url: normalized,
      previewImage: resolvedOgImage,
    });
    setIsSubmitting(false);

    if (error || !bookmark) {
      setQuickAddError(error?.message || 'Failed to save bookmark.');
      return;
    }

    setLastSavedBookmark(bookmark);
    setQuickAddNotice(`Saved "${bookmark.title}" to your library.`);
    setQuickAddUrl('');
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const query = homeSearchQuery.trim();
    if (onSearch) {
      onSearch(query);
    } else {
      setActiveSearchQuery(query);
      setPendingSearchQuery(query);
      onNavigate('all');
    }
    setHomeSearchQuery('');
  };

  return (
    <div className="space-y-12 py-2">
      {/* Hero Welcome & Quick Add Experience */}
      <section className="relative">
        {/* Soft background ambient warmth */}
        <div className="space-y-4 max-w-3xl">
          <div className="flex items-center gap-2.5">
            <Badge variant="accent">
              <Sparkles className="w-3 h-3 text-shelf-terracotta" />
              Personal Sanctuary
            </Badge>
            <span className="text-xs font-mono text-shelf-muted dark:text-shelf-mutedDark">
              Curated Web Library
            </span>
          </div>

          <h1 className="font-editorial text-4xl sm:text-5xl lg:text-6xl font-medium tracking-tight text-shelf-dark dark:text-shelf-ivory leading-[1.1]">
            Everything worth <span className="text-shelf-terracotta italic font-serif">keeping.</span>
          </h1>
          <p className="text-sm sm:text-base text-shelf-muted dark:text-shelf-mutedDark leading-relaxed max-w-2xl">
            A quiet, tactile corner of the internet. Save thoughtful essays, engineering references, utilities, and design inspirations without algorithmic noise.
          </p>
        </div>

        {/* Elevated Tactile Quick-Add Bar */}
        <div className="mt-8 max-w-2xl">
          <form
            onSubmit={handleQuickAddSubmit}
            className="p-2 sm:p-2.5 rounded-[20px] bg-white dark:bg-shelf-surfaceDark border border-shelf-borderLight/80 dark:border-shelf-borderDark/80 shadow-[0_8px_30px_rgba(36,35,33,0.06),0_2px_4px_rgba(0,0,0,0.02)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.4)] flex items-center gap-2.5 transition-all duration-200 focus-within:border-shelf-terracotta/70 focus-within:shadow-[0_10px_35px_rgba(201,75,54,0.12)]"
          >
            <div className="pl-3 text-shelf-muted dark:text-shelf-mutedDark flex items-center">
              <Link2 className="w-4 h-4 text-shelf-terracotta" />
            </div>
            <input
              type="text"
              placeholder="Paste any link to save... (e.g. https://example.com/essay)"
              value={quickAddUrl}
              onChange={(e) => {
                setQuickAddUrl(e.target.value);
                setQuickAddError(null);
              }}
              disabled={isSubmitting}
              className="flex-1 bg-transparent text-shelf-dark dark:text-shelf-ivory placeholder:text-shelf-muted/60 dark:placeholder:text-shelf-mutedDark/60 text-xs sm:text-sm py-2 px-1 focus:outline-none"
            />
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={!quickAddUrl.trim() || isSubmitting}
              icon={
                isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )
              }
              className="shrink-0"
            >
              {isSubmitting ? 'Saving...' : 'Save Link'}
            </Button>
          </form>

          {quickAddError && (
            <div className="mt-3 p-3.5 rounded-[14px] bg-red-500/10 border border-red-500/20 text-xs text-red-600 dark:text-red-400 flex items-center justify-between gap-3 shadow-xs animate-fadeIn">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{quickAddError}</span>
              </div>
              <button
                type="button"
                onClick={() => setQuickAddError(null)}
                className="font-mono text-xs hover:underline shrink-0"
              >
                Dismiss
              </button>
            </div>
          )}

          {quickAddNotice && (
            <div className="mt-3 p-3.5 rounded-[14px] bg-shelf-terracottaMuted border border-shelf-terracotta/25 text-xs text-shelf-terracotta flex items-center justify-between gap-3 shadow-xs animate-fadeIn">
              <div className="flex items-center gap-2 min-w-0">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-shelf-terracotta" />
                <span className="font-medium truncate">{quickAddNotice}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {lastSavedBookmark && (
                  <button
                    type="button"
                    onClick={() => {
                      window.dispatchEvent(
                        new CustomEvent('shelf-open-quick-add', {
                          detail: { bookmark: lastSavedBookmark },
                        })
                      );
                      setQuickAddNotice(null);
                    }}
                    className="px-2.5 py-1 rounded-[8px] bg-shelf-terracotta text-white font-medium hover:bg-shelf-terracottaHover transition-colors shadow-xs"
                  >
                    Customize
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setQuickAddNotice(null)}
                  className="font-mono text-xs hover:underline text-shelf-terracotta/80 shrink-0"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Quick Search & Filter Navigation Pill Strip */}
      <section className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-2 rounded-[16px] bg-[#EBE6DC]/40 dark:bg-shelf-surfaceDark/40">
        <form onSubmit={handleSearchSubmit} className="flex-1 sm:max-w-md relative flex items-center">
          <Search className="w-4 h-4 absolute left-3.5 text-shelf-terracotta pointer-events-none" />
          <input
            type="search"
            placeholder="Quick search across your library..."
            value={homeSearchQuery}
            onChange={(e) => setHomeSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape' && homeSearchQuery) {
                e.preventDefault();
                setHomeSearchQuery('');
              }
            }}
            className="w-full bg-white dark:bg-shelf-surfaceDark text-shelf-dark dark:text-shelf-ivory placeholder:text-shelf-muted/60 dark:placeholder:text-shelf-mutedDark/60 rounded-[12px] text-xs py-2 pl-9 pr-8 border border-shelf-borderLight/70 dark:border-shelf-borderDark/80 shadow-[0_1px_3px_rgba(0,0,0,0.02)] focus:outline-none focus:ring-2 focus:ring-shelf-terracotta/40"
          />
          {homeSearchQuery && (
            <button
              type="button"
              onClick={() => setHomeSearchQuery('')}
              aria-label="Clear quick search"
              className="absolute right-2.5 p-1 rounded-full text-shelf-muted dark:text-shelf-mutedDark hover:text-shelf-dark dark:hover:text-shelf-ivory hover:bg-shelf-stone/20 dark:hover:bg-white/10 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </form>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onNavigate('all')}
            icon={<BookmarkIcon className="w-3.5 h-3.5 text-shelf-terracotta" />}
          >
            All Bookmarks
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onNavigate('favourites')}
            icon={<Star className="w-3.5 h-3.5 text-shelf-terracotta fill-shelf-terracotta" />}
          >
            Favourites
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onNavigate('collections')}
            icon={<Layers className="w-3.5 h-3.5 text-shelf-terracotta" />}
          >
            Collections
          </Button>
        </div>
      </section>

      {/* Collections Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between pb-2">
          <div className="flex items-center gap-2.5">
            <h2 className="font-editorial text-2xl font-medium tracking-tight text-shelf-dark dark:text-shelf-ivory flex items-center gap-2">
              <Layers className="w-5 h-5 text-shelf-terracotta" />
              Curated Shelves
            </h2>
            <span className="text-xs text-shelf-muted dark:text-shelf-mutedDark font-mono">(0)</span>
          </div>
          <button
            type="button"
            onClick={onOpenCreateCollection}
            className="text-xs text-shelf-terracotta hover:text-shelf-terracottaHover font-medium inline-flex items-center gap-1.5 hover:underline"
          >
            <Plus className="w-3.5 h-3.5" />
            New collection
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div
            onClick={onOpenCreateCollection}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') onOpenCreateCollection();
            }}
            className="p-6 rounded-[20px] bg-gradient-to-br from-white/90 to-white/40 dark:from-shelf-surfaceDark/80 dark:to-shelf-surfaceDark/30 border border-shelf-borderLight/80 dark:border-shelf-borderDark/80 hover:border-shelf-terracotta/50 hover:shadow-[0_8px_24px_rgba(201,75,54,0.1)] cursor-pointer transition-all duration-200 group flex flex-col justify-between h-44"
          >
            <div className="flex items-start justify-between">
              <div className="w-10 h-10 rounded-[12px] bg-shelf-terracottaMuted flex items-center justify-center text-shelf-terracotta group-hover:scale-105 transition-transform shadow-xs">
                <FolderPlus className="w-5 h-5 text-shelf-terracotta" />
              </div>
              <ArrowRight className="w-4 h-4 text-shelf-muted group-hover:text-shelf-terracotta group-hover:translate-x-1 transition-all" />
            </div>
            <div>
              <h3 className="font-editorial text-lg font-medium text-shelf-dark dark:text-shelf-ivory group-hover:text-shelf-terracotta transition-colors">
                Create a Shelf
              </h3>
              <p className="text-xs text-shelf-muted dark:text-shelf-mutedDark mt-1 leading-relaxed">
                Group essays, design systems, reading lists, or API utilities together.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Recently Added Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between pb-2">
          <div className="flex items-center gap-2.5">
            <h2 className="font-editorial text-2xl font-medium tracking-tight text-shelf-dark dark:text-shelf-ivory flex items-center gap-2">
              <Clock className="w-5 h-5 text-shelf-terracotta" />
              Recently Added
            </h2>
            <span className="text-xs text-shelf-muted dark:text-shelf-mutedDark font-mono">
              ({bookmarks.length})
            </span>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('all')}
            className="text-xs text-shelf-muted dark:text-shelf-mutedDark hover:text-shelf-terracotta inline-flex items-center gap-1 transition-colors"
          >
            View all bookmarks
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {bookmarks.length === 0 ? (
          <BookmarkEmptyState
            type="recent"
            actionLabel="Add a link"
            onAction={() => window.dispatchEvent(new Event('shelf-open-quick-add'))}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {sortBookmarks(bookmarks, 'newest').slice(0, 3).map((b) => (
              <BookmarkCard key={b.id} bookmark={b} viewMode="grid" />
            ))}
          </div>
        )}
      </section>

      {/* Favourites Section */}
      {(() => {
        const favouriteBookmarks = sortBookmarks(
          bookmarks.filter((b) => b.isFavourite),
          'newest'
        );
        return (
          <section className="space-y-4">
            <div className="flex items-center justify-between pb-2">
              <div className="flex items-center gap-2.5">
                <h2 className="font-editorial text-2xl font-medium tracking-tight text-shelf-dark dark:text-shelf-ivory flex items-center gap-2">
                  <Star className="w-5 h-5 text-shelf-terracotta fill-shelf-terracotta" />
                  Favourites
                </h2>
                <span className="text-xs text-shelf-muted dark:text-shelf-mutedDark font-mono">
                  ({favouriteBookmarks.length})
                </span>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('favourites')}
                className="text-xs text-shelf-muted dark:text-shelf-mutedDark hover:text-shelf-terracotta inline-flex items-center gap-1 transition-colors"
              >
                View favourites
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {favouriteBookmarks.length === 0 ? (
              <BookmarkEmptyState
                type="favourites"
                actionLabel="Explore Library"
                onAction={() => onNavigate('all')}
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {favouriteBookmarks.slice(0, 3).map((b) => (
                  <BookmarkCard key={b.id} bookmark={b} viewMode="grid" />
                ))}
              </div>
            )}
          </section>
        );
      })()}

      {/* Subtle Literary Footer */}
      <footer className="pt-8 border-t border-shelf-borderLight/50 dark:border-shelf-borderDark/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-shelf-muted dark:text-shelf-mutedDark font-mono">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-shelf-terracotta" />
          <span>Shelf — Designed for deliberate, mindful reading.</span>
        </div>
        <span className="text-[11px]">
          Supabase Authentication Active
        </span>
      </footer>
    </div>
  );
};

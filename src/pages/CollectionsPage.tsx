import React, { useState } from 'react';
import {
  Plus,
  Layers,
  FolderPlus,
  ArrowRight,
  BookOpen,
  Wrench,
  Palette,
  Pencil,
  Trash2,
  MoreVertical,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { BookmarkEmptyState } from '../components/bookmark/BookmarkEmptyState';
import { Badge } from '../components/ui/Badge';
import { useCollections } from '../context/CollectionContext';
import { useBookmarks } from '../context/BookmarkContext';
import { RenameCollectionModal } from '../components/bookmark/RenameCollectionModal';
import { DeleteCollectionModal } from '../components/bookmark/DeleteCollectionModal';
import type { Collection, PageId } from '../types';

export interface CollectionsPageProps {
  onOpenCreateCollection: () => void;
  onNavigate?: (page: PageId, id?: string) => void;
}

export const CollectionsPage: React.FC<CollectionsPageProps> = ({
  onOpenCreateCollection,
  onNavigate,
}) => {
  const { collections } = useCollections();
  const { bookmarks } = useBookmarks();

  const [renamingCollection, setRenamingCollection] = useState<Collection | null>(null);
  const [deletingCollection, setDeletingCollection] = useState<Collection | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [toastNotice, setToastNotice] = useState<string | null>(null);

  const handleSelectCollection = (colId: string) => {
    if (onNavigate) {
      onNavigate('collection', colId);
    } else {
      window.location.hash = `collections/${encodeURIComponent(colId)}`;
    }
  };

  const showToast = (message: string) => {
    setToastNotice(message);
    setTimeout(() => {
      setToastNotice(null);
    }, 3500);
  };

  return (
    <div className="space-y-8 py-2">
      {/* Header */}
      <div className="flex items-end justify-between pb-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <h1 className="font-editorial text-3xl sm:text-4xl font-medium tracking-tight text-shelf-dark dark:text-shelf-ivory flex items-center gap-3">
              <span className="p-1.5 rounded-[12px] bg-shelf-terracottaMuted border border-shelf-terracotta/20 flex items-center justify-center shadow-xs">
                <Layers className="w-6 h-6 text-shelf-terracotta" />
              </span>
              Curated <span className="text-shelf-terracotta italic font-serif">Collections</span>
            </h1>
            <Badge variant="accent" className="font-mono text-xs">
              {collections.length}
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-shelf-muted dark:text-shelf-mutedDark leading-relaxed">
            Curate your bookmarks into focused projects, reading lists, or subject repositories.
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={onOpenCreateCollection}
          icon={<Plus className="w-3.5 h-3.5" />}
        >
          New Collection
        </Button>
      </div>

      {/* Overview / Content Area */}
      {collections.length === 0 ? (
        <div className="space-y-10">
          <BookmarkEmptyState
            type="collections"
            actionLabel="Create your first collection"
            onAction={onOpenCreateCollection}
          />

          {/* Curated Paradigms Shelf Overview */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase tracking-wider text-shelf-muted dark:text-shelf-mutedDark font-medium">
                Shelf Archetypes
              </span>
              <span className="text-xs font-mono text-shelf-muted dark:text-shelf-mutedDark">
                Suggested organizational paradigms
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Card 1: Long-Form Reading */}
              <div
                onClick={onOpenCreateCollection}
                className="cursor-pointer p-6 rounded-[22px] bg-white dark:bg-shelf-surfaceDark border border-shelf-borderLight/70 dark:border-shelf-borderDark/80 border-t-2 border-t-shelf-terracotta/40 shadow-[0_4px_20px_rgba(36,35,33,0.03)] hover:shadow-[0_8px_28px_rgba(201,75,54,0.12)] hover:border-shelf-terracotta/50 hover:-translate-y-1 transition-all duration-200 flex flex-col justify-between h-48 group"
              >
                <div>
                  <div className="flex items-center gap-2 text-shelf-terracotta mb-2.5">
                    <span className="p-1 rounded-[8px] bg-shelf-terracottaMuted group-hover:bg-shelf-terracotta group-hover:text-white transition-colors">
                      <BookOpen className="w-4 h-4 text-inherit" />
                    </span>
                    <span className="text-[10px] font-mono uppercase tracking-wider font-semibold">
                      Research &amp; Essays
                    </span>
                  </div>
                  <h3 className="font-editorial text-xl font-medium text-shelf-dark dark:text-shelf-ivory group-hover:text-shelf-terracotta transition-colors mb-1">
                    Long-Form Reading
                  </h3>
                  <p className="text-xs text-shelf-muted dark:text-shelf-mutedDark leading-relaxed">
                    Collect thoughtful essays, technical papers, and deep dives for distraction-free reading sessions.
                  </p>
                </div>
                <div className="pt-3 border-t border-shelf-borderLight/40 dark:border-shelf-borderDark/40 flex items-center justify-between text-xs text-shelf-muted dark:text-shelf-mutedDark font-mono text-[11px]">
                  <span>Topic-oriented</span>
                  <Badge variant="stone" className="text-[10px]">Tap to create</Badge>
                </div>
              </div>

              {/* Card 2: Daily Tooling */}
              <div
                onClick={onOpenCreateCollection}
                className="cursor-pointer p-6 rounded-[22px] bg-white dark:bg-shelf-surfaceDark border border-shelf-borderLight/70 dark:border-shelf-borderDark/80 border-t-2 border-t-shelf-terracotta/40 shadow-[0_4px_20px_rgba(36,35,33,0.03)] hover:shadow-[0_8px_28px_rgba(201,75,54,0.12)] hover:border-shelf-terracotta/50 hover:-translate-y-1 transition-all duration-200 flex flex-col justify-between h-48 group"
              >
                <div>
                  <div className="flex items-center gap-2 text-shelf-terracotta mb-2.5">
                    <span className="p-1 rounded-[8px] bg-shelf-terracottaMuted group-hover:bg-shelf-terracotta group-hover:text-white transition-colors">
                      <Wrench className="w-4 h-4 text-inherit" />
                    </span>
                    <span className="text-[10px] font-mono uppercase tracking-wider font-semibold">
                      Daily Tooling
                    </span>
                  </div>
                  <h3 className="font-editorial text-xl font-medium text-shelf-dark dark:text-shelf-ivory group-hover:text-shelf-terracotta transition-colors mb-1">
                    Web Utilities
                  </h3>
                  <p className="text-xs text-shelf-muted dark:text-shelf-mutedDark leading-relaxed">
                    Fast access to formatters, color palette generators, calculators, and API playgrounds.
                  </p>
                </div>
                <div className="pt-3 border-t border-shelf-borderLight/40 dark:border-shelf-borderDark/40 flex items-center justify-between text-xs text-shelf-muted dark:text-shelf-mutedDark font-mono text-[11px]">
                  <span>Utility-oriented</span>
                  <Badge variant="stone" className="text-[10px]">Tap to create</Badge>
                </div>
              </div>

              {/* Card 3: Visual Inspirations */}
              <div
                onClick={onOpenCreateCollection}
                className="cursor-pointer p-6 rounded-[22px] bg-white dark:bg-shelf-surfaceDark border border-shelf-borderLight/70 dark:border-shelf-borderDark/80 border-t-2 border-t-shelf-terracotta/40 shadow-[0_4px_20px_rgba(36,35,33,0.03)] hover:shadow-[0_8px_28px_rgba(201,75,54,0.12)] hover:border-shelf-terracotta/50 hover:-translate-y-1 transition-all duration-200 flex flex-col justify-between h-48 group"
              >
                <div>
                  <div className="flex items-center gap-2 text-shelf-terracotta mb-2.5">
                    <span className="p-1 rounded-[8px] bg-shelf-terracottaMuted group-hover:bg-shelf-terracotta group-hover:text-white transition-colors">
                      <Palette className="w-4 h-4 text-inherit" />
                    </span>
                    <span className="text-[10px] font-mono uppercase tracking-wider font-semibold">
                      Design &amp; Layout
                    </span>
                  </div>
                  <h3 className="font-editorial text-xl font-medium text-shelf-dark dark:text-shelf-ivory group-hover:text-shelf-terracotta transition-colors mb-1">
                    Visual Inspirations
                  </h3>
                  <p className="text-xs text-shelf-muted dark:text-shelf-mutedDark leading-relaxed">
                    Exemplary editorial layouts, typography specimens, architecture portfolios, and design tokens.
                  </p>
                </div>
                <div className="pt-3 border-t border-shelf-borderLight/40 dark:border-shelf-borderDark/40 flex items-center justify-between text-xs text-shelf-muted dark:text-shelf-mutedDark font-mono text-[11px]">
                  <span>Inspiration-oriented</span>
                  <Badge variant="stone" className="text-[10px]">Tap to create</Badge>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {collections.map((col) => {
            const count = bookmarks.filter((b) => b.collectionId === col.id).length;
            const isMenuOpen = activeMenuId === col.id;

            return (
              <div
                key={col.id}
                onClick={() => handleSelectCollection(col.id)}
                className="group relative p-6 rounded-[20px] bg-white dark:bg-shelf-surfaceDark border border-shelf-borderLight/70 dark:border-shelf-borderDark/80 shadow-[0_4px_20px_rgba(36,35,33,0.03)] hover:shadow-[0_8px_28px_rgba(201,75,54,0.09)] hover:border-shelf-terracotta/40 hover:-translate-y-1 transition-all duration-200 flex flex-col justify-between min-h-[190px] cursor-pointer"
              >
                <div>
                  {/* Top Bar with Icon, Title, and Actions */}
                  <div className="flex items-start justify-between gap-3 mb-2.5">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <span className="p-1.5 rounded-[10px] bg-shelf-terracottaMuted text-shelf-terracotta shrink-0 group-hover:bg-shelf-terracotta group-hover:text-white transition-colors">
                        <FolderPlus className="w-4 h-4 text-inherit" />
                      </span>
                      <h3 className="font-editorial text-xl font-medium text-shelf-dark dark:text-shelf-ivory group-hover:text-shelf-terracotta transition-colors truncate">
                        {col.name}
                      </h3>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <Badge variant="accent" className="text-xs font-mono py-0.5 px-2">
                        {count} {count === 1 ? 'link' : 'links'}
                      </Badge>

                      {/* Dropdown Action Menu */}
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setActiveMenuId(isMenuOpen ? null : col.id)}
                          title="Collection options"
                          aria-label="Collection options"
                          aria-expanded={isMenuOpen}
                          className="w-7 h-7 flex items-center justify-center text-shelf-muted dark:text-shelf-mutedDark hover:text-shelf-dark dark:hover:text-shelf-ivory rounded-[8px] hover:bg-shelf-stone/20 dark:hover:bg-white/[0.05] transition-colors focus-ring"
                        >
                          <MoreVertical className="w-3.5 h-3.5" />
                        </button>

                        {isMenuOpen && (
                          <div
                            role="menu"
                            onClick={(e) => e.stopPropagation()}
                            className="absolute right-0 top-full mt-1 z-30 w-36 p-1 rounded-[14px] bg-white dark:bg-shelf-surfaceDark border border-shelf-borderLight/90 dark:border-shelf-borderDark/90 shadow-[0_10px_30px_rgba(36,35,33,0.14)] dark:shadow-[0_14px_35px_rgba(0,0,0,0.6)] animate-in fade-in-0 zoom-in-95"
                          >
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => {
                                setActiveMenuId(null);
                                setRenamingCollection(col);
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-shelf-dark dark:text-shelf-ivory hover:bg-shelf-surfaceSubtle dark:hover:bg-white/[0.05] rounded-[9px] transition-colors text-left"
                            >
                              <Pencil className="w-3.5 h-3.5 text-shelf-terracotta shrink-0" />
                              <span>Rename</span>
                            </button>
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => {
                                setActiveMenuId(null);
                                setDeletingCollection(col);
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-500/10 rounded-[9px] transition-colors text-left"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-red-500 shrink-0" />
                              <span>Delete</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  {col.description ? (
                    <p className="text-xs text-shelf-muted dark:text-shelf-mutedDark line-clamp-2 leading-relaxed">
                      {col.description}
                    </p>
                  ) : (
                    <p className="text-[11px] text-shelf-muted/60 dark:text-shelf-mutedDark/60 italic">
                      No description provided
                    </p>
                  )}
                </div>

                {/* Footer action */}
                <div className="pt-3 border-t border-shelf-borderLight/40 dark:border-shelf-borderDark/40 flex items-center justify-between text-xs text-shelf-muted dark:text-shelf-mutedDark group-hover:text-shelf-terracotta transition-colors">
                  <span className="font-medium text-[11px]">View links</span>
                  <ArrowRight className="w-3.5 h-3.5 text-shelf-terracotta group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Rename Modal */}
      <RenameCollectionModal
        isOpen={Boolean(renamingCollection)}
        collection={renamingCollection}
        onClose={() => setRenamingCollection(null)}
        onRenamed={(updated) => {
          showToast(`Renamed collection to "${updated.name}".`);
        }}
      />

      {/* Delete Confirmation Modal */}
      <DeleteCollectionModal
        isOpen={Boolean(deletingCollection)}
        collection={deletingCollection}
        bookmarkCount={
          deletingCollection
            ? bookmarks.filter((b) => b.collectionId === deletingCollection.id).length
            : 0
        }
        onClose={() => setDeletingCollection(null)}
        onDeleted={(deleted) => {
          showToast(`Deleted collection "${deleted.name}".`);
        }}
      />

      {/* Small Floating Toast */}
      {toastNotice && (
        <div className="fixed bottom-6 right-6 z-50 p-3.5 px-4.5 rounded-[14px] bg-white dark:bg-shelf-surfaceDark text-shelf-dark dark:text-shelf-ivory border border-shelf-borderLight/90 dark:border-shelf-borderDark/90 shadow-[0_12px_36px_rgba(36,35,33,0.16)] dark:shadow-[0_16px_40px_rgba(0,0,0,0.6)] flex items-center gap-2.5 text-xs font-medium animate-in fade-in-0 slide-in-from-bottom-3 select-none">
          <CheckCircle2 className="w-4 h-4 text-shelf-terracotta shrink-0" />
          <span>{toastNotice}</span>
        </div>
      )}
    </div>
  );
};

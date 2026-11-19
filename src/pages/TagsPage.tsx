import React, { useState } from 'react';
import {
  Plus,
  Tag as TagIcon,
  Pencil,
  Trash2,
  MoreVertical,
  CheckCircle2,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { BookmarkEmptyState } from '../components/bookmark/BookmarkEmptyState';
import { Badge } from '../components/ui/Badge';
import { useTags } from '../context/TagContext';
import { useBookmarks } from '../context/BookmarkContext';
import { RenameTagModal } from '../components/bookmark/RenameTagModal';
import { DeleteTagModal } from '../components/bookmark/DeleteTagModal';
import type { Tag, PageId } from '../types';

export interface TagsPageProps {
  onOpenCreateTag: () => void;
  onNavigate?: (page: PageId, id?: string) => void;
  onSelectTag?: (tagId: string) => void;
}

export const TagsPage: React.FC<TagsPageProps> = ({
  onOpenCreateTag,
  onNavigate,
  onSelectTag,
}) => {
  const { tags, createTag } = useTags();
  const { bookmarks } = useBookmarks();

  const [renamingTag, setRenamingTag] = useState<Tag | null>(null);
  const [deletingTag, setDeletingTag] = useState<Tag | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [toastNotice, setToastNotice] = useState<string | null>(null);

  const handleSelectTag = (tagId: string) => {
    if (onSelectTag) {
      onSelectTag(tagId);
    }
    if (onNavigate) {
      onNavigate('tag', tagId);
    } else {
      window.location.hash = `tags/${encodeURIComponent(tagId)}`;
    }
  };

  const showToast = (message: string) => {
    setToastNotice(message);
    setTimeout(() => {
      setToastNotice(null);
    }, 3500);
  };

  const handleQuickCreateTag = async (name: string) => {
    const { tag, error } = await createTag({ name });
    if (!error && tag) {
      showToast(`Tag "#${tag.name}" created.`);
    }
  };

  const starterTags = ['Design', 'Research', 'Inspiration', 'Tools', 'Reading'];

  return (
    <div className="space-y-8 py-2">
      {/* Header */}
      <div className="flex items-end justify-between pb-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <h1 className="font-editorial text-3xl sm:text-4xl font-medium tracking-tight text-shelf-dark dark:text-shelf-ivory flex items-center gap-3">
              <span className="p-1.5 rounded-[12px] bg-shelf-terracottaMuted border border-shelf-terracotta/20 flex items-center justify-center shadow-xs">
                <TagIcon className="w-6 h-6 text-shelf-terracotta" />
              </span>
              Curated <span className="text-shelf-terracotta italic font-serif">Tags</span>
            </h1>
            <Badge variant="accent" className="font-mono text-xs">
              {tags.length}
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-shelf-muted dark:text-shelf-mutedDark leading-relaxed">
            Organise and connect your bookmarks across multiple shelves with flexible, reusable tags.
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={onOpenCreateTag}
          icon={<Plus className="w-3.5 h-3.5" />}
        >
          New Tag
        </Button>
      </div>

      {/* Overview / Content Area */}
      {tags.length === 0 ? (
        <div className="space-y-10">
          <BookmarkEmptyState
            type="tags"
            actionLabel="Create your first tag"
            onAction={onOpenCreateTag}
          />

          {/* Quick starter tags suggestion */}
          <div className="p-6 rounded-[22px] bg-white dark:bg-shelf-surfaceDark border border-shelf-borderLight/70 dark:border-shelf-borderDark/80 shadow-[0_4px_20px_rgba(36,35,33,0.03)] space-y-4">
            <div className="flex items-center gap-2 text-shelf-terracotta">
              <Sparkles className="w-4 h-4" />
              <span className="text-xs font-mono uppercase tracking-wider font-semibold">
                Suggested Starter Tags
              </span>
            </div>
            <p className="text-xs text-shelf-muted dark:text-shelf-mutedDark leading-relaxed">
              Click any of these common classifications to instantly add it to your tag library:
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              {starterTags.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => handleQuickCreateTag(name)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-shelf-surfaceSubtle dark:bg-shelf-surfaceDarkElevated border border-shelf-borderLight dark:border-shelf-borderDark text-shelf-dark dark:text-shelf-ivory hover:border-shelf-terracotta hover:text-shelf-terracotta dark:hover:text-shelf-terracotta transition-colors"
                >
                  <Plus className="w-3 h-3 text-shelf-terracotta" />
                  <span>#{name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {tags.map((tag) => {
            const count = bookmarks.filter((b) => b.tags?.includes(tag.id)).length;
            const isMenuOpen = activeMenuId === tag.id;

            return (
              <div
                key={tag.id}
                onClick={() => handleSelectTag(tag.id)}
                className="group relative p-5 rounded-[18px] bg-white dark:bg-shelf-surfaceDark border border-shelf-borderLight/70 dark:border-shelf-borderDark/80 shadow-[0_4px_16px_rgba(36,35,33,0.03)] hover:shadow-[0_6px_24px_rgba(201,75,54,0.09)] hover:border-shelf-terracotta/40 hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between min-h-[140px] cursor-pointer"
              >
                <div>
                  {/* Top Bar with Tag Icon, Name, and Menu */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="p-1.5 rounded-[8px] bg-shelf-terracottaMuted text-shelf-terracotta shrink-0 group-hover:bg-shelf-terracotta group-hover:text-white transition-colors">
                        <TagIcon className="w-3.5 h-3.5 text-inherit" />
                      </span>
                      <h3 className="font-editorial text-lg font-medium text-shelf-dark dark:text-shelf-ivory group-hover:text-shelf-terracotta transition-colors truncate">
                        #{tag.name}
                      </h3>
                    </div>

                    <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => setActiveMenuId(isMenuOpen ? null : tag.id)}
                        title="Tag options"
                        aria-label="Tag options"
                        aria-expanded={isMenuOpen}
                        className="w-7 h-7 flex items-center justify-center text-shelf-muted dark:text-shelf-mutedDark hover:text-shelf-dark dark:hover:text-shelf-ivory rounded-[8px] hover:bg-shelf-stone/20 dark:hover:bg-white/[0.05] transition-colors focus-ring"
                      >
                        <MoreVertical className="w-3.5 h-3.5" />
                      </button>

                      {isMenuOpen && (
                        <div
                          role="menu"
                          onClick={(e) => e.stopPropagation()}
                          className="absolute right-0 top-full mt-1 z-30 w-32 p-1 rounded-[14px] bg-white dark:bg-shelf-surfaceDark border border-shelf-borderLight/90 dark:border-shelf-borderDark/90 shadow-[0_10px_30px_rgba(36,35,33,0.14)] dark:shadow-[0_14px_35px_rgba(0,0,0,0.6)] animate-in fade-in-0 zoom-in-95"
                        >
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              setActiveMenuId(null);
                              setRenamingTag(tag);
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
                              setDeletingTag(tag);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-[9px] transition-colors text-left"
                          >
                            <Trash2 className="w-3.5 h-3.5 shrink-0" />
                            <span>Delete</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Footer with Count and View Action */}
                <div className="pt-3 border-t border-shelf-borderLight/40 dark:border-shelf-borderDark/40 flex items-center justify-between">
                  <span className="text-xs font-mono text-shelf-muted dark:text-shelf-mutedDark">
                    {count} {count === 1 ? 'bookmark' : 'bookmarks'}
                  </span>
                  <span className="flex items-center gap-1 text-[11px] font-medium text-shelf-terracotta group-hover:translate-x-0.5 transition-transform">
                    <span>View links</span>
                    <ArrowRight className="w-3 h-3" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Rename Tag Modal */}
      {renamingTag && (
        <RenameTagModal
          isOpen={Boolean(renamingTag)}
          tag={renamingTag}
          onClose={() => setRenamingTag(null)}
          onRenamed={(updated) => {
            showToast(`Tag renamed to "#${updated.name}".`);
          }}
        />
      )}

      {/* Delete Tag Modal */}
      {deletingTag && (
        <DeleteTagModal
          isOpen={Boolean(deletingTag)}
          tag={deletingTag}
          bookmarkCount={bookmarks.filter((b) => b.tags?.includes(deletingTag.id)).length}
          onClose={() => setDeletingTag(null)}
          onDeleted={(deleted) => {
            showToast(`Tag "#${deleted.name}" deleted.`);
          }}
        />
      )}

      {/* Floating Toast Notification */}
      {toastNotice && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-2.5 rounded-[14px] bg-shelf-dark text-shelf-ivory dark:bg-shelf-ivory dark:text-shelf-dark shadow-[0_10px_30px_rgba(0,0,0,0.2)] animate-in fade-in-0 slide-in-from-bottom-2 text-xs font-medium">
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>{toastNotice}</span>
        </div>
      )}
    </div>
  );
};

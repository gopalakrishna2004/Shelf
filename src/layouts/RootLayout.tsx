import React, { useState, useEffect } from 'react';
import { Sidebar } from '../components/layout/Sidebar';
import { CreateCollectionModal } from '../components/bookmark/CreateCollectionModal';
import { CreateTagModal } from '../components/bookmark/CreateTagModal';
import { BookmarkModal } from '../components/bookmark/BookmarkModal';
import { DeleteBookmarkModal } from '../components/bookmark/DeleteBookmarkModal';
import { CheckCircle2 } from 'lucide-react';
import { useSidebarCollapse } from '../hooks/useSidebarCollapse';
import { cn } from '../lib/utils';
import type { Bookmark, PageId, Theme } from '../types';

export interface RootLayoutProps {
  currentPage: PageId;
  onNavigate: (page: PageId, id?: string) => void;
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  children: React.ReactNode;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const RootLayout: React.FC<RootLayoutProps> = ({
  currentPage,
  onNavigate,
  theme,
  onThemeChange,
  children,
  isCollapsed: propIsCollapsed,
  onToggleCollapse: propOnToggleCollapse,
}) => {
  const { isCollapsed: hookIsCollapsed, toggleSidebar } = useSidebarCollapse();
  const isCollapsed = propIsCollapsed !== undefined ? propIsCollapsed : hookIsCollapsed;
  const onToggleCollapse = propOnToggleCollapse || toggleSidebar;

  const [isCreateCollectionOpen, setIsCreateCollectionOpen] = useState(false);
  const [isCreateTagOpen, setIsCreateTagOpen] = useState(false);
  const [isBookmarkModalOpen, setIsBookmarkModalOpen] = useState(false);
  const [editingBookmark, setEditingBookmark] = useState<Bookmark | null>(null);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingBookmark, setDeletingBookmark] = useState<Bookmark | null>(null);

  const [toastNotice, setToastNotice] = useState<string | null>(null);

  useEffect(() => {
    const handleOpenQuickAdd = (e: Event) => {
      const customEvent = e as CustomEvent<{ bookmark?: Bookmark; url?: string }>;
      if (customEvent.detail?.bookmark) {
        setEditingBookmark(customEvent.detail.bookmark);
      } else {
        setEditingBookmark(null);
      }
      setIsBookmarkModalOpen(true);
    };

    const handleOpenEdit = (e: Event) => {
      const customEvent = e as CustomEvent<{ bookmark: Bookmark }>;
      if (customEvent.detail?.bookmark) {
        setEditingBookmark(customEvent.detail.bookmark);
        setIsBookmarkModalOpen(true);
      }
    };

    const handleOpenDelete = (e: Event) => {
      const customEvent = e as CustomEvent<{ bookmark: Bookmark }>;
      if (customEvent.detail?.bookmark) {
        setDeletingBookmark(customEvent.detail.bookmark);
        setIsDeleteModalOpen(true);
      }
    };

    const handleOpenCreateCollection = () => {
      setIsCreateCollectionOpen(true);
    };

    const handleOpenCreateTag = () => {
      setIsCreateTagOpen(true);
    };

    window.addEventListener('shelf-open-quick-add', handleOpenQuickAdd);
    window.addEventListener('shelf-open-bookmark-edit', handleOpenEdit);
    window.addEventListener('shelf-open-bookmark-delete', handleOpenDelete);
    window.addEventListener('shelf-open-create-collection', handleOpenCreateCollection);
    window.addEventListener('shelf-open-create-tag', handleOpenCreateTag);

    return () => {
      window.removeEventListener('shelf-open-quick-add', handleOpenQuickAdd);
      window.removeEventListener('shelf-open-bookmark-edit', handleOpenEdit);
      window.removeEventListener('shelf-open-bookmark-delete', handleOpenDelete);
      window.removeEventListener('shelf-open-create-collection', handleOpenCreateCollection);
      window.removeEventListener('shelf-open-create-tag', handleOpenCreateTag);
    };
  }, []);

  // Auto-dismiss toast notice after 3.5 seconds
  useEffect(() => {
    if (!toastNotice) return;
    const timer = setTimeout(() => {
      setToastNotice(null);
    }, 3500);
    return () => clearTimeout(timer);
  }, [toastNotice]);

  return (
    <div className="min-h-screen bg-shelf-ivory text-shelf-dark dark:bg-shelf-dark dark:text-shelf-ivory transition-colors duration-200 flex">
      {/* Permanent Desktop Navigation Sidebar */}
      <Sidebar
        currentPage={currentPage}
        onNavigate={onNavigate}
        onQuickAddClick={() => {
          setEditingBookmark(null);
          setIsBookmarkModalOpen(true);
        }}
        onCreateCollectionClick={() => setIsCreateCollectionOpen(true)}
        theme={theme}
        onThemeChange={onThemeChange}
        isCollapsed={isCollapsed}
        onToggleCollapse={onToggleCollapse}
      />

      {/* Main Reading & Curation Canvas */}
      <main
        className={cn(
          "flex-1 min-w-0 min-h-screen flex flex-col transition-[margin] duration-300 ease-in-out motion-reduce:transition-none",
          isCollapsed ? "ml-[72px]" : "ml-64"
        )}
      >
        <div className="flex-1 px-8 lg:px-14 py-10 max-w-6xl w-full mx-auto">
          {children}
        </div>
      </main>

      {/* Reusable Modals */}
      <CreateCollectionModal
        isOpen={isCreateCollectionOpen}
        onClose={() => setIsCreateCollectionOpen(false)}
        onCreated={(name) => {
          setToastNotice(`Created shelf "${name}".`);
        }}
      />

      <CreateTagModal
        isOpen={isCreateTagOpen}
        onClose={() => setIsCreateTagOpen(false)}
        onCreated={(name) => {
          setToastNotice(`Created tag "#${name}".`);
        }}
      />

      <BookmarkModal
        isOpen={isBookmarkModalOpen}
        onClose={() => {
          setIsBookmarkModalOpen(false);
          setEditingBookmark(null);
        }}
        initialBookmark={editingBookmark}
      />

      <DeleteBookmarkModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setDeletingBookmark(null);
        }}
        bookmark={deletingBookmark}
        onDeleted={(deleted) => {
          setToastNotice(`Removed "${deleted.title}" from your shelf.`);
        }}
      />

      {/* Small Floating Toast Notification */}
      {toastNotice && (
        <div className="fixed bottom-6 right-6 z-50 p-3.5 px-4.5 rounded-[14px] bg-white dark:bg-shelf-surfaceDark text-shelf-dark dark:text-shelf-ivory border border-shelf-borderLight/90 dark:border-shelf-borderDark/90 shadow-[0_12px_36px_rgba(36,35,33,0.16)] dark:shadow-[0_16px_40px_rgba(0,0,0,0.6)] flex items-center gap-2.5 text-xs font-medium animate-in fade-in-0 slide-in-from-bottom-3 select-none">
          <CheckCircle2 className="w-4 h-4 text-shelf-terracotta shrink-0" />
          <span>{toastNotice}</span>
        </div>
      )}
    </div>
  );
};

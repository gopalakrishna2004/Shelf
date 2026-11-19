import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Trash2, AlertTriangle, Globe } from 'lucide-react';
import { useBookmarks } from '../../context/BookmarkContext';
import { extractDomain, getDomainInitial } from '../../lib/utils';
import type { Bookmark } from '../../types';

export interface DeleteBookmarkModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookmark: Bookmark | null;
  onDeleted?: (deletedBookmark: Bookmark) => void;
}

export const DeleteBookmarkModal: React.FC<DeleteBookmarkModalProps> = ({
  isOpen,
  onClose,
  bookmark,
  onDeleted,
}) => {
  const { deleteBookmark } = useBookmarks();
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!bookmark) return null;

  const domain = bookmark.domain || extractDomain(bookmark.url);
  const initial = getDomainInitial(domain);

  const handleConfirm = async () => {
    if (isDeleting) return;
    setIsDeleting(true);
    setError(null);

    const { success, error: delErr } = await deleteBookmark(bookmark.id);
    setIsDeleting(false);

    if (!success || delErr) {
      setError(delErr?.message || 'Failed to delete bookmark. Please try again.');
      return;
    }

    onDeleted?.(bookmark);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (!isDeleting) onClose();
      }}
      title="Delete Bookmark"
      description="Are you sure you want to remove this bookmark from your shelf?"
      className="max-w-md"
    >
      <div className="space-y-4">
        {/* Bookmark identification preview card */}
        <div className="p-3.5 rounded-[14px] bg-shelf-surfaceSubtle dark:bg-shelf-dark/80 border border-shelf-borderLight/80 dark:border-shelf-borderDark/80 flex items-center gap-3">
          <div className="w-10 h-10 shrink-0 rounded-[10px] bg-shelf-stone/20 dark:bg-shelf-borderDark/60 text-shelf-dark dark:text-shelf-ivory border border-shelf-borderLight/60 dark:border-shelf-borderDark/80 text-xs font-mono font-medium shadow-xs flex items-center justify-center overflow-hidden">
            {bookmark.favicon ? (
              <img src={bookmark.favicon} alt="" className="w-4 h-4 object-contain rounded-[3px]" />
            ) : initial ? (
              <span className="text-shelf-terracotta font-mono font-semibold">{initial}</span>
            ) : (
              <Globe className="w-4 h-4 text-shelf-terracotta" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="font-editorial text-sm font-medium text-shelf-dark dark:text-shelf-ivory truncate">
              {bookmark.title}
            </h4>
            <span className="font-mono text-[11px] text-shelf-muted dark:text-shelf-mutedDark block truncate">
              {domain}
            </span>
          </div>
        </div>

        {/* Safeguard warning notice */}
        <div className="p-3 rounded-[12px] bg-amber-500/10 dark:bg-amber-500/[0.08] border border-amber-500/20 dark:border-amber-500/25 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
          <span className="leading-relaxed">
            This action cannot be undone. The link and your personal curator notes will be permanently removed. Any shelves/collections will remain intact.
          </span>
        </div>

        {error && (
          <div className="p-3 rounded-[12px] bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-start gap-2">
            <span>{error}</span>
          </div>
        )}

        {/* Modal Controls */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-shelf-borderLight/40 dark:border-shelf-borderDark/40">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            size="sm"
            onClick={handleConfirm}
            disabled={isDeleting}
            icon={<Trash2 className="w-3.5 h-3.5" />}
          >
            {isDeleting ? 'Deleting...' : 'Delete Bookmark'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

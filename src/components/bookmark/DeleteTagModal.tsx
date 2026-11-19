import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Trash2, Tag as TagIcon, Loader2, AlertCircle } from 'lucide-react';
import { useTags } from '../../context/TagContext';
import type { Tag } from '../../types';

export interface DeleteTagModalProps {
  isOpen: boolean;
  onClose: () => void;
  tag: Tag | null;
  bookmarkCount: number;
  onDeleted?: (deletedTag: Tag) => void;
}

export const DeleteTagModal: React.FC<DeleteTagModalProps> = ({
  isOpen,
  onClose,
  tag,
  bookmarkCount,
  onDeleted,
}) => {
  const { deleteTag } = useTags();
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!tag) return null;

  const handleConfirm = async () => {
    if (isDeleting) return;
    setIsDeleting(true);
    setError(null);

    const { success, error: delErr } = await deleteTag(tag.id);
    setIsDeleting(false);

    if (!success || delErr) {
      setError(delErr?.message || 'Failed to delete tag. Please try again.');
      return;
    }

    onDeleted?.(tag);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (!isDeleting) onClose();
      }}
      title="Delete Tag"
      description={`Are you sure you want to delete the tag "${tag.name}"?`}
      className="max-w-md"
    >
      <div className="space-y-4">
        {/* Tag details preview card */}
        <div className="p-3.5 rounded-[14px] bg-shelf-surfaceSubtle dark:bg-shelf-surfaceDarkElevated border border-shelf-borderLight/80 dark:border-shelf-borderDark/80 flex items-center gap-3">
          <div className="w-10 h-10 shrink-0 rounded-[10px] bg-shelf-terracottaMuted border border-shelf-terracotta/20 flex items-center justify-center text-shelf-terracotta">
            <TagIcon className="w-5 h-5 text-shelf-terracotta" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-shelf-dark dark:text-shelf-ivory truncate">
                #{tag.name}
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-shelf-surfaceElevated dark:bg-shelf-surfaceDark border border-shelf-borderLight dark:border-shelf-borderDark text-shelf-muted dark:text-shelf-mutedDark font-medium">
                {bookmarkCount} {bookmarkCount === 1 ? 'bookmark' : 'bookmarks'}
              </span>
            </div>
            <p className="text-xs text-shelf-muted dark:text-shelf-mutedDark mt-0.5">
              Tag will be removed from all associated bookmarks.
            </p>
          </div>
        </div>

        {/* Informational callout: Bookmarks are NOT deleted */}
        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-900 dark:text-amber-200">
          <p className="font-medium">No bookmarks will be deleted.</p>
          <p className="mt-0.5 text-amber-800/80 dark:text-amber-300/80">
            Deleting this tag only strips the label from your saved links. All {bookmarkCount} bookmarks will remain intact in your shelf.
          </p>
        </div>

        {error && (
          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 text-xs border border-red-200 dark:border-red-900/50">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={isDeleting}
            className="text-xs"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={handleConfirm}
            disabled={isDeleting}
            className="text-xs flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white"
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Deleting...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Tag</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

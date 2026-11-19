import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Trash2, AlertTriangle, FolderMinus, Loader2 } from 'lucide-react';
import { useCollections } from '../../context/CollectionContext';
import type { Collection } from '../../types';

export interface DeleteCollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  collection: Collection | null;
  bookmarkCount: number;
  onDeleted?: (deletedCollection: Collection) => void;
}

export const DeleteCollectionModal: React.FC<DeleteCollectionModalProps> = ({
  isOpen,
  onClose,
  collection,
  bookmarkCount,
  onDeleted,
}) => {
  const { deleteCollection } = useCollections();
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!collection) return null;

  const handleConfirm = async () => {
    if (isDeleting) return;
    setIsDeleting(true);
    setError(null);

    const { success, error: delErr } = await deleteCollection(collection.id);
    setIsDeleting(false);

    if (!success || delErr) {
      setError(delErr?.message || 'Failed to delete collection. Please try again.');
      return;
    }

    onDeleted?.(collection);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (!isDeleting) onClose();
      }}
      title="Delete Shelf"
      description={`Are you sure you want to delete "${collection.name}"?`}
      className="max-w-md"
    >
      <div className="space-y-4">
        {/* Collection details preview card */}
        <div className="p-3.5 rounded-[14px] bg-shelf-surfaceSubtle dark:bg-shelf-surfaceDarkElevated border border-shelf-borderLight/80 dark:border-shelf-borderDark/80 flex items-center gap-3">
          <div className="w-10 h-10 shrink-0 rounded-[10px] bg-shelf-terracottaMuted border border-shelf-terracotta/20 flex items-center justify-center text-shelf-terracotta">
            <FolderMinus className="w-5 h-5 text-shelf-terracotta" />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="font-editorial text-sm font-medium text-shelf-dark dark:text-shelf-ivory truncate">
              {collection.name}
            </h4>
            <span className="font-mono text-[11px] text-shelf-muted dark:text-shelf-mutedDark block">
              {bookmarkCount} {bookmarkCount === 1 ? 'bookmark' : 'bookmarks'} currently assigned
            </span>
          </div>
        </div>

        {/* Safeguard & orphan policy notice */}
        <div className="p-3.5 rounded-[12px] bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
          <div className="space-y-1 leading-relaxed">
            <p className="font-medium text-amber-900 dark:text-amber-200">
              Your bookmarks will remain safe.
            </p>
            <p>
              This collection will be permanently removed. The {bookmarkCount} bookmark{bookmarkCount === 1 ? '' : 's'} inside it will <strong>NOT</strong> be deleted — they will simply become unassigned and remain available under <em>All Bookmarks</em>.
            </p>
          </div>
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
            icon={isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
          >
            {isDeleting ? 'Deleting...' : 'Delete Shelf'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

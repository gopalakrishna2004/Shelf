import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Pencil, AlertCircle, Loader2 } from 'lucide-react';
import { useTags } from '../../context/TagContext';
import type { Tag } from '../../types';

export interface RenameTagModalProps {
  isOpen: boolean;
  onClose: () => void;
  tag: Tag | null;
  onRenamed?: (tag: Tag) => void;
}

export const RenameTagModal: React.FC<RenameTagModalProps> = ({
  isOpen,
  onClose,
  tag,
  onRenamed,
}) => {
  const { updateTag, tags } = useTags();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && tag) {
      setName(tag.name);
      setError(null);
      setIsSubmitting(false);
    }
  }, [isOpen, tag]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tag || isSubmitting) return;

    setError(null);
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Please enter a tag name.');
      return;
    }

    // Client-side duplicate check (excluding this tag)
    const duplicate = tags.some(
      (t) => t.id !== tag.id && t.name.trim().toLowerCase() === trimmedName.toLowerCase()
    );
    if (duplicate) {
      setError(`A tag named "${trimmedName}" already exists.`);
      return;
    }

    setIsSubmitting(true);

    const { tag: updated, error: updateErr } = await updateTag(tag.id, {
      name: trimmedName,
    });

    setIsSubmitting(false);

    if (updateErr || !updated) {
      setError(updateErr?.message || 'Failed to rename tag. Please try again.');
      return;
    }

    onRenamed?.(updated);
    onClose();
  };

  if (!tag) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Rename Tag"
      description={`Update the name of the tag "${tag.name}".`}
      className="max-w-md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="rename-tag-name" className="block text-xs font-medium text-shelf-dark dark:text-shelf-ivory mb-1.5">
            Tag Name
          </label>
          <Input
            id="rename-tag-name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (error) setError(null);
            }}
            disabled={isSubmitting}
            autoFocus
          />
        </div>

        {error && (
          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 text-xs border border-red-200 dark:border-red-900/50">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-xs"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={isSubmitting || !name.trim()}
            className="text-xs flex items-center gap-1.5"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Pencil className="w-3.5 h-3.5" />
                <span>Save Changes</span>
              </>
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Tag as TagIcon, AlertCircle, Loader2 } from 'lucide-react';
import { useTags } from '../../context/TagContext';

export interface CreateTagModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (name: string) => void;
  initialName?: string;
}

export const CreateTagModal: React.FC<CreateTagModalProps> = ({
  isOpen,
  onClose,
  onCreated,
  initialName = '',
}) => {
  const { createTag, tags } = useTags();
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setName(initialName);
      setError(null);
      setIsSubmitting(false);
    }
  }, [isOpen, initialName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setError(null);
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Please enter a tag name.');
      return;
    }

    // Client-side quick duplicate validation
    const duplicateExists = tags.some(
      (t) => t.name.trim().toLowerCase() === trimmedName.toLowerCase()
    );
    if (duplicateExists) {
      setError(`A tag named "${trimmedName}" already exists.`);
      return;
    }

    setIsSubmitting(true);

    const { tag, error: createError } = await createTag({
      name: trimmedName,
    });

    if (createError || !tag) {
      setIsSubmitting(false);
      setError(createError?.message || 'Failed to create tag. Please try again.');
      return;
    }

    onCreated?.(tag.name);

    // Reset and close
    setName('');
    setError(null);
    setIsSubmitting(false);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="New Tag"
      description="Create a flexible label to organise bookmarks across any shelf."
      className="max-w-md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="tag-name" className="block text-xs font-medium text-shelf-dark dark:text-shelf-ivory mb-1.5">
            Tag Name
          </label>
          <Input
            id="tag-name"
            placeholder="e.g. Design, Research, AI, Reference"
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
                <span>Creating...</span>
              </>
            ) : (
              <>
                <TagIcon className="w-3.5 h-3.5" />
                <span>Create Tag</span>
              </>
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

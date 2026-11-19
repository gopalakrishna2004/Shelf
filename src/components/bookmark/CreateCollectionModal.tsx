import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { FolderPlus, AlertCircle, Loader2 } from 'lucide-react';
import { useCollections } from '../../context/CollectionContext';

export interface CreateCollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (name: string, description: string) => void;
  initialName?: string;
  initialDescription?: string;
}

export const CreateCollectionModal: React.FC<CreateCollectionModalProps> = ({
  isOpen,
  onClose,
  onCreated,
  initialName = '',
  initialDescription = '',
}) => {
  const { createCollection, collections } = useCollections();
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setName(initialName);
      setDescription(initialDescription);
      setError(null);
      setIsSubmitting(false);
    }
  }, [isOpen, initialName, initialDescription]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setError(null);
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Please enter a collection name.');
      return;
    }

    // Client-side quick duplicate validation
    const duplicateExists = collections.some(
      (c) => c.name.trim().toLowerCase() === trimmedName.toLowerCase()
    );
    if (duplicateExists) {
      setError(`A collection named "${trimmedName}" already exists.`);
      return;
    }

    setIsSubmitting(true);

    const { collection, error: createError } = await createCollection({
      name: trimmedName,
      description: description.trim() || undefined,
    });

    if (createError || !collection) {
      setIsSubmitting(false);
      setError(createError?.message || 'Failed to create collection. Please try again.');
      return;
    }

    onCreated?.(collection.name, collection.description || '');

    // Reset and close
    setName('');
    setDescription('');
    setError(null);
    setIsSubmitting(false);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="New Shelf"
      description="Organise related articles, tools, and reading lists into a dedicated space."
      className="max-w-md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="collection-name" className="block text-xs font-medium text-shelf-dark dark:text-shelf-ivory mb-1.5">
            Shelf Name
          </label>
          <Input
            id="collection-name"
            placeholder="e.g. Design Systems, Typography, LLM Papers"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (error) setError(null);
            }}
            required
            autoFocus
          />
        </div>

        <div>
          <label htmlFor="collection-desc" className="block text-xs font-medium text-shelf-dark dark:text-shelf-ivory mb-1.5">
            Description <span className="text-shelf-muted dark:text-shelf-mutedDark font-normal">(Optional)</span>
          </label>
          <textarea
            id="collection-desc"
            rows={3}
            placeholder="Add context or notes about what belongs on this shelf..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full bg-shelf-surfaceLight dark:bg-shelf-surfaceDark text-shelf-dark dark:text-shelf-ivory placeholder:text-shelf-muted/60 dark:placeholder:text-shelf-mutedDark/50 border border-shelf-borderLight/80 dark:border-shelf-borderDark/80 rounded-[12px] text-xs sm:text-sm p-3.5 focus-ring transition-all hover:border-shelf-stone dark:hover:border-shelf-muted shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
          />
        </div>

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/25 text-xs text-red-600 dark:text-red-400 rounded-[12px] flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-shelf-borderLight/40 dark:border-shelf-borderDark/40">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            icon={isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FolderPlus className="w-3.5 h-3.5" />}
            disabled={!name.trim() || isSubmitting}
          >
            {isSubmitting ? 'Creating...' : 'Create Shelf'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

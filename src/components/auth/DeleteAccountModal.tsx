import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useAuth } from '../../hooks/useAuth';
import { AlertTriangle, Loader2, Trash2 } from 'lucide-react';

export interface DeleteAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DeleteAccountModal: React.FC<DeleteAccountModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { deleteAccount, user } = useAuth();
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isConfirmed = confirmText.trim() === 'DELETE';

  const handleClose = () => {
    if (isDeleting) return;
    setConfirmText('');
    setError(null);
    onClose();
  };

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConfirmed || isDeleting) return;

    setError(null);
    setIsDeleting(true);

    try {
      const { error: deleteErr } = await deleteAccount();
      if (deleteErr) {
        setIsDeleting(false);
        const msg = deleteErr.message || 'Failed to delete account.';
        if (msg.toLowerCase().includes('edge function') || msg.toLowerCase().includes('not found')) {
          setError(
            `${msg} Ensure the "delete-account" Supabase Edge Function is deployed (see supabase/functions/delete-account/README.md).`
          );
        } else {
          setError(msg);
        }
      } else {
        handleClose();
      }
    } catch (err: any) {
      setIsDeleting(false);
      setError(err?.message || 'An unexpected error occurred while deleting your account.');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Delete Shelf Account"
      description="This action is permanent and completely irreversible."
      className="max-w-md"
      footer={
        <>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleClose}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            size="sm"
            onClick={handleDelete}
            disabled={!isConfirmed || isDeleting}
            icon={
              isDeleting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Trash2 className="w-3.5 h-3.5" />
              )
            }
          >
            {isDeleting ? 'Deleting Account...' : 'Permanently Delete'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleDelete} className="space-y-4">
        <div className="p-4 rounded-[16px] border border-red-500/25 bg-red-500/10 text-red-600 dark:text-red-400 flex items-start gap-3 text-xs">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold">Irreversible Account Deletion</p>
            <p className="opacity-90 leading-relaxed">
              All personal libraries, bookmark records, and account credentials for{' '}
              <strong className="font-semibold underline">{user?.email || 'this account'}</strong>{' '}
              will be permanently removed.
            </p>
          </div>
        </div>

        <div>
          <label
            htmlFor="confirm-delete-input"
            className="block text-xs font-medium text-shelf-dark dark:text-shelf-ivory mb-1.5"
          >
            Type <span className="font-mono text-red-600 dark:text-red-400 font-bold">DELETE</span> to confirm:
          </label>
          <Input
            id="confirm-delete-input"
            type="text"
            placeholder="DELETE"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            disabled={isDeleting}
            autoFocus
            className="font-mono text-xs"
          />
        </div>

        {error && (
          <div className="p-3.5 rounded-[14px] bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}
      </form>
    </Modal>
  );
};

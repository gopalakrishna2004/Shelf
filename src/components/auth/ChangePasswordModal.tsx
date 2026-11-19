import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useAuth } from '../../hooks/useAuth';
import { Lock, KeyRound, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

export interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { changePassword } = useAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const clearForm = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setError(null);
    setSuccess(null);
  };

  const handleClose = () => {
    if (isUpdating) return;
    clearForm();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isUpdating) return;

    setError(null);
    setSuccess(null);

    // 1. Current password check
    if (!currentPassword) {
      setError('Please enter your current password.');
      return;
    }

    // 2. Minimum length check
    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters in length.');
      return;
    }

    // 3. Confirmation check
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match. Please re-enter them carefully.');
      return;
    }

    // 4. Protection against reusing current password
    if (currentPassword === newPassword) {
      setError('New password cannot be the same as your current password.');
      return;
    }

    setIsUpdating(true);
    const { error: changeErr } = await changePassword(currentPassword, newPassword);
    setIsUpdating(false);

    if (changeErr) {
      setError(changeErr.message);
    } else {
      setSuccess('Your password has been changed successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      setTimeout(() => {
        handleClose();
      }, 1800);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Change Password"
      description="Update your Shelf account password. Password fields are kept securely masked."
      className="max-w-md"
      footer={
        <>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleClose}
            disabled={isUpdating}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={handleSubmit}
            disabled={isUpdating || !currentPassword || !newPassword || !confirmPassword}
            icon={
              isUpdating ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : undefined
            }
          >
            {isUpdating ? 'Saving Changes...' : 'Save Changes'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Current Password Field */}
        <div>
          <label
            htmlFor="change-current-password"
            className="block text-xs font-medium text-shelf-dark dark:text-shelf-ivory mb-1.5"
          >
            Current Password
          </label>
          <Input
            id="change-current-password"
            type="password"
            placeholder="Enter your current password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            disabled={isUpdating}
            icon={<Lock className="w-3.5 h-3.5" />}
            required
            autoFocus
          />
        </div>

        {/* New Password Field */}
        <div>
          <label
            htmlFor="change-new-password"
            className="block text-xs font-medium text-shelf-dark dark:text-shelf-ivory mb-1.5"
          >
            New Password
          </label>
          <Input
            id="change-new-password"
            type="password"
            placeholder="Minimum 6 characters"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            disabled={isUpdating}
            icon={<KeyRound className="w-3.5 h-3.5" />}
            required
          />
        </div>

        {/* Confirm New Password Field */}
        <div>
          <label
            htmlFor="change-confirm-password"
            className="block text-xs font-medium text-shelf-dark dark:text-shelf-ivory mb-1.5"
          >
            Confirm New Password
          </label>
          <Input
            id="change-confirm-password"
            type="password"
            placeholder="Re-enter your new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={isUpdating}
            icon={<KeyRound className="w-3.5 h-3.5" />}
            required
          />
        </div>

        {/* Validation / Error Message */}
        {error && (
          <div className="p-3.5 rounded-[14px] bg-shelf-terracottaMuted border border-shelf-terracotta/25 text-shelf-terracotta text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="p-3.5 rounded-[14px] bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400 text-xs flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{success}</span>
          </div>
        )}
      </form>
    </Modal>
  );
};

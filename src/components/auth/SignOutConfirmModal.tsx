import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Avatar, getAvatarUrlFromUser, getUserDisplayName } from '../ui/Avatar';
import { useAuth } from '../../hooks/useAuth';
import { LogOut, Loader2 } from 'lucide-react';

export interface SignOutConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SignOutConfirmModal: React.FC<SignOutConfirmModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { signOut, user } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    try {
      const { error } = await signOut();
      if (error) {
        console.error('[Shelf Auth] Failed to sign out:', error);
        setIsSigningOut(false);
      } else {
        onClose();
      }
    } catch (err) {
      console.error('[Shelf Auth] Unexpected error during sign out:', err);
      setIsSigningOut(false);
    }
  };

  const handleCancel = () => {
    if (isSigningOut) return;
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleCancel}
      title="Sign out of Shelf"
      description="You will be returned to the authentication screen."
      className="max-w-md"
      footer={
        <>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleCancel}
            disabled={isSigningOut}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={handleSignOut}
            disabled={isSigningOut}
            icon={
              isSigningOut ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <LogOut className="w-3.5 h-3.5" />
              )
            }
          >
            {isSigningOut ? 'Signing Out...' : 'Sign Out'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-xs text-shelf-muted dark:text-shelf-mutedDark leading-relaxed">
          Are you sure you wish to sign out of your desktop workspace? Your preferences and saved bookmarks are securely stored on your account.
        </p>

        {user?.email && (
          <div className="p-3.5 bg-shelf-stone/20 dark:bg-black/25 border border-shelf-borderLight/60 dark:border-shelf-borderDark/70 rounded-[16px] flex items-center gap-3">
            <Avatar
              src={getAvatarUrlFromUser(user)}
              name={getUserDisplayName(user)}
              email={user.email}
              size="sm"
            />
            <div className="min-w-0 flex-1">
              <span className="text-xs sm:text-sm text-shelf-dark dark:text-shelf-ivory font-semibold truncate block">
                {getUserDisplayName(user)}
              </span>
              <span className="text-[11px] text-shelf-muted dark:text-shelf-mutedDark font-mono truncate block">
                {user.email}
              </span>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

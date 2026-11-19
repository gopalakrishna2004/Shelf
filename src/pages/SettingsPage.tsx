import React, { useState } from 'react';
import {
  Palette,
  Sliders,
  User as UserIcon,
  Database,
  Sun,
  Moon,
  Laptop,
  Check,
  LogOut,
  ShieldCheck,
  Cloud,
  KeyRound,
  AlertTriangle,
  Trash2,
  Edit3,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ExternalLink
} from 'lucide-react';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { cn } from '../lib/utils';
import { useAuth } from '../hooks/useAuth';
import { SignOutConfirmModal } from '../components/auth/SignOutConfirmModal';
import { DeleteAccountModal } from '../components/auth/DeleteAccountModal';
import { ChangePasswordModal } from '../components/auth/ChangePasswordModal';
import { Avatar, getAvatarUrlFromUser, getUserDisplayName, isGoogleAuthUser } from '../components/ui/Avatar';
import type { Theme, ViewMode } from '../types';

export interface SettingsPageProps {
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  defaultView: ViewMode;
  onDefaultViewChange: (mode: ViewMode) => void;
  openInNewTab: boolean;
  onOpenInNewTabChange: (val: boolean) => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  theme,
  onThemeChange,
  defaultView,
  onDefaultViewChange,
  openInNewTab,
  onOpenInNewTabChange,
}) => {
  const { user, updateProfile } = useAuth();
  const [isSignOutModalOpen, setIsSignOutModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false);

  // Profile Edit State
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);
  const [nameSuccess, setNameSuccess] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);

  const isGoogleUser = isGoogleAuthUser(user);

  const handleStartEditName = () => {
    setNameInput(getUserDisplayName(user));
    setNameError(null);
    setNameSuccess(null);
    setIsEditingName(true);
  };

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = nameInput.trim();
    if (!trimmed) {
      setNameError('Display name cannot be empty.');
      return;
    }
    setNameError(null);
    setNameSuccess(null);
    setIsSavingName(true);

    const { error } = await updateProfile(trimmed);
    setIsSavingName(false);

    if (error) {
      setNameError(error.message);
    } else {
      setNameSuccess('Display name updated successfully.');
      setIsEditingName(false);
      setTimeout(() => {
        setNameSuccess(null);
      }, 3000);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-10 py-2">
      {/* Page Header */}
      <div className="pb-4 border-b border-shelf-borderLight/50 dark:border-shelf-borderDark/50">
        <h1 className="font-editorial text-3xl sm:text-4xl font-medium tracking-tight text-shelf-dark dark:text-shelf-ivory">
          Settings &amp; Preferences
        </h1>
        <p className="mt-1.5 text-xs sm:text-sm text-shelf-muted dark:text-shelf-mutedDark leading-relaxed">
          Configure your personal reading environment, workspace layout, and account security.
        </p>
      </div>

      {/* 1. Appearance & Theme */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="p-1.5 rounded-[10px] bg-shelf-terracottaMuted text-shelf-terracotta">
              <Palette className="w-4 h-4" />
            </span>
            <h2 className="font-editorial text-2xl font-medium tracking-tight text-shelf-dark dark:text-shelf-ivory">
              Appearance &amp; <span className="text-shelf-terracotta italic font-serif">Theme</span>
            </h2>
          </div>
          <Badge variant="stone">System Synchronised</Badge>
        </div>
        <p className="text-xs text-shelf-muted dark:text-shelf-mutedDark">
          Choose your visual preference. Settings persist automatically across browser sessions.
        </p>

        {/* Tactile Theme Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
          {/* 1. Warm Ivory Card */}
          <button
            type="button"
            onClick={() => onThemeChange('light')}
            className={cn(
              "p-5 rounded-[18px] text-left transition-all duration-200 relative focus-ring flex flex-col justify-between h-40 bg-white dark:bg-shelf-surfaceDark",
              theme === 'light'
                ? "border-2 border-shelf-terracotta shadow-[0_8px_24px_rgba(201,75,54,0.14)] -translate-y-[1px]"
                : "border border-shelf-borderLight/80 dark:border-shelf-borderDark/80 hover:border-shelf-terracotta/50 hover:shadow-[0_4px_16px_rgba(0,0,0,0.04)]"
            )}
          >
            <div>
              <div className="flex items-center justify-between w-full mb-2">
                <div className="flex items-center gap-2">
                  <Sun className="w-4 h-4 text-shelf-terracotta" />
                  <span className="font-medium text-xs sm:text-sm text-shelf-dark dark:text-shelf-ivory">
                    Warm Ivory
                  </span>
                </div>
                {theme === 'light' && (
                  <div className="w-5 h-5 rounded-full bg-shelf-terracotta text-white flex items-center justify-center shrink-0 shadow-xs">
                    <Check className="w-3 h-3 stroke-[2.5]" />
                  </div>
                )}
              </div>

              {/* Theme Preview Swatch */}
              <div className="h-6 w-full rounded-[8px] bg-[#F3F0E9] border border-[#E2DDD4] px-2.5 flex items-center justify-between my-2">
                <span className="text-[10px] font-mono font-medium text-[#242321]">
                  Aa Ivory Canvas
                </span>
                <span className="w-2.5 h-2.5 rounded-full bg-[#C94B36] shadow-xs" />
              </div>
            </div>

            <p className="text-[11px] text-shelf-muted dark:text-shelf-mutedDark leading-relaxed">
              Warm ivory canvas with charcoal typography and terracotta accents.
            </p>
          </button>

          {/* 2. Charcoal Dark Card */}
          <button
            type="button"
            onClick={() => onThemeChange('dark')}
            className={cn(
              "p-5 rounded-[18px] text-left transition-all duration-200 relative focus-ring flex flex-col justify-between h-40 bg-white dark:bg-shelf-surfaceDark",
              theme === 'dark'
                ? "border-2 border-shelf-terracotta shadow-[0_8px_24px_rgba(201,75,54,0.18)] -translate-y-[1px]"
                : "border border-shelf-borderLight/80 dark:border-shelf-borderDark/80 hover:border-shelf-terracotta/50 hover:shadow-[0_4px_16px_rgba(0,0,0,0.04)]"
            )}
          >
            <div>
              <div className="flex items-center justify-between w-full mb-2">
                <div className="flex items-center gap-2">
                  <Moon className="w-4 h-4 text-shelf-terracotta" />
                  <span className="font-medium text-xs sm:text-sm text-shelf-dark dark:text-shelf-ivory">
                    Charcoal Dark
                  </span>
                </div>
                {theme === 'dark' && (
                  <div className="w-5 h-5 rounded-full bg-shelf-terracotta text-white flex items-center justify-center shrink-0 shadow-xs">
                    <Check className="w-3 h-3 stroke-[2.5]" />
                  </div>
                )}
              </div>

              {/* Theme Preview Swatch */}
              <div className="h-6 w-full rounded-[8px] bg-[#242321] border border-[#3A3834] px-2.5 flex items-center justify-between my-2">
                <span className="text-[10px] font-mono font-medium text-[#F3F0E9]">
                  Aa Charcoal Dark
                </span>
                <span className="w-2.5 h-2.5 rounded-full bg-[#C94B36] shadow-xs" />
              </div>
            </div>

            <p className="text-[11px] text-shelf-muted dark:text-shelf-mutedDark leading-relaxed">
              Deep charcoal surface with soft ivory typography for evening reading.
            </p>
          </button>

          {/* 3. System Card */}
          <button
            type="button"
            onClick={() => onThemeChange('system')}
            className={cn(
              "p-5 rounded-[18px] text-left transition-all duration-200 relative focus-ring flex flex-col justify-between h-40 bg-white dark:bg-shelf-surfaceDark",
              theme === 'system'
                ? "border-2 border-shelf-terracotta shadow-[0_8px_24px_rgba(201,75,54,0.14)] -translate-y-[1px]"
                : "border border-shelf-borderLight/80 dark:border-shelf-borderDark/80 hover:border-shelf-terracotta/50 hover:shadow-[0_4px_16px_rgba(0,0,0,0.04)]"
            )}
          >
            <div>
              <div className="flex items-center justify-between w-full mb-2">
                <div className="flex items-center gap-2">
                  <Laptop className="w-4 h-4 text-shelf-muted dark:text-shelf-mutedDark" />
                  <span className="font-medium text-xs sm:text-sm text-shelf-dark dark:text-shelf-ivory">
                    System Preference
                  </span>
                </div>
                {theme === 'system' && (
                  <div className="w-5 h-5 rounded-full bg-shelf-terracotta text-white flex items-center justify-center shrink-0 shadow-xs">
                    <Check className="w-3 h-3 stroke-[2.5]" />
                  </div>
                )}
              </div>

              {/* Theme Preview Swatch: Dual split */}
              <div className="h-6 w-full rounded-[8px] border border-shelf-borderLight dark:border-shelf-borderDark flex overflow-hidden my-2">
                <div className="flex-1 bg-[#F3F0E9] flex items-center justify-center text-[9px] font-mono text-[#242321]">
                  Light
                </div>
                <div className="flex-1 bg-[#242321] flex items-center justify-center text-[9px] font-mono text-[#F3F0E9]">
                  Dark
                </div>
              </div>
            </div>

            <p className="text-[11px] text-shelf-muted dark:text-shelf-mutedDark leading-relaxed">
              Automatically adapt to your operating system's light or dark schedule.
            </p>
          </button>
        </div>
      </section>

      {/* 2. Application Preferences */}
      <section className="space-y-4 pt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="p-1.5 rounded-[10px] bg-shelf-terracottaMuted text-shelf-terracotta">
              <Sliders className="w-4 h-4" />
            </span>
            <h2 className="font-editorial text-2xl font-medium tracking-tight text-shelf-dark dark:text-shelf-ivory">
              Library <span className="text-shelf-terracotta italic font-serif">Preferences</span>
            </h2>
          </div>
          <Badge variant="stone">Active</Badge>
        </div>

        <div className="p-6 rounded-[22px] bg-white dark:bg-shelf-surfaceDark border border-shelf-borderLight/70 dark:border-shelf-borderDark/80 shadow-[0_4px_20px_rgba(36,35,33,0.03)] space-y-5">
          {/* Default View Mode */}
          <div className="flex items-center justify-between py-2 sm:py-2.5 border-b border-shelf-borderLight/40 dark:border-shelf-borderDark/40">
            <div className="space-y-0.5 pr-4 flex-1">
              <span className="text-xs sm:text-sm font-medium text-shelf-dark dark:text-shelf-ivory block leading-snug">
                Default Bookmark View
              </span>
              <span className="text-[11px] sm:text-xs text-shelf-muted dark:text-shelf-mutedDark block leading-normal">
                Choose whether your library opens in Grid or compact List layout.
              </span>
            </div>
            <div className="inline-flex self-center border border-shelf-borderLight/80 dark:border-shelf-borderDark/80 rounded-[12px] p-1 bg-shelf-surfaceSubtle dark:bg-shelf-dark shrink-0">
              <button
                type="button"
                onClick={() => onDefaultViewChange('grid')}
                className={cn(
                  "px-3.5 py-1.5 text-xs font-medium rounded-[9px] transition-all duration-150 focus-ring",
                  defaultView === 'grid'
                    ? "bg-shelf-terracotta text-white shadow-[0_2px_6px_rgba(201,75,54,0.3)]"
                    : "text-shelf-muted dark:text-shelf-mutedDark hover:text-shelf-dark dark:hover:text-shelf-ivory"
                )}
              >
                Grid
              </button>
              <button
                type="button"
                onClick={() => onDefaultViewChange('list')}
                className={cn(
                  "px-3.5 py-1.5 text-xs font-medium rounded-[9px] transition-all duration-150 focus-ring",
                  defaultView === 'list'
                    ? "bg-shelf-terracotta text-white shadow-[0_2px_6px_rgba(201,75,54,0.3)]"
                    : "text-shelf-muted dark:text-shelf-mutedDark hover:text-shelf-dark dark:hover:text-shelf-ivory"
                )}
              >
                List
              </button>
            </div>
          </div>

          {/* Open Links in New Tab Switch */}
          <div className="flex items-center justify-between py-2 sm:py-2.5">
            <div className="space-y-0.5 pr-4 flex-1">
              <span className="text-xs sm:text-sm font-medium text-shelf-dark dark:text-shelf-ivory block leading-snug">
                Open Links in New Tab
              </span>
              <span className="text-[11px] sm:text-xs text-shelf-muted dark:text-shelf-mutedDark block leading-normal">
                Launch bookmarked links in a separate browser tab to keep Shelf active.
              </span>
            </div>
            <div className="flex items-center self-center shrink-0">
              <button
                type="button"
                role="switch"
                aria-checked={openInNewTab}
                aria-label="Toggle open links in new tab"
                onClick={() => onOpenInNewTabChange(!openInNewTab)}
                className={cn(
                  "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-ring",
                  openInNewTab ? "bg-shelf-terracotta" : "bg-shelf-stone dark:bg-shelf-borderDark"
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.2)] transition duration-200 ease-in-out",
                    openInNewTab ? "translate-x-5" : "translate-x-0"
                  )}
                />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Account & Profile (Simplified per Section 5B) */}
      <section className="space-y-4 pt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="p-1.5 rounded-[10px] bg-shelf-terracottaMuted text-shelf-terracotta">
              <UserIcon className="w-4 h-4" />
            </span>
            <h2 className="font-editorial text-2xl font-medium tracking-tight text-shelf-dark dark:text-shelf-ivory">
              Account &amp; <span className="text-shelf-terracotta italic font-serif">Profile</span>
            </h2>
          </div>
          <Badge variant="accent">
            <ShieldCheck className="w-3.5 h-3.5 mr-1" />
            Active Member
          </Badge>
        </div>

        {user ? (
          <div className="p-6 rounded-[22px] bg-white dark:bg-shelf-surfaceDark border border-shelf-borderLight/70 dark:border-shelf-borderDark/80 shadow-[0_4px_20px_rgba(36,35,33,0.03)] space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4 min-w-0 flex-1">
                <Avatar
                  src={getAvatarUrlFromUser(user)}
                  name={getUserDisplayName(user)}
                  email={user.email}
                  size="lg"
                  className="mt-0.5"
                />
                <div className="min-w-0 flex-1">
                  {!isEditingName ? (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-base font-medium text-shelf-dark dark:text-shelf-ivory truncate">
                          {getUserDisplayName(user)}
                        </span>
                        <button
                          type="button"
                          onClick={handleStartEditName}
                          title="Edit display name"
                          aria-label="Edit display name"
                          className="p-1.5 text-shelf-muted hover:text-shelf-dark dark:hover:text-shelf-ivory rounded-full hover:bg-shelf-stone/20 transition-colors focus-ring"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <span className="font-mono text-xs text-shelf-muted dark:text-shelf-mutedDark block">
                        {user.email}
                      </span>
                    </div>
                  ) : (
                    <form onSubmit={handleSaveName} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Input
                          type="text"
                          value={nameInput}
                          onChange={(e) => setNameInput(e.target.value)}
                          placeholder="Your display name"
                          disabled={isSavingName}
                          autoFocus
                          className="text-xs h-9 py-1 px-3 max-w-xs"
                          required
                        />
                        <Button
                          type="submit"
                          variant="primary"
                          size="sm"
                          disabled={isSavingName}
                          className="h-9 px-4 text-xs"
                        >
                          {isSavingName ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            'Save'
                          )}
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => setIsEditingName(false)}
                          disabled={isSavingName}
                          className="h-9 px-4 text-xs"
                        >
                          Cancel
                        </Button>
                      </div>
                    </form>
                  )}

                  {nameError && (
                    <div className="mt-2 text-xs text-shelf-terracotta flex items-center gap-1.5 font-mono">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{nameError}</span>
                    </div>
                  )}

                  {nameSuccess && (
                    <div className="mt-2 text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span>{nameSuccess}</span>
                    </div>
                  )}
                </div>
              </div>

              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsSignOutModalOpen(true)}
                icon={<LogOut className="w-3.5 h-3.5 text-shelf-terracotta" />}
                className="shrink-0"
              >
                Sign Out
              </Button>
            </div>
          </div>
        ) : (
          <div className="p-6 rounded-[22px] border border-dashed border-shelf-borderLight dark:border-shelf-borderDark bg-shelf-stone/10 dark:bg-shelf-surfaceDark/30 text-xs text-shelf-muted">
            No active session detected.
          </div>
        )}
      </section>

      {/* 4. Security & Password Management (Dedicated modal per Section 5A) */}
      <section className="space-y-4 pt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="p-1.5 rounded-[10px] bg-shelf-terracottaMuted text-shelf-terracotta">
              <KeyRound className="w-4 h-4" />
            </span>
            <h2 className="font-editorial text-2xl font-medium tracking-tight text-shelf-dark dark:text-shelf-ivory">
              Security &amp; <span className="text-shelf-terracotta italic font-serif">Password</span>
            </h2>
          </div>
          <Badge variant="stone">
            {isGoogleUser ? 'Google Single Sign-On' : 'Password Protection'}
          </Badge>
        </div>

        {isGoogleUser ? (
          <div className="p-6 rounded-[22px] bg-white dark:bg-shelf-surfaceDark border border-shelf-borderLight/70 dark:border-shelf-borderDark/80 shadow-[0_4px_20px_rgba(36,35,33,0.03)]">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-sm font-medium text-shelf-dark dark:text-shelf-ivory">
                    Google Single Sign-On Active
                  </h4>
                  <p className="text-xs text-shelf-muted dark:text-shelf-mutedDark leading-relaxed max-w-xl">
                    Your account authenticates directly through Google OAuth. Password security, multi-factor verification, and credentials recovery are maintained via your Google Account.
                  </p>
                </div>
              </div>

              <a
                href="https://myaccount.google.com/security"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-[12px] border border-shelf-borderLight dark:border-shelf-borderDark bg-shelf-surfaceSubtle hover:bg-shelf-stone/20 text-shelf-dark dark:text-shelf-ivory transition-colors shrink-0"
              >
                <span>Google Security</span>
                <ExternalLink className="w-3.5 h-3.5 text-shelf-muted" />
              </a>
            </div>
          </div>
        ) : (
          <div className="p-6 rounded-[22px] bg-white dark:bg-shelf-surfaceDark border border-shelf-borderLight/70 dark:border-shelf-borderDark/80 shadow-[0_4px_20px_rgba(36,35,33,0.03)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1 max-w-xl">
              <h4 className="text-sm font-medium text-shelf-dark dark:text-shelf-ivory">
                Account Password
              </h4>
              <p className="text-xs text-shelf-muted dark:text-shelf-mutedDark leading-relaxed">
                Ensure your Shelf account uses a strong, unique password. Passwords must be at least 6 characters in length.
              </p>
            </div>

            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setIsChangePasswordModalOpen(true)}
              icon={<KeyRound className="w-3.5 h-3.5 text-shelf-terracotta" />}
              className="shrink-0"
            >
              Change Password
            </Button>
          </div>
        )}
      </section>

      {/* 5. Cloud Infrastructure Status */}
      <section className="space-y-4 pt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="p-1.5 rounded-[10px] bg-shelf-terracottaMuted text-shelf-terracotta">
              <Database className="w-4 h-4" />
            </span>
            <h2 className="font-editorial text-2xl font-medium tracking-tight text-shelf-dark dark:text-shelf-ivory">
              Backend Architecture &amp; Persistence Status
            </h2>
          </div>
          <Badge variant="stone">Current Implementation</Badge>
        </div>

        <div className="p-6 rounded-[22px] bg-white dark:bg-shelf-surfaceDark border border-shelf-borderLight/70 dark:border-shelf-borderDark/80 shadow-[0_4px_20px_rgba(36,35,33,0.03)] space-y-4">
          <div className="flex items-start gap-3.5">
            <Cloud className="w-5 h-5 text-shelf-terracotta shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-sm font-medium text-shelf-dark dark:text-shelf-ivory">
                Authenticated Cloud Persistence Live
              </h4>
              <p className="text-xs text-shelf-muted dark:text-shelf-mutedDark leading-relaxed">
                Shelf uses Supabase PostgreSQL for cloud persistence. Bookmark, collection, and tag operations run through authenticated Supabase repositories, persisting data directly to the authenticated user&apos;s cloud database.
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-[14px] bg-shelf-stone/20 dark:bg-shelf-dark/50 text-xs text-shelf-muted dark:text-shelf-mutedDark leading-relaxed">
            <span className="font-semibold text-shelf-dark dark:text-shelf-ivory block mb-1">
              Data Persistence &amp; Security Architecture:
            </span>
            Shelf requires an active internet connection for normal application operations. User records are isolated and protected by PostgreSQL Row-Level Security (RLS) policies restricted to the authenticated user, and bookmark-tag associations are persisted atomically via transactional database functions.
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] font-mono text-shelf-muted dark:text-shelf-mutedDark">
            <span className="px-3 py-1 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 rounded-full font-medium border border-emerald-500/20">
              Cloud Persistence: Operational
            </span>
            <span className="px-3 py-1 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 rounded-full font-medium border border-emerald-500/20">
              Authentication: Operational
            </span>
            <span className="px-3 py-1 bg-shelf-stone/30 dark:bg-shelf-surfaceDark rounded-full border border-shelf-borderLight dark:border-shelf-borderDark">
              Row-Level Security: Enforced
            </span>
            <span className="px-3 py-1 bg-shelf-terracottaMuted text-shelf-terracotta rounded-full border border-shelf-terracotta/25">
              Architecture: Online-only
            </span>
          </div>
        </div>
      </section>

      {/* 6. Danger Zone */}
      <section className="space-y-4 pt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="p-1.5 rounded-[10px] bg-red-500/10 text-red-600 dark:text-red-400">
              <AlertTriangle className="w-4 h-4" />
            </span>
            <h2 className="font-editorial text-2xl font-medium tracking-tight text-shelf-dark dark:text-shelf-ivory">
              Danger Zone
            </h2>
          </div>
          <Badge variant="accent" className="bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20">
            Irreversible
          </Badge>
        </div>

        <div className="p-6 rounded-[22px] border border-red-500/20 bg-red-500/[0.02] dark:bg-red-500/[0.04] shadow-[0_4px_20px_rgba(180,30,20,0.03)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h4 className="text-sm font-medium text-shelf-dark dark:text-shelf-ivory">
              Permanently Delete Account
            </h4>
            <p className="text-xs text-shelf-muted dark:text-shelf-mutedDark max-w-xl leading-relaxed">
              Permanently erase your Shelf account, credentials, and all personal library bookmarks. This action cannot be undone.
            </p>
          </div>

          <Button
            type="button"
            variant="danger"
            size="sm"
            onClick={() => setIsDeleteModalOpen(true)}
            icon={<Trash2 className="w-3.5 h-3.5" />}
            className="shrink-0"
          >
            Delete Account
          </Button>
        </div>
      </section>

      {/* Modals */}
      <SignOutConfirmModal
        isOpen={isSignOutModalOpen}
        onClose={() => setIsSignOutModalOpen(false)}
      />

      <DeleteAccountModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
      />

      <ChangePasswordModal
        isOpen={isChangePasswordModalOpen}
        onClose={() => setIsChangePasswordModalOpen(false)}
      />
    </div>
  );
};

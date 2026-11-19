import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Home,
  Bookmark,
  Star,
  Plus,
  Settings,
  Layers,
  Link2,
  LogOut,
  FolderPlus,
  Tag as TagIcon,
  Upload,
  ChevronDown,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import type { PageId, Theme } from '../../types';
import { Brand } from './Brand';
import { NavItem } from '../navigation/NavItem';
import { ThemeToggle } from '../ui/ThemeToggle';
import { useAuth } from '../../hooks/useAuth';
import { SignOutConfirmModal } from '../auth/SignOutConfirmModal';
import { Avatar, getAvatarUrlFromUser, getUserDisplayName } from '../ui/Avatar';
import { cn } from '../../lib/utils';

export interface SidebarProps {
  currentPage: PageId;
  onNavigate: (page: PageId, id?: string) => void;
  onQuickAddClick?: () => void;
  onCreateCollectionClick: () => void;
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentPage,
  onNavigate,
  onQuickAddClick,
  onCreateCollectionClick,
  theme,
  onThemeChange,
  isCollapsed = false,
  onToggleCollapse,
}) => {
  const { user } = useAuth();
  const [isSignOutModalOpen, setIsSignOutModalOpen] = useState(false);
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const addMenuRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownCoords, setDropdownCoords] = useState<{ top: number; left: number; width?: number }>({
    top: 0,
    left: 0,
  });

  // Calculate floating dropdown coordinates when opening
  useEffect(() => {
    if (isAddMenuOpen && addMenuRef.current) {
      const rect = addMenuRef.current.getBoundingClientRect();
      if (isCollapsed) {
        setDropdownCoords({
          top: rect.top,
          left: rect.right + 8,
          width: 224,
        });
      } else {
        setDropdownCoords({
          top: rect.bottom + 6,
          left: rect.left + 16,
          width: rect.width - 32,
        });
      }
    }
  }, [isAddMenuOpen, isCollapsed]);

  // Dismiss menu on outside click
  useEffect(() => {
    if (!isAddMenuOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        addMenuRef.current &&
        !addMenuRef.current.contains(target) &&
        (!dropdownRef.current || !dropdownRef.current.contains(target))
      ) {
        setIsAddMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isAddMenuOpen]);

  // Dismiss menu on Escape key
  useEffect(() => {
    if (!isAddMenuOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setIsAddMenuOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isAddMenuOpen]);

  return (
    <aside
      className={cn(
        "fixed top-0 bottom-0 left-0 z-30 bg-[#EBE6DC]/70 dark:bg-[#1C1B19]/85 backdrop-blur-md border-r border-shelf-borderLight/70 dark:border-shelf-borderDark/70 flex flex-col justify-between transition-all duration-300 ease-in-out motion-reduce:transition-none select-none overflow-x-hidden",
        isCollapsed ? "w-[72px]" : "w-64"
      )}
      aria-label="Application Sidebar"
    >
      {/* Top Section */}
      <div className="flex flex-col">
        {/* Brand Header & Collapse Toggle */}
        <div
          className={cn(
            "border-b border-shelf-borderLight/50 dark:border-shelf-borderDark/50 transition-all duration-300",
            isCollapsed
              ? "flex flex-col items-center py-3.5 px-2 gap-2"
              : "flex items-center justify-between px-4 py-4 gap-2"
          )}
        >
          <Brand
            onClick={() => onNavigate('home')}
            collapsed={isCollapsed}
          />
          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              className="p-1.5 text-shelf-muted dark:text-shelf-mutedDark hover:text-shelf-dark dark:hover:text-shelf-ivory hover:bg-shelf-stone/20 dark:hover:bg-white/[0.05] rounded-[10px] transition-colors focus-ring shrink-0"
            >
              {isCollapsed ? (
                <PanelLeftOpen className="w-4 h-4 text-shelf-terracotta" />
              ) : (
                <PanelLeftClose className="w-4 h-4" />
              )}
            </button>
          )}
        </div>

        {/* Tactile Add Bookmarks Menu Trigger & Dropdown */}
        <div
          ref={addMenuRef}
          className={cn("relative", isCollapsed ? "px-2 pt-3 pb-1 flex justify-center" : "px-4 pt-4 pb-2")}
        >
          {isCollapsed ? (
            <button
              type="button"
              aria-haspopup="true"
              aria-expanded={isAddMenuOpen}
              aria-label="Add Bookmarks"
              title="Add Bookmarks"
              onClick={() => setIsAddMenuOpen((prev) => !prev)}
              className="w-10 h-10 flex items-center justify-center bg-shelf-terracotta hover:bg-shelf-terracottaHover text-white rounded-[12px] shadow-[0_3px_0_#962D1D,0_5px_14px_rgba(201,75,54,0.38)] dark:shadow-[0_3px_0_#751E11,0_5px_14px_rgba(201,75,54,0.28)] hover:-translate-y-[1px] active:translate-y-[1px] transition-all duration-150 focus-ring group select-none"
            >
              <Plus className="w-5 h-5 shrink-0 transition-transform duration-200 group-hover:rotate-90" />
            </button>
          ) : (
            <button
              type="button"
              aria-haspopup="true"
              aria-expanded={isAddMenuOpen}
              aria-label="Add Bookmarks menu"
              onClick={() => setIsAddMenuOpen((prev) => !prev)}
              className="w-full flex items-center justify-between px-3.5 py-2.5 text-xs sm:text-sm font-medium bg-shelf-terracotta hover:bg-shelf-terracottaHover text-white rounded-[12px] shadow-[0_4px_0_#962D1D,0_6px_18px_rgba(201,75,54,0.42)] dark:shadow-[0_4px_0_#751E11,0_6px_18px_rgba(201,75,54,0.32)] hover:-translate-y-[1px] hover:shadow-[0_5px_0_#962D1D,0_8px_24px_rgba(201,75,54,0.50)] dark:hover:shadow-[0_5px_0_#751E11,0_8px_24px_rgba(201,75,54,0.40)] active:translate-y-[2px] active:shadow-[0_1px_0_#962D1D,0_2px_6px_rgba(201,75,54,0.28)] dark:active:shadow-[0_1px_0_#751E11,0_2px_6px_rgba(201,75,54,0.22)] transition-all duration-150 focus-ring group select-none"
            >
              <span className="flex items-center gap-2.5 min-w-0">
                <Plus className="w-4 h-4 shrink-0 transition-transform duration-200 group-hover:rotate-90" />
                <span className="whitespace-nowrap font-medium tracking-tight">Add Bookmarks</span>
              </span>
              <ChevronDown
                className={cn(
                  "w-4 h-4 text-white/85 shrink-0 transition-transform duration-200",
                  isAddMenuOpen && "rotate-180"
                )}
              />
            </button>
          )}

          {/* Add Bookmarks Dropdown Menu (Portaled to prevent overflow clipping in compact mode) */}
          {typeof document !== 'undefined' && document.body && isAddMenuOpen && createPortal(
            <div
              ref={dropdownRef}
              role="menu"
              aria-label="Add Bookmarks options"
              aria-orientation="vertical"
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'fixed',
                top: dropdownCoords.top,
                left: dropdownCoords.left,
                width: dropdownCoords.width,
                zIndex: 60,
              }}
              className="p-1.5 rounded-[16px] bg-white dark:bg-shelf-surfaceDark border border-shelf-borderLight/90 dark:border-shelf-borderDark/90 shadow-[0_12px_36px_rgba(36,35,33,0.14),0_4px_12px_rgba(201,75,54,0.08)] dark:shadow-[0_16px_40px_rgba(0,0,0,0.65)] space-y-1 animate-in fade-in-0 zoom-in-95"
            >
              {/* Option 1: Quick Add Link */}
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setIsAddMenuOpen(false);
                  onQuickAddClick?.();
                }}
                className="w-full flex items-start gap-3 p-2.5 rounded-[12px] hover:bg-shelf-surfaceSubtle dark:hover:bg-white/[0.05] transition-colors text-left group focus-ring"
              >
                <span className="p-1.5 rounded-[9px] bg-shelf-terracottaMuted text-shelf-terracotta shrink-0 mt-0.5 group-hover:bg-shelf-terracotta group-hover:text-white transition-colors">
                  <Link2 className="w-4 h-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-semibold text-shelf-dark dark:text-shelf-ivory block leading-tight">
                    Add Link
                  </span>
                  <span className="text-[11px] text-shelf-muted dark:text-shelf-mutedDark block leading-tight mt-0.5 truncate">
                    Save URL to reading queue
                  </span>
                </div>
              </button>

              {/* Option 2: New Collection */}
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setIsAddMenuOpen(false);
                  onCreateCollectionClick();
                }}
                className="w-full flex items-start gap-3 p-2.5 rounded-[12px] hover:bg-shelf-surfaceSubtle dark:hover:bg-white/[0.05] transition-colors text-left group focus-ring"
              >
                <span className="p-1.5 rounded-[9px] bg-shelf-terracottaMuted text-shelf-terracotta shrink-0 mt-0.5 group-hover:bg-shelf-terracotta group-hover:text-white transition-colors">
                  <FolderPlus className="w-4 h-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-semibold text-shelf-dark dark:text-shelf-ivory block leading-tight">
                    New Shelf
                  </span>
                  <span className="text-[11px] text-shelf-muted dark:text-shelf-mutedDark block leading-tight mt-0.5 truncate">
                    Create curated collection
                  </span>
                </div>
              </button>

              {/* Option 3: Import Bookmarks (Coming Soon / Disabled per constraint) */}
              <div
                role="menuitem"
                aria-disabled="true"
                className="w-full flex items-start gap-3 p-2.5 rounded-[12px] opacity-60 cursor-not-allowed text-left select-none"
              >
                <span className="p-1.5 rounded-[9px] bg-shelf-stone/30 dark:bg-shelf-borderDark text-shelf-muted dark:text-shelf-mutedDark shrink-0 mt-0.5">
                  <Upload className="w-4 h-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-medium text-shelf-dark dark:text-shelf-ivory block leading-tight">
                      Import HTML
                    </span>
                    <span className="text-[9.5px] font-mono px-1.5 py-0.5 rounded-full bg-shelf-stone/40 dark:bg-shelf-borderDark text-shelf-muted dark:text-shelf-mutedDark font-medium">
                      Coming soon
                    </span>
                  </div>
                  <span className="text-[11px] text-shelf-muted dark:text-shelf-mutedDark block leading-tight mt-0.5 truncate">
                    From Chrome, Safari, or Brave
                  </span>
                </div>
              </div>
            </div>,
            document.body
          )}
        </div>

        {/* Primary Workspace Navigation */}
        <nav
          className={cn("py-3 space-y-1", isCollapsed ? "px-2" : "px-3")}
          aria-label="Library Navigation"
        >
          <NavItem
            label="Home"
            icon={<Home className="w-4 h-4" />}
            isActive={currentPage === 'home'}
            onClick={() => onNavigate('home')}
            collapsed={isCollapsed}
          />
          <NavItem
            label="All Bookmarks"
            icon={<Bookmark className="w-4 h-4" />}
            isActive={currentPage === 'all'}
            onClick={() => onNavigate('all')}
            collapsed={isCollapsed}
          />
          <NavItem
            label="Favourites"
            icon={<Star className="w-4 h-4" />}
            isActive={currentPage === 'favourites'}
            onClick={() => onNavigate('favourites')}
            collapsed={isCollapsed}
          />
          <NavItem
            label="Collections"
            icon={<Layers className="w-4 h-4" />}
            isActive={currentPage === 'collections' || currentPage === 'collection'}
            onClick={() => onNavigate('collections')}
            collapsed={isCollapsed}
          />
          <NavItem
            label="Tags"
            icon={<TagIcon className="w-4 h-4" />}
            isActive={currentPage === 'tags' || currentPage === 'tag'}
            onClick={() => onNavigate('tags')}
            collapsed={isCollapsed}
          />
        </nav>
      </div>

      {/* Footer / User Profile & System Utility */}
      {isCollapsed ? (
        /* Compact Mode Bottom Section */
        <div className="p-2 space-y-2 border-t border-shelf-borderLight/50 dark:border-shelf-borderDark/50 bg-[#E6E1D7]/50 dark:bg-black/20 flex flex-col items-center">
          {/* Compact User Profile representation */}
          {user && (
            <button
              type="button"
              onClick={() => setIsSignOutModalOpen(true)}
              title={`${getUserDisplayName(user)} (${user.email || ''}) — Click to sign out`}
              aria-label={`Signed in as ${getUserDisplayName(user)}. Click to sign out`}
              className="p-1 rounded-[12px] hover:bg-shelf-stone/20 dark:hover:bg-white/[0.05] transition-colors focus-ring"
            >
              <Avatar
                src={getAvatarUrlFromUser(user)}
                name={getUserDisplayName(user)}
                email={user.email}
                size="sm"
              />
            </button>
          )}

          {/* Settings Icon Button */}
          <div className="w-full">
            <NavItem
              label="Settings"
              icon={<Settings className="w-4 h-4" />}
              isActive={currentPage === 'settings'}
              onClick={() => onNavigate('settings')}
              collapsed={true}
            />
          </div>

          {/* Theme Toggle Icon Button */}
          <ThemeToggle theme={theme} onThemeChange={onThemeChange} variant="compact" />
        </div>
      ) : (
        /* Expanded Mode Bottom Section */
        <div className="p-3.5 space-y-2.5 border-t border-shelf-borderLight/50 dark:border-shelf-borderDark/50 bg-[#E6E1D7]/50 dark:bg-black/20">
          {/* Floating User Profile Card */}
          {user && (
            <div className="p-3 rounded-[16px] bg-white/80 dark:bg-shelf-surfaceDark/80 border border-shelf-borderLight/70 dark:border-shelf-borderDark/70 flex items-center justify-between shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <Avatar
                  src={getAvatarUrlFromUser(user)}
                  name={getUserDisplayName(user)}
                  email={user.email}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <span className="text-xs truncate text-shelf-dark dark:text-shelf-ivory font-semibold block leading-tight">
                    {getUserDisplayName(user)}
                  </span>
                  <span className="text-[10px] font-mono text-shelf-muted dark:text-shelf-mutedDark truncate block leading-tight mt-0.5">
                    {user.email}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSignOutModalOpen(true)}
                title="Sign out of Shelf"
                aria-label="Sign out"
                className="p-1.5 text-shelf-muted hover:text-shelf-terracotta dark:hover:text-shelf-terracotta transition-colors rounded-[10px] hover:bg-shelf-stone/20 dark:hover:bg-white/[0.05] focus-ring shrink-0 ml-1"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Bottom Bar: [ Settings button — flexible width ] [ Theme toggle ] */}
          <div className="flex items-center gap-2 pt-0.5">
            <div className="flex-1 min-w-0">
              <NavItem
                label="Settings"
                icon={<Settings className="w-4 h-4" />}
                isActive={currentPage === 'settings'}
                onClick={() => onNavigate('settings')}
              />
            </div>
            <ThemeToggle theme={theme} onThemeChange={onThemeChange} variant="compact" />
          </div>
        </div>
      )}

      <SignOutConfirmModal
        isOpen={isSignOutModalOpen}
        onClose={() => setIsSignOutModalOpen(false)}
      />
    </aside>
  );
};

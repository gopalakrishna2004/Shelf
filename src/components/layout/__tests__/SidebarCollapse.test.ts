import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  getStoredSidebarCollapsed,
  setStoredSidebarCollapsed,
  SIDEBAR_COLLAPSED_STORAGE_KEY,
} from '../../../hooks/useSidebarCollapse';

describe('Sidebar Collapse & Bottom Layout Refinement Suite', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const sidebarFilePath = path.resolve(__dirname, '../Sidebar.tsx');
  const sidebarSource = fs.readFileSync(sidebarFilePath, 'utf8');

  const rootLayoutFilePath = path.resolve(__dirname, '../../../layouts/RootLayout.tsx');
  const rootLayoutSource = fs.readFileSync(rootLayoutFilePath, 'utf8');

  const modalFilePath = path.resolve(__dirname, '../../ui/Modal.tsx');
  const modalSource = fs.readFileSync(modalFilePath, 'utf8');

  describe('1. Sidebar Toggle & Header Layout', () => {
    it('includes accessible collapse and expand controls with panel icons', () => {
      expect(sidebarSource).toContain('PanelLeftClose');
      expect(sidebarSource).toContain('PanelLeftOpen');
      expect(sidebarSource).toContain('title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}');
      expect(sidebarSource).toContain('aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}');
    });

    it('adapts header layout between expanded and compact modes', () => {
      // In compact mode: flex-col items-center py-3.5 px-2 gap-2
      expect(sidebarSource).toContain('isCollapsed');
      expect(sidebarSource).toContain('flex flex-col items-center py-3.5 px-2 gap-2');
      // In expanded mode: flex items-center justify-between px-4 py-4 gap-2
      expect(sidebarSource).toContain('flex items-center justify-between px-4 py-4 gap-2');
    });
  });

  describe('2. Expanded Mode & Bottom Refinement', () => {
    it('completely removes the Desktop v2.4 version label', () => {
      expect(sidebarSource).not.toContain('Desktop v2.4');
    });

    it('places Settings button beside the theme toggle occupying remaining flexible width', () => {
      // Must have [ Settings button - flexible width ] [ Theme toggle ]
      expect(sidebarSource).toContain('flex items-center gap-2');
      expect(sidebarSource).toContain('flex-1 min-w-0');
      // Both elements are rendered together in the bottom bar
      const bottomBarPattern = /flex-1 min-w-0[\s\S]*?<NavItem[\s\S]*?label="Settings"[\s\S]*?<ThemeToggle/;
      expect(bottomBarPattern.test(sidebarSource)).toBe(true);
    });

    it('retains the account card at the top of the footer in expanded mode', () => {
      expect(sidebarSource).toContain('getUserDisplayName(user)');
      expect(sidebarSource).toContain('Sign out of Shelf');
      expect(sidebarSource).toContain('LogOut');
    });

    it('contains only the six required top-level destinations and no individual collection/tag lists', () => {
      // Must contain the six required top-level NavItems
      expect(sidebarSource).toContain('label="Home"');
      expect(sidebarSource).toContain('label="All Bookmarks"');
      expect(sidebarSource).toContain('label="Favourites"');
      expect(sidebarSource).toContain('label="Collections"');
      expect(sidebarSource).toContain('label="Tags"');
      expect(sidebarSource).toContain('label="Settings"');

      // Does not contain individual collection lists or tag lists
      expect(sidebarSource).not.toContain('Collections Shelf Subsection');
      expect(sidebarSource).not.toContain('collections.map');
      expect(sidebarSource).not.toContain('tags.map');
    });
  });

  describe('3. Compact Mode Navigation Rail', () => {
    it('sets compact rail target width to 72px (within 68–76px requirement)', () => {
      expect(sidebarSource).toContain('isCollapsed ? "w-[72px]" : "w-64"');
    });

    it('renders Add Bookmarks as a tactile Plus icon button when collapsed', () => {
      expect(sidebarSource).toContain('isCollapsed ? (');
      expect(sidebarSource).toContain('aria-label="Add Bookmarks"');
      expect(sidebarSource).toContain('title="Add Bookmarks"');
      expect(sidebarSource).toContain('w-10 h-10 flex items-center justify-center bg-shelf-terracotta');
    });

    it('preserves sign out and account management in compact mode via compact avatar button', () => {
      expect(sidebarSource).toContain('Compact User Profile representation');
      expect(sidebarSource).toContain('onClick={() => setIsSignOutModalOpen(true)}');
      expect(sidebarSource).toContain('Click to sign out');
    });

    it('renders Settings and ThemeToggle as compact icon buttons in compact footer', () => {
      expect(sidebarSource).toContain('label="Settings"');
      expect(sidebarSource).toContain('collapsed={true}');
      expect(sidebarSource).toContain('variant="compact"');
    });
  });

  describe('4. Main Content Layout Adaptation in RootLayout', () => {
    it('adjusts main canvas margin smoothly according to sidebar collapse state', () => {
      expect(rootLayoutSource).toContain('isCollapsed ? "ml-[72px]" : "ml-64"');
      expect(rootLayoutSource).toContain('transition-[margin] duration-300 ease-in-out');
    });
  });

  describe('5. Bug 1 Regression — Add Bookmarks Dropdown Portaling & Overflow Fix', () => {
    it('renders Add Bookmarks dropdown via createPortal into document.body', () => {
      // Must use createPortal to document.body to prevent clipping by overflow-x-hidden on aside
      expect(sidebarSource).toContain('createPortal(');
      expect(sidebarSource).toContain('document.body');
    });

    it('calculates positioning dynamically so dropdown extends clear of 72px sidebar in compact mode', () => {
      expect(sidebarSource).toContain('left: rect.right + 8');
      expect(sidebarSource).toContain('width: 224');
    });

    it('retains all menu options, labels, and interactions', () => {
      expect(sidebarSource).toContain('Add Link');
      expect(sidebarSource).toContain('New Shelf');
      expect(sidebarSource).toContain('Import HTML');
      expect(sidebarSource).toContain('onQuickAddClick');
      expect(sidebarSource).toContain('onCreateCollectionClick');
    });

    it('dismisses dropdown cleanly on outside click and Escape key', () => {
      expect(sidebarSource).toContain('handleOutsideClick');
      expect(sidebarSource).toContain('mousedown');
      expect(sidebarSource).toContain('handleKeyDown');
      expect(sidebarSource).toContain('Escape');
    });
  });

  describe('6. Bug 2 Regression — Modal Portaling & Account Avatar Interaction', () => {
    it('portals Modal components to document.body to eliminate backdrop-blur and overflow containment', () => {
      expect(modalSource).toContain('createPortal(modalContent, document.body)');
    });

    it('compact avatar button opens the identical SignOutConfirmModal without corruption', () => {
      expect(sidebarSource).toContain('onClick={() => setIsSignOutModalOpen(true)}');
      expect(sidebarSource).toContain('<SignOutConfirmModal');
      expect(sidebarSource).toContain('isOpen={isSignOutModalOpen}');
    });

    it('modal preserves full-screen fixed overlay and centered dialog layout', () => {
      expect(modalSource).toContain('fixed inset-0 z-50 flex items-center justify-center');
      expect(modalSource).toContain('fixed inset-0 bg-[#242321]/50 dark:bg-black/75');
    });
  });

  describe('7. Bug 3 Regression — Toggle First-Click Reliability & State Sync', () => {
    it('defaults to expanded mode (false) when no preference is stored', () => {
      expect(localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY)).toBeNull();
      expect(getStoredSidebarCollapsed()).toBe(false);
    });

    it('toggles immediately on the first call without requiring double activation', () => {
      // Initial state is false (expanded)
      expect(getStoredSidebarCollapsed()).toBe(false);

      // First click/toggle call immediately toggles to true
      setStoredSidebarCollapsed(true);
      expect(getStoredSidebarCollapsed()).toBe(true);
      expect(localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY)).toBe('true');

      // Next toggle immediately returns to false
      setStoredSidebarCollapsed(false);
      expect(getStoredSidebarCollapsed()).toBe(false);
      expect(localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY)).toBe('false');
    });

    it('initializes correctly with saved compact preference after refresh', () => {
      localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, 'true');
      expect(getStoredSidebarCollapsed()).toBe(true);

      // First toggle after refresh with saved compact preference toggles back to expanded immediately
      setStoredSidebarCollapsed(false);
      expect(getStoredSidebarCollapsed()).toBe(false);
    });

    it('initializes correctly with saved expanded preference after refresh', () => {
      localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, 'false');
      expect(getStoredSidebarCollapsed()).toBe(false);

      // First toggle after refresh with saved expanded preference toggles to compact immediately
      setStoredSidebarCollapsed(true);
      expect(getStoredSidebarCollapsed()).toBe(true);
    });
  });
});

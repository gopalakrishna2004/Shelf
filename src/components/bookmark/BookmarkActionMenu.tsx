import React, { useState, useRef, useEffect, useId } from 'react';
import { MoreVertical, Pencil, Trash2 } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface BookmarkActionMenuProps {
  onEdit: () => void;
  onDelete: () => void;
  onOpenActions?: () => void;
  isEditDisabled?: boolean;
  isDeleteDisabled?: boolean;
  className?: string;
  triggerClassName?: string;
  iconClassName?: string;
}

export const BookmarkActionMenu: React.FC<BookmarkActionMenuProps> = ({
  onEdit,
  onDelete,
  onOpenActions,
  isEditDisabled = false,
  isDeleteDisabled = false,
  className,
  triggerClassName,
  iconClassName = 'w-4 h-4',
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);

  const rawId = useId();
  const menuId = `shelf-bookmark-menu-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const editBtnRef = useRef<HTMLButtonElement>(null);
  const deleteBtnRef = useRef<HTMLButtonElement>(null);

  const menuItems = [
    {
      id: 'edit',
      label: 'Edit',
      icon: Pencil,
      onClick: onEdit,
      disabled: isEditDisabled,
      ref: editBtnRef,
      variant: 'default' as const,
    },
    {
      id: 'delete',
      label: 'Delete',
      icon: Trash2,
      onClick: onDelete,
      disabled: isDeleteDisabled,
      ref: deleteBtnRef,
      variant: 'danger' as const,
    },
  ];

  const getEnabledIndices = () => {
    const indices: number[] = [];
    menuItems.forEach((item, idx) => {
      if (!item.disabled) indices.push(idx);
    });
    return indices;
  };

  const focusItem = (index: number) => {
    if (index >= 0 && index < menuItems.length) {
      setFocusedIndex(index);
      menuItems[index].ref.current?.focus();
    }
  };

  const openMenu = (initialFocus: 'first' | 'last' | 'none' = 'first') => {
    if (onOpenActions && !isMenuOpen) {
      onOpenActions();
    }
    setIsMenuOpen(true);

    const enabled = getEnabledIndices();
    if (initialFocus === 'first' && enabled.length > 0) {
      setTimeout(() => focusItem(enabled[0]), 0);
    } else if (initialFocus === 'last' && enabled.length > 0) {
      setTimeout(() => focusItem(enabled[enabled.length - 1]), 0);
    } else {
      setFocusedIndex(-1);
    }
  };

  const closeMenu = (restoreFocus = true) => {
    setIsMenuOpen(false);
    setFocusedIndex(-1);
    if (restoreFocus) {
      triggerRef.current?.focus();
    }
  };

  // Click outside listener
  useEffect(() => {
    if (!isMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        closeMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen]);

  // Handle keyboard on trigger button
  const handleTriggerKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      e.stopPropagation();
      openMenu('first');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      openMenu('last');
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      if (isMenuOpen) {
        closeMenu(true);
      } else {
        openMenu('first');
      }
    }
  };

  // Handle keyboard inside menu container
  const handleMenuKeyDown = (e: React.KeyboardEvent) => {
    const enabled = getEnabledIndices();
    if (enabled.length === 0) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      closeMenu(true);
      return;
    }

    if (e.key === 'Tab') {
      closeMenu(false);
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      e.stopPropagation();
      const currentPos = enabled.indexOf(focusedIndex);
      const nextIndex = currentPos === -1 || currentPos === enabled.length - 1 ? enabled[0] : enabled[currentPos + 1];
      focusItem(nextIndex);
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      const currentPos = enabled.indexOf(focusedIndex);
      const prevIndex = currentPos === -1 || currentPos === 0 ? enabled[enabled.length - 1] : enabled[currentPos - 1];
      focusItem(prevIndex);
      return;
    }

    if (e.key === 'Home') {
      e.preventDefault();
      e.stopPropagation();
      focusItem(enabled[0]);
      return;
    }

    if (e.key === 'End') {
      e.preventDefault();
      e.stopPropagation();
      focusItem(enabled[enabled.length - 1]);
      return;
    }
  };

  const handleItemClick = (e: React.MouseEvent, item: typeof menuItems[0]) => {
    e.preventDefault();
    e.stopPropagation();
    if (item.disabled) return;
    closeMenu(true);
    item.onClick();
  };

  const handleItemKeyDown = (e: React.KeyboardEvent, item: typeof menuItems[0]) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      if (item.disabled) return;
      closeMenu(true);
      item.onClick();
    }
  };

  return (
    <div className={cn("relative", className)}>
      <button
        ref={triggerRef}
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (isMenuOpen) {
            closeMenu(false);
          } else {
            openMenu('none');
          }
        }}
        onKeyDown={handleTriggerKeyDown}
        title="More options"
        aria-label="More options"
        aria-haspopup="menu"
        aria-expanded={isMenuOpen}
        aria-controls={isMenuOpen ? menuId : undefined}
        className={cn(
          "w-8 h-8 flex items-center justify-center text-shelf-muted dark:text-shelf-mutedDark hover:text-shelf-dark dark:hover:text-shelf-ivory opacity-60 group-hover:opacity-100 rounded-[8px] hover:bg-shelf-stone/20 dark:hover:bg-white/[0.05] transition-all duration-150 focus-ring",
          triggerClassName
        )}
      >
        <MoreVertical className={iconClassName} />
      </button>

      {isMenuOpen && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label="Bookmark options"
          tabIndex={-1}
          onKeyDown={handleMenuKeyDown}
          onClick={(e) => e.stopPropagation()}
          className="absolute right-0 top-full mt-1.5 z-40 w-36 p-1 rounded-[14px] bg-white dark:bg-shelf-surfaceDark border border-shelf-borderLight/90 dark:border-shelf-borderDark/90 shadow-[0_10px_30px_rgba(36,35,33,0.14),0_2px_8px_rgba(201,75,54,0.06)] dark:shadow-[0_14px_35px_rgba(0,0,0,0.6)] animate-in fade-in-0 zoom-in-95 focus:outline-none"
        >
          {menuItems.map((item, idx) => {
            const Icon = item.icon;
            const isDanger = item.variant === 'danger';
            return (
              <React.Fragment key={item.id}>
                {idx > 0 && (
                  <div className="my-1 border-t border-shelf-borderLight/40 dark:border-shelf-borderDark/40" />
                )}
                <button
                  ref={item.ref}
                  type="button"
                  role="menuitem"
                  tabIndex={focusedIndex === idx ? 0 : -1}
                  disabled={item.disabled}
                  aria-disabled={item.disabled}
                  onClick={(e) => handleItemClick(e, item)}
                  onKeyDown={(e) => handleItemKeyDown(e, item)}
                  onMouseEnter={() => !item.disabled && setFocusedIndex(idx)}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-[9px] transition-colors text-left focus:outline-none",
                    item.disabled && "opacity-40 cursor-not-allowed pointer-events-none",
                    !item.disabled && !isDanger && "text-shelf-dark dark:text-shelf-ivory hover:text-shelf-terracotta dark:hover:text-shelf-terracotta hover:bg-shelf-stone/20 dark:hover:bg-white/[0.05] focus:text-shelf-terracotta dark:focus:text-shelf-terracotta focus:bg-shelf-stone/20 dark:focus:bg-white/[0.05] focus:ring-1 focus:ring-shelf-terracotta/40",
                    !item.disabled && isDanger && "text-red-600 dark:text-red-400 hover:bg-red-500/10 focus:bg-red-500/15 focus:ring-1 focus:ring-red-500/40"
                  )}
                >
                  <Icon className={cn("w-3.5 h-3.5 shrink-0", isDanger ? "text-red-500" : "text-shelf-terracotta")} />
                  <span>{item.label}</span>
                </button>
              </React.Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
};

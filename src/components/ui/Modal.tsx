import React, { useEffect, useRef, useId } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

// Global modal stack to support nested modals and proper escape/trap hierarchy
let modalStack: string[] = [];

const isFocusable = (el: HTMLElement): boolean => {
  if (!el) return false;
  const disabled = (el as any).disabled || el.getAttribute('disabled');
  if (disabled === true || disabled === 'true' || disabled === '') return false;

  const tag = el.tagName ? el.tagName.toUpperCase() : '';
  if (tag === 'BUTTON' || tag === 'SELECT' || tag === 'TEXTAREA') return true;
  if (tag === 'A') return el.hasAttribute('href') || !!(el as any).href;
  if (tag === 'INPUT') {
    const type = (el.getAttribute('type') || (el as any).type || '').toLowerCase();
    return type !== 'hidden';
  }

  const tabIndex = el.getAttribute('tabindex');
  if (tabIndex !== null && tabIndex !== '-1') {
    return true;
  }
  return false;
};

const getFocusableElements = (container: HTMLElement): HTMLElement[] => {
  const elements: HTMLElement[] = [];
  const traverse = (node: Node) => {
    if (node && ((node as any).nodeType === 1 || (node as any).tagName)) {
      const el = node as HTMLElement;
      if (isFocusable(el)) {
        elements.push(el);
      }
    }
    for (const child of Array.from(node.childNodes || [])) {
      traverse(child);
    }
  };
  traverse(container);
  return elements;
};

const getAutoFocusElement = (container: HTMLElement): HTMLElement | null => {
  let autoFocusEl: HTMLElement | null = null;
  const traverse = (node: Node) => {
    if (autoFocusEl) return;
    if (node && ((node as any).nodeType === 1 || (node as any).tagName)) {
      const el = node as any;
      const propKey = Object.keys(el).find((k) => k.startsWith('__reactProps$'));
      if (
        el.autofocus ||
        el.autoFocus ||
        (propKey && (el[propKey]?.autoFocus || el[propKey]?.autofocus)) ||
        (typeof el.getAttribute === 'function' && el.getAttribute('autofocus') !== null)
      ) {
        autoFocusEl = el as HTMLElement;
        return;
      }
    }
    for (const child of Array.from(node.childNodes || [])) {
      traverse(child);
      if (autoFocusEl) return;
    }
  };
  traverse(container);
  return autoFocusEl;
};

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  className,
}) => {
  const modalBoxRef = useRef<HTMLDivElement>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const rawId = useId();
  const modalId = `shelf-modal-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const titleId = `shelf-modal-title-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const descId = `shelf-modal-desc-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`;

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!isOpen) return;

    // 1. Record original active element for focus restoration when closing
    previousActiveElementRef.current = (document.activeElement as HTMLElement) || null;

    // 2. Register modal in stack and lock background scroll
    modalStack.push(modalId);
    document.body.style.overflow = 'hidden';

    // 3. Move keyboard focus to an appropriate element inside the modal
    const focusTimer = setTimeout(() => {
      const container = modalBoxRef.current;
      if (!container) return;

      const autoFocusEl = getAutoFocusElement(container);
      if (autoFocusEl) {
        autoFocusEl.focus();
      } else {
        const focusable = getFocusableElements(container);
        if (focusable.length > 0) {
          focusable[0].focus();
        } else {
          container.focus();
        }
      }
    }, 0);

    // 4. Trap keyboard focus (Tab / Shift+Tab) & handle Escape dismissal
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only the topmost active modal handles keys
      const isTopModal = modalStack[modalStack.length - 1] === modalId;
      if (!isTopModal) return;

      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }

      if (e.key === 'Tab') {
        const container = modalBoxRef.current;
        if (!container) return;

        const focusableElements = getFocusableElements(container);

        if (focusableElements.length === 0) {
          e.preventDefault();
          container.focus();
          return;
        }

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          // Backward tab: cycle from first to last
          if (document.activeElement === firstElement || !container.contains(document.activeElement)) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          // Forward tab: cycle from last to first
          if (document.activeElement === lastElement || !container.contains(document.activeElement)) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      clearTimeout(focusTimer);
      window.removeEventListener('keydown', handleKeyDown);

      // Pop from stack and unlock scroll only when all modals close
      modalStack = modalStack.filter((id) => id !== modalId);
      if (modalStack.length === 0) {
        document.body.style.overflow = '';
      }

      // Restore focus to original trigger element
      if (previousActiveElementRef.current && typeof previousActiveElementRef.current.focus === 'function') {
        previousActiveElementRef.current.focus();
      }
    };
  }, [isOpen, modalId]);

  if (!isOpen) return null;

  const modalContent = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
    >
      {/* Soft warm backdrop */}
      <div
        className="fixed inset-0 bg-[#242321]/50 dark:bg-black/75 backdrop-blur-[4px] transition-opacity duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog box with generous, soft rounding and elevation */}
      <div
        ref={modalBoxRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={cn(
          "relative w-full max-w-lg bg-shelf-surfaceLight dark:bg-shelf-surfaceDark text-shelf-dark dark:text-shelf-ivory border border-shelf-borderLight/80 dark:border-shelf-borderDark/90 rounded-[22px] shadow-[0_20px_50px_-10px_rgba(36,35,33,0.15),0_0_1px_rgba(0,0,0,0.1)] dark:shadow-[0_24px_60px_-12px_rgba(0,0,0,0.6)] z-10 overflow-hidden transition-all duration-200 animate-in fade-in-0 zoom-in-95 focus:outline-none",
          className
        )}
      >
        <div className="flex items-start justify-between px-6 py-5 border-b border-shelf-borderLight/60 dark:border-shelf-borderDark/60 bg-shelf-surfaceSubtle/50 dark:bg-white/[0.01]">
          <div className="pr-4">
            <h3 id={titleId} className="font-editorial text-2xl font-medium tracking-tight text-shelf-dark dark:text-shelf-ivory">
              {title}
            </h3>
            {description && (
              <p id={descId} className="mt-1 text-xs text-shelf-muted dark:text-shelf-mutedDark leading-relaxed">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="p-1.5 text-shelf-muted hover:text-shelf-dark dark:hover:text-shelf-ivory rounded-full hover:bg-shelf-stone/20 dark:hover:bg-white/[0.05] transition-colors focus-ring shrink-0 -mr-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-6">
          {children}
        </div>

        {footer && (
          <div className="flex items-center justify-end gap-2.5 px-6 py-4 bg-shelf-surfaceSubtle dark:bg-black/20 border-t border-shelf-borderLight/60 dark:border-shelf-borderDark/60">
            {footer}
          </div>
        )}
      </div>
    </div>
  );

  if (typeof document !== 'undefined' && document.body) {
    return createPortal(modalContent, document.body);
  }

  return modalContent;
};

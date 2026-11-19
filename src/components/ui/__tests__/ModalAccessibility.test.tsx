import { useState } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { act } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Modal } from '../Modal';

describe('Modal Accessibility Suite (Focus Management, Traps & Nested Behavior)', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    document.body.style.overflow = '';
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
    // Clean up any stray modals in body
    document.querySelectorAll('[role="dialog"]').forEach((el) => {
      el.closest('.fixed')?.remove();
    });
    document.body.style.overflow = '';
  });

  it('moves keyboard focus to first focusable element inside modal upon opening', async () => {
    const handleClose = vi.fn();

    const TestComponent = () => {
      const [isOpen, setIsOpen] = useState(false);
      return (
        <div>
          <button id="open-btn" onClick={() => setIsOpen(true)}>
            Open Modal
          </button>
          <Modal isOpen={isOpen} onClose={handleClose} title="Accessible Modal">
            <input id="modal-input-1" placeholder="First input" />
            <input id="modal-input-2" placeholder="Second input" />
            <button id="modal-submit-btn">Submit</button>
          </Modal>
        </div>
      );
    };

    act(() => {
      root.render(<TestComponent />);
    });

    const openBtn = document.getElementById('open-btn') as HTMLButtonElement;
    openBtn.focus();
    expect(document.activeElement).toBe(openBtn);

    // Open the modal
    act(() => {
      openBtn.click();
    });

    // Allow requestAnimationFrame / focus timer to complete
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog).toBeTruthy();

    // Close button (X) in header is the first focusable element
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Close dialog');
  });

  it('respects autofocus attribute on child element inside modal', async () => {
    const TestComponent = () => (
      <Modal isOpen={true} onClose={vi.fn()} title="Autofocus Modal">
        <input id="first-input" placeholder="First" />
        <input id="autofocus-input" autoFocus placeholder="Auto focused" />
      </Modal>
    );

    act(() => {
      root.render(<TestComponent />);
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(document.activeElement?.id).toBe('autofocus-input');
  });

  it('traps keyboard focus with forward Tab and backward Shift+Tab', async () => {
    const handleClose = vi.fn();

    const TestComponent = () => (
      <Modal
        isOpen={true}
        onClose={handleClose}
        title="Focus Trap Modal"
        footer={<button id="modal-footer-btn">Confirm</button>}
      >
        <input id="field-1" placeholder="Field 1" />
      </Modal>
    );

    act(() => {
      root.render(<TestComponent />);
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    const footerBtn = document.getElementById('modal-footer-btn') as HTMLButtonElement;

    expect(document.activeElement?.getAttribute('aria-label')).toBe('Close dialog');

    // Forward Tab from last element (footerBtn) wraps back to first element (closeBtn)
    footerBtn.focus();
    expect(document.activeElement?.id).toBe('modal-footer-btn');

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    });
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Close dialog');

    // Backward Shift+Tab from first element (closeBtn) wraps to last element (footerBtn)
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }));
    });
    expect(document.activeElement?.id).toBe('modal-footer-btn');
  });

  it('restores focus to original trigger element when modal closes', async () => {
    const TestComponent = () => {
      const [isOpen, setIsOpen] = useState(false);
      return (
        <div>
          <button id="trigger-btn" onClick={() => setIsOpen(true)}>
            Open
          </button>
          <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Restoration Modal">
            <p>Modal body</p>
          </Modal>
        </div>
      );
    };

    act(() => {
      root.render(<TestComponent />);
    });

    const triggerBtn = document.getElementById('trigger-btn') as HTMLButtonElement;
    triggerBtn.focus();
    expect(document.activeElement?.id).toBe('trigger-btn');

    // Open modal
    act(() => {
      triggerBtn.click();
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(document.activeElement?.id).not.toBe('trigger-btn');

    // Close modal via Escape
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });

    expect(document.querySelector('[role="dialog"]')).toBeNull();
    // Focus must be restored to triggerBtn
    expect(document.activeElement?.id).toBe('trigger-btn');
  });

  it('dismisses modal on Escape key press and locks body overflow while open', async () => {
    const handleClose = vi.fn();

    act(() => {
      root.render(<Modal isOpen={true} onClose={handleClose} title="Dismissible Modal"><p>Content</p></Modal>);
    });

    expect(document.body.style.overflow).toBe('hidden');

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });

    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('handles nested modal hierarchy: only topmost modal traps focus and closes on Escape', async () => {
    const onCloseA = vi.fn();
    const onCloseB = vi.fn();

    const NestedTestComponent = () => {
      const [isBOpen, setIsBOpen] = useState(false);

      return (
        <div>
          <button id="page-btn">Page Trigger</button>
          <Modal isOpen={true} onClose={onCloseA} title="Modal A">
            <button id="open-b-btn" onClick={() => setIsBOpen(true)}>
              Open Modal B
            </button>
          </Modal>

          <Modal isOpen={isBOpen} onClose={() => { setIsBOpen(false); onCloseB(); }} title="Modal B">
            <input id="modal-b-input" placeholder="B input" />
          </Modal>
        </div>
      );
    };

    act(() => {
      root.render(<NestedTestComponent />);
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    const openBBtn = document.getElementById('open-b-btn') as HTMLButtonElement;
    expect(openBBtn).toBeTruthy();
    openBBtn.focus();
    expect(document.activeElement?.id).toBe('open-b-btn');

    // Open Modal B from inside Modal A
    act(() => {
      openBBtn.click();
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    const allDialogs = document.querySelectorAll('[role="dialog"]');
    expect(allDialogs.length).toBe(2);

    // Escape must close ONLY Modal B (the topmost modal), not Modal A!
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });

    expect(onCloseB).toHaveBeenCalledTimes(1);
    expect(onCloseA).not.toHaveBeenCalled();

    // Body scroll must remain locked because Modal A is still open!
    expect(document.body.style.overflow).toBe('hidden');

    // Focus must be restored to openBBtn inside Modal A
    expect(document.activeElement?.id).toBe('open-b-btn');
  });
});

import { createRoot, Root } from 'react-dom/client';
import { act } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BookmarkActionMenu } from '../BookmarkActionMenu';

describe('BookmarkActionMenu Accessibility Suite (ARIA, Keyboard Navigation & Activation)', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  it('provides appropriate accessible roles and ARIA attributes on trigger and menu container', () => {
    act(() => {
      root.render(<BookmarkActionMenu onEdit={vi.fn()} onDelete={vi.fn()} />);
    });

    const trigger = container.querySelector('button[aria-label="More options"]') as HTMLButtonElement;
    expect(trigger).toBeTruthy();
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(container.querySelector('[role="menu"]')).toBeNull();

    // Open menu
    act(() => {
      trigger.click();
    });

    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    const menu = container.querySelector('[role="menu"]');
    expect(menu).toBeTruthy();
    expect(menu?.getAttribute('aria-label')).toBe('Bookmark options');
    expect(trigger.getAttribute('aria-controls')).toBe(menu?.getAttribute('id'));

    // Check menu items
    const menuItems = container.querySelectorAll('[role="menuitem"]');
    expect(menuItems.length).toBe(2);
    expect(menuItems[0].textContent).toContain('Edit');
    expect(menuItems[1].textContent).toContain('Delete');
  });

  it('supports ArrowDown and ArrowUp keyboard navigation with wrapping', async () => {
    act(() => {
      root.render(<BookmarkActionMenu onEdit={vi.fn()} onDelete={vi.fn()} />);
    });

    const trigger = container.querySelector('button[aria-label="More options"]') as HTMLButtonElement;
    trigger.focus();

    // Press ArrowDown on trigger to open menu and focus first item
    act(() => {
      trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    const menu = container.querySelector('[role="menu"]') as HTMLDivElement;
    expect(menu).toBeTruthy();

    // First item (Edit) is focused initially
    expect(document.activeElement?.textContent).toContain('Edit');

    // ArrowDown moves focus to second item (Delete)
    act(() => {
      menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    });
    expect(document.activeElement?.textContent).toContain('Delete');

    // ArrowDown on last item wraps back to first item (Edit)
    act(() => {
      menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    });
    expect(document.activeElement?.textContent).toContain('Edit');

    // ArrowUp on first item wraps to last item (Delete)
    act(() => {
      menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    });
    expect(document.activeElement?.textContent).toContain('Delete');
  });

  it('supports Home and End keys for fast menu navigation', async () => {
    act(() => {
      root.render(<BookmarkActionMenu onEdit={vi.fn()} onDelete={vi.fn()} />);
    });

    const trigger = container.querySelector('button[aria-label="More options"]') as HTMLButtonElement;
    act(() => {
      trigger.click();
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    const menu = container.querySelector('[role="menu"]') as HTMLDivElement;

    // End focuses the last item (Delete)
    act(() => {
      menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    });
    expect(document.activeElement?.textContent).toContain('Delete');

    // Home focuses the first item (Edit)
    act(() => {
      menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    });
    expect(document.activeElement?.textContent).toContain('Edit');
  });

  it('closes menu and restores focus to trigger on Escape key press', async () => {
    act(() => {
      root.render(<BookmarkActionMenu onEdit={vi.fn()} onDelete={vi.fn()} />);
    });

    const trigger = container.querySelector('button[aria-label="More options"]') as HTMLButtonElement;
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    act(() => {
      trigger.click();
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(container.querySelector('[role="menu"]')).toBeTruthy();

    const menu = container.querySelector('[role="menu"]') as HTMLDivElement;
    act(() => {
      menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });

    expect(container.querySelector('[role="menu"]')).toBeNull();
    // Focus must be restored to trigger
    expect(document.activeElement).toBe(trigger);
  });

  it('supports Enter and Space keys to activate menu items', async () => {
    const handleEdit = vi.fn();
    const handleDelete = vi.fn();

    act(() => {
      root.render(<BookmarkActionMenu onEdit={handleEdit} onDelete={handleDelete} />);
    });

    const trigger = container.querySelector('button[aria-label="More options"]') as HTMLButtonElement;
    act(() => {
      trigger.click();
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    const items = container.querySelectorAll('[role="menuitem"]');
    const editBtn = items[0] as HTMLButtonElement;

    // Press Enter on Edit
    act(() => {
      editBtn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });

    expect(handleEdit).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[role="menu"]')).toBeNull();

    // Re-open and activate Delete via Space
    act(() => {
      trigger.click();
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    const deleteBtn = container.querySelectorAll('[role="menuitem"]')[1] as HTMLButtonElement;
    act(() => {
      deleteBtn.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    });

    expect(handleDelete).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[role="menu"]')).toBeNull();
  });

  it('prevents activation of disabled menu items via click or keyboard', async () => {
    const handleEdit = vi.fn();
    const handleDelete = vi.fn();

    act(() => {
      root.render(
        <BookmarkActionMenu
          onEdit={handleEdit}
          onDelete={handleDelete}
          isEditDisabled={true}
          isDeleteDisabled={false}
        />
      );
    });

    const trigger = container.querySelector('button[aria-label="More options"]') as HTMLButtonElement;
    act(() => {
      trigger.click();
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    const editBtn = container.querySelectorAll('[role="menuitem"]')[0] as HTMLButtonElement;
    expect(editBtn.getAttribute('aria-disabled')).toBe('true');
    expect((editBtn as any).disabled || editBtn.getAttribute('disabled')).toBeTruthy();

    // Attempt click
    act(() => {
      editBtn.click();
    });
    expect(handleEdit).not.toHaveBeenCalled();

    // Attempt Enter
    act(() => {
      editBtn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });
    expect(handleEdit).not.toHaveBeenCalled();

    // Enabled delete item still works
    const deleteBtn = container.querySelectorAll('[role="menuitem"]')[1] as HTMLButtonElement;
    act(() => {
      deleteBtn.click();
    });
    expect(handleDelete).toHaveBeenCalledTimes(1);
  });
});

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('DeleteBookmarkModal Theme Contrast & Styling Integrity', () => {
  const modalFilePath = path.resolve(__dirname, '../DeleteBookmarkModal.tsx');
  const modalContent = fs.readFileSync(modalFilePath, 'utf8');

  it('ensures preview card is theme-aware with dedicated dark background and border tokens', () => {
    // Must NOT have unhandled white/light background in dark mode
    expect(modalContent).toContain('dark:bg-shelf-dark/80');
    expect(modalContent).toContain('bg-shelf-surfaceSubtle');
    expect(modalContent).toContain('dark:border-shelf-borderDark/80');
  });

  it('ensures bookmark title and domain text have strong theme contrast', () => {
    // Title must have light mode dark text and dark mode ivory text
    expect(modalContent).toContain('text-shelf-dark dark:text-shelf-ivory');
    // Domain text must have secondary muted styling in both themes
    expect(modalContent).toContain('text-shelf-muted dark:text-shelf-mutedDark');
  });

  it('ensures favicon container is visually distinct in both themes', () => {
    expect(modalContent).toContain('bg-shelf-stone/20 dark:bg-shelf-borderDark/60');
    expect(modalContent).toContain('dark:border-shelf-borderDark/80');
  });

  it('ensures warning notice has comfortable contrast and avoids rejected color tokens', () => {
    // Must NOT use rejected arbitrary amber #E9A04B
    expect(modalContent).not.toContain('#E9A04B');
    // Warning notice must use accessible high-contrast amber tokens
    expect(modalContent).toContain('text-amber-900 dark:text-amber-200');
    expect(modalContent).toContain('text-amber-600 dark:text-amber-400');
  });
});

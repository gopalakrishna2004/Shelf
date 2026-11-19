import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BookmarkProvider, useBookmarks, type BookmarkContextType } from '../BookmarkContext';
import { CollectionProvider, useCollections, type CollectionContextType } from '../CollectionContext';
import { TagProvider, useTags, type TagContextType } from '../TagContext';
import { bookmarkRepository } from '../../services/bookmarkService';
import { collectionRepository } from '../../services/collectionService';
import { tagRepository } from '../../services/tagService';
import { BookmarkModal } from '../../components/bookmark/BookmarkModal';
import type { Bookmark, Collection, Tag } from '../../types';

// Mock auth hook with a mutable user ID
let mockAuthUser: { id: string } | null = { id: 'user_cross_domain_888' };
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: mockAuthUser }),
}));

/**
 * Stage 6, Increment 5: Cross-Domain Integration Test Suite
 *
 * Exercises the end-to-end integration between:
 * - BookmarkContext & repository
 * - CollectionContext & repository
 * - TagContext & repository
 * - QuickAdd / BookmarkModal component workflow
 * - Error propagation, retryLoad recovery, and input boundary edge cases
 */
describe('Stage 6 Increment 5: Cross-Domain Integration Test Suite', () => {
  let container: HTMLDivElement;
  let root: Root;

  // In-memory backing stores for realistic cross-domain persistence
  let storedBookmarks: Bookmark[];
  let storedCollections: Collection[];
  let storedTags: Tag[];

  // Captured context values
  let bookmarkCtx: BookmarkContextType;
  let collectionCtx: CollectionContextType;
  let tagCtx: TagContextType;

  const TestHarness: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
    return (
      <BookmarkProvider>
        <CollectionProvider>
          <TagProvider>
            <ContextCapture />
            {children}
          </TagProvider>
        </CollectionProvider>
      </BookmarkProvider>
    );
  };

  const ContextCapture: React.FC = () => {
    bookmarkCtx = useBookmarks();
    collectionCtx = useCollections();
    tagCtx = useTags();
    return null;
  };

  beforeEach(() => {
    mockAuthUser = { id: 'user_cross_domain_888' };
    storedBookmarks = [];
    storedCollections = [];
    storedTags = [];

    // Realistic Bookmark Repository Spies
    vi.spyOn(bookmarkRepository, 'getBookmarks').mockImplementation(async () => [...storedBookmarks]);
    vi.spyOn(bookmarkRepository, 'getBookmarkById').mockImplementation(async (_userId, id) => {
      return storedBookmarks.find((b) => b.id === id) || null;
    });
    vi.spyOn(bookmarkRepository, 'addBookmark').mockImplementation(async (_userId, input) => {
      const rawUrl = input.url?.trim() || '';
      if (!rawUrl) throw new Error('Please enter a website URL.');

      // Check duplicate
      if (storedBookmarks.some((b) => b.url.toLowerCase() === rawUrl.toLowerCase())) {
        throw new Error('This link is already saved in your shelf.');
      }

      const deduplicatedTags = Array.isArray(input.tags)
        ? [...new Set(input.tags.filter(Boolean))]
        : undefined;

      const newBm: Bookmark = {
        id: `bm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        url: rawUrl,
        title: input.title?.trim() || 'Fallback Title',
        domain: 'example.com',
        description: input.description?.trim() || undefined,
        collectionId: input.collectionId || undefined,
        collectionName: input.collectionName || undefined,
        tags: deduplicatedTags && deduplicatedTags.length > 0 ? deduplicatedTags : undefined,
        isFavourite: Boolean(input.isFavourite),
        createdAt: new Date().toISOString(),
      };
      storedBookmarks = [newBm, ...storedBookmarks];
      return newBm;
    });
    vi.spyOn(bookmarkRepository, 'updateBookmark').mockImplementation(async (_userId, id, updates) => {
      const idx = storedBookmarks.findIndex((b) => b.id === id);
      if (idx === -1) throw new Error('Bookmark not found.');

      let tags = storedBookmarks[idx].tags;
      if (updates.tags !== undefined) {
        const deduplicated = [...new Set(updates.tags.filter(Boolean))];
        tags = deduplicated.length > 0 ? deduplicated : undefined;
      }

      const updated: Bookmark = {
        ...storedBookmarks[idx],
        ...updates,
        tags,
        updatedAt: new Date().toISOString(),
      };
      storedBookmarks[idx] = updated;
      return updated;
    });
    vi.spyOn(bookmarkRepository, 'deleteBookmark').mockImplementation(async (_userId, id) => {
      storedBookmarks = storedBookmarks.filter((b) => b.id !== id);
    });
    vi.spyOn(bookmarkRepository, 'removeBookmarksFromCollection').mockImplementation(async (_userId, colId) => {
      storedBookmarks = storedBookmarks.map((b) =>
        b.collectionId === colId ? { ...b, collectionId: undefined, collectionName: undefined } : b
      );
    });
    vi.spyOn(bookmarkRepository, 'removeTagFromBookmarks').mockImplementation(async (_userId, tagId) => {
      storedBookmarks = storedBookmarks.map((b) => {
        if (!b.tags || !b.tags.includes(tagId)) return b;
        const remaining = b.tags.filter((t) => t !== tagId);
        return {
          ...b,
          tags: remaining.length > 0 ? remaining : undefined,
        };
      });
    });

    // Realistic Collection Repository Spies
    vi.spyOn(collectionRepository, 'getCollections').mockImplementation(async () => [...storedCollections]);
    vi.spyOn(collectionRepository, 'createCollection').mockImplementation(async (_userId, input) => {
      const name = input.name?.trim() || '';
      if (!name) throw new Error('Collection name cannot be empty.');
      const newCol: Collection = {
        id: `col_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        name,
        description: input.description?.trim() || undefined,
        color: input.color,
        createdAt: new Date().toISOString(),
      };
      storedCollections = [...storedCollections, newCol];
      return newCol;
    });
    vi.spyOn(collectionRepository, 'deleteCollection').mockImplementation(async (_userId, id) => {
      storedCollections = storedCollections.filter((c) => c.id !== id);
    });

    // Realistic Tag Repository Spies
    vi.spyOn(tagRepository, 'getTags').mockImplementation(async () => [...storedTags]);
    vi.spyOn(tagRepository, 'createTag').mockImplementation(async (_userId, input) => {
      const name = input.name?.trim().replace(/^#+/, '') || '';
      if (!name) throw new Error('Tag name cannot be empty.');
      const newTag: Tag = {
        id: `tag_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        name,
        createdAt: new Date().toISOString(),
      };
      storedTags = [...storedTags, newTag];
      return newTag;
    });
    vi.spyOn(tagRepository, 'deleteTag').mockImplementation(async (_userId, id) => {
      storedTags = storedTags.filter((t) => t.id !== id);
    });

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
    vi.restoreAllMocks();
  });

  const mountHarness = async (children?: React.ReactNode) => {
    await act(async () => {
      root.render(<TestHarness>{children}</TestHarness>);
    });
  };

  // =========================================================================
  // Section 2: Main Cross-Domain Workflow
  // =========================================================================
  describe('2. Main Cross-Domain Workflow: Collection, Bookmark, Tag, Edit & Deletion', () => {
    it('executes the full lifecycle across collections, bookmarks, and tags maintaining referential integrity', async () => {
      await mountHarness();

      // Step 1: Create a collection
      let createdCol: Collection | null = null;
      await act(async () => {
        const res = await collectionCtx.createCollection({
          name: 'Architecture & Design',
          description: 'Systems design and minimalism resources',
        });
        createdCol = res.collection;
      });
      expect(createdCol).not.toBeNull();
      expect(collectionCtx.collections.length).toBe(1);
      expect(collectionCtx.collections[0].name).toBe('Architecture & Design');

      // Step 2 & 3: Create two tags
      let tag1: Tag | null = null;
      let tag2: Tag | null = null;
      await act(async () => {
        const res1 = await tagCtx.createTag({ name: 'typescript' });
        tag1 = res1.tag;
        const res2 = await tagCtx.createTag({ name: 'react' });
        tag2 = res2.tag;
      });
      expect(tag1).not.toBeNull();
      expect(tag2).not.toBeNull();
      expect(tagCtx.tags.length).toBe(2);

      // Step 4: Create a bookmark through the existing workflow and assign collection + tags
      let createdBm: Bookmark | null = null;
      await act(async () => {
        const res = await bookmarkCtx.addBookmark({
          url: 'https://react.dev/learn',
          title: 'React Documentation',
          description: 'The official guides and modern patterns',
          collectionId: createdCol!.id,
          collectionName: createdCol!.name,
          tags: [tag1!.id, tag2!.id],
          isFavourite: true,
        });
        createdBm = res.bookmark;
      });
      expect(createdBm).not.toBeNull();
      expect(bookmarkCtx.bookmarks.length).toBe(1);

      // Step 5: Verify the bookmark appears in the expected collection
      const collectionBookmarks = bookmarkCtx.bookmarks.filter((b) => b.collectionId === createdCol!.id);
      expect(collectionBookmarks.length).toBe(1);
      expect(collectionBookmarks[0].id).toBe(createdBm!.id);
      expect(collectionBookmarks[0].title).toBe('React Documentation');

      // Step 6: Verify tag filtering returns the correct bookmark
      const tag1Bookmarks = bookmarkCtx.bookmarks.filter((b) => b.tags?.includes(tag1!.id));
      const tag2Bookmarks = bookmarkCtx.bookmarks.filter((b) => b.tags?.includes(tag2!.id));
      expect(tag1Bookmarks.length).toBe(1);
      expect(tag1Bookmarks[0].id).toBe(createdBm!.id);
      expect(tag2Bookmarks.length).toBe(1);
      expect(tag2Bookmarks[0].id).toBe(createdBm!.id);

      // Step 7: Verify tag counts update correctly
      const tag1Count = bookmarkCtx.bookmarks.filter((b) => b.tags?.includes(tag1!.id)).length;
      const tag2Count = bookmarkCtx.bookmarks.filter((b) => b.tags?.includes(tag2!.id)).length;
      expect(tag1Count).toBe(1);
      expect(tag2Count).toBe(1);

      // Step 8: Edit the bookmark (update title, remove tag2)
      await act(async () => {
        const updateRes = await bookmarkCtx.updateBookmark(createdBm!.id, {
          title: 'React 19 Documentation & Hooks',
          tags: [tag1!.id], // Removed tag2
        });
        expect(updateRes.error).toBeNull();
      });

      // Step 8 verification: Verify updated data is reflected across views
      const updatedBm = bookmarkCtx.bookmarks.find((b) => b.id === createdBm!.id);
      expect(updatedBm?.title).toBe('React 19 Documentation & Hooks');
      expect(updatedBm?.tags).toEqual([tag1!.id]);

      // Tag 1 count remains 1; Tag 2 count drops to 0
      expect(bookmarkCtx.bookmarks.filter((b) => b.tags?.includes(tag1!.id)).length).toBe(1);
      expect(bookmarkCtx.bookmarks.filter((b) => b.tags?.includes(tag2!.id)).length).toBe(0);

      // Step 9 & 10: Delete collection and verify bookmark disassociation
      await act(async () => {
        await collectionCtx.deleteCollection(createdCol!.id);
      });
      expect(collectionCtx.collections.length).toBe(0);
      // Bookmark is preserved, collectionId is cleanly disassociated
      const unassignedBm = bookmarkCtx.bookmarks.find((b) => b.id === createdBm!.id);
      expect(unassignedBm?.collectionId).toBeUndefined();
      expect(unassignedBm?.collectionName).toBeUndefined();

      // Step 11: Permanently delete the bookmark via existing application workflow
      await act(async () => {
        const delRes = await bookmarkCtx.deleteBookmark(createdBm!.id);
        expect(delRes.success).toBe(true);
      });

      // Step 12: Verify bookmark is completely absent and counts remain 0
      expect(bookmarkCtx.bookmarks.length).toBe(0);
      expect(bookmarkCtx.bookmarks.filter((b) => b.tags?.includes(tag1!.id)).length).toBe(0);
      expect(bookmarkCtx.bookmarks.filter((b) => b.collectionId === createdCol!.id).length).toBe(0);
    });
  });

  // =========================================================================
  // Section 3: Error Handling and Recovery
  // =========================================================================
  describe('3. Error Handling and Recovery', () => {
    it('gracefully handles collection creation failure without mutating state', async () => {
      await mountHarness();

      vi.spyOn(collectionRepository, 'createCollection').mockRejectedValueOnce(
        new Error('PostgreSQL connection dropped')
      );

      let result: any;
      await act(async () => {
        result = await collectionCtx.createCollection({ name: 'Failing Shelf' });
      });

      expect(result.collection).toBeNull();
      expect(result.error).not.toBeNull();
      expect(collectionCtx.collections.length).toBe(0);
      expect(collectionCtx.loadError).toBeNull();
    });

    it('gracefully handles bookmark creation failure and prevents duplicate URL collisions', async () => {
      await mountHarness();

      // Add initial bookmark
      await act(async () => {
        await bookmarkCtx.addBookmark({
          url: 'https://shelf.app',
          title: 'Shelf App',
        });
      });
      expect(bookmarkCtx.bookmarks.length).toBe(1);

      // Try adding exact duplicate URL
      let duplicateResult: any;
      await act(async () => {
        duplicateResult = await bookmarkCtx.addBookmark({
          url: 'https://shelf.app',
          title: 'Duplicate Shelf',
        });
      });

      expect(duplicateResult.bookmark).toBeNull();
      expect(duplicateResult.error.message).toContain('already saved');
      expect(bookmarkCtx.bookmarks.length).toBe(1);

      // Try network failure on bookmark addition
      vi.spyOn(bookmarkRepository, 'addBookmark').mockRejectedValueOnce(
        new Error('Supabase Gateway Timeout')
      );

      let networkResult: any;
      await act(async () => {
        networkResult = await bookmarkCtx.addBookmark({
          url: 'https://news.ycombinator.com',
          title: 'Hacker News',
        });
      });

      expect(networkResult.bookmark).toBeNull();
      expect(networkResult.error).not.toBeNull();
      expect(bookmarkCtx.bookmarks.length).toBe(1);
    });

    it('supports retryLoad recovery after initial load failure without leaving stale state', async () => {
      // Mock initial load failure for bookmarks
      vi.spyOn(bookmarkRepository, 'getBookmarks').mockRejectedValueOnce(
        new Error('Temporary 503 Service Unavailable')
      );

      await mountHarness();

      // Initial load failed
      expect(bookmarkCtx.isLoading).toBe(false);
      expect(bookmarkCtx.loadError).not.toBeNull();
      expect(bookmarkCtx.bookmarks.length).toBe(0);

      // Restore repository and call retryLoad
      storedBookmarks = [
        {
          id: 'bm_recovered_1',
          url: 'https://recovered.org',
          title: 'Recovered Link',
          domain: 'recovered.org',
          isFavourite: false,
          createdAt: new Date().toISOString(),
        },
      ];
      vi.spyOn(bookmarkRepository, 'getBookmarks').mockResolvedValueOnce([...storedBookmarks]);

      let retryResult: any;
      await act(async () => {
        retryResult = await bookmarkCtx.retryLoad();
      });

      expect(retryResult.success).toBe(true);
      expect(retryResult.error).toBeNull();
      expect(bookmarkCtx.loadError).toBeNull();
      expect(bookmarkCtx.bookmarks.length).toBe(1);
      expect(bookmarkCtx.bookmarks[0].title).toBe('Recovered Link');
    });
  });

  // =========================================================================
  // Section 4: Input Boundaries and Edge Cases
  // =========================================================================
  describe('4. Input Boundaries and Edge Cases', () => {
    it('supports Unicode titles in Japanese, Arabic, and Cyrillic without corruption', async () => {
      await mountHarness();

      const unicodeItems = [
        { url: 'https://ja.wikipedia.org/wiki/Shelf', title: '本棚 — Everything worth keeping 日本語' },
        { url: 'https://ar.wikipedia.org/wiki/Shelf', title: 'المكتبة الرقمية للروابط الشخصية' },
        { url: 'https://ru.wikipedia.org/wiki/Shelf', title: 'Личная библиотека ссылок и статей' },
      ];

      for (const item of unicodeItems) {
        await act(async () => {
          const res = await bookmarkCtx.addBookmark(item);
          expect(res.error).toBeNull();
        });
      }

      expect(bookmarkCtx.bookmarks.length).toBe(3);
      expect(bookmarkCtx.bookmarks.some((b) => b.title === '本棚 — Everything worth keeping 日本語')).toBe(true);
      expect(bookmarkCtx.bookmarks.some((b) => b.title === 'المكتبة الرقمية للروابط الشخصية')).toBe(true);
      expect(bookmarkCtx.bookmarks.some((b) => b.title === 'Личная библиотека ссылок и статей')).toBe(true);
    });

    it('supports emojis in collection names and tag names', async () => {
      await mountHarness();

      let col: Collection | null = null;
      let tag: Tag | null = null;

      await act(async () => {
        const cRes = await collectionCtx.createCollection({ name: '📚 Reading Queue 2026 🚀' });
        col = cRes.collection;
        const tRes = await tagCtx.createTag({ name: '🏷️-design-tokens-🎨' });
        tag = tRes.tag;
      });

      expect((col as Collection | null)?.name).toBe('📚 Reading Queue 2026 🚀');
      expect((tag as Tag | null)?.name).toBe('🏷️-design-tokens-🎨');

      await act(async () => {
        const bRes = await bookmarkCtx.addBookmark({
          url: 'https://designsystems.io',
          title: 'Design Systems',
          collectionId: (col as Collection | null)!.id,
          tags: [(tag as Tag | null)!.id],
        });
        expect(bRes.error).toBeNull();
      });

      const matched = bookmarkCtx.bookmarks.filter((b) => b.tags?.includes((tag as Tag | null)!.id));
      expect(matched.length).toBe(1);
    });

    it('rejects whitespace-only names and handles empty boundary inputs cleanly', async () => {
      await mountHarness();

      // Whitespace-only collection
      await act(async () => {
        const colRes = await collectionCtx.createCollection({ name: '     ' });
        expect(colRes.collection).toBeNull();
        expect(colRes.error?.message).toContain('cannot be empty');
      });

      // Whitespace-only tag
      await act(async () => {
        const tagRes = await tagCtx.createTag({ name: '   #  ' });
        expect(tagRes.tag).toBeNull();
        expect(tagRes.error?.message).toContain('cannot be empty');
      });

      // Empty boundary inputs for bookmark (only URL provided)
      let minimalBm: Bookmark | null = null;
      await act(async () => {
        const bRes = await bookmarkCtx.addBookmark({
          url: 'https://minimal.org',
        });
        minimalBm = bRes.bookmark;
      });

      expect(minimalBm).not.toBeNull();
      expect(minimalBm!.title).toBe('Fallback Title');
      expect(minimalBm!.description).toBeUndefined();
      expect(minimalBm!.collectionId).toBeUndefined();
      expect(minimalBm!.tags).toBeUndefined();
    });

    it('deduplicates duplicate tag assignments during bookmark creation and update', async () => {
      await mountHarness();

      let tagAlpha: Tag | null = null;
      let tagBeta: Tag | null = null;

      await act(async () => {
        const t1 = await tagCtx.createTag({ name: 'alpha' });
        tagAlpha = t1.tag;
        const t2 = await tagCtx.createTag({ name: 'beta' });
        tagBeta = t2.tag;
      });

      let bm: Bookmark | null = null;
      await act(async () => {
        const res = await bookmarkCtx.addBookmark({
          url: 'https://dedup-test.com',
          title: 'Deduplication Test',
          tags: [tagAlpha!.id, tagBeta!.id, tagAlpha!.id, tagBeta!.id, tagAlpha!.id],
        });
        bm = res.bookmark;
      });

      expect(bm!.tags).toEqual([tagAlpha!.id, tagBeta!.id]);

      // Update with duplicates
      await act(async () => {
        const updateRes = await bookmarkCtx.updateBookmark(bm!.id, {
          tags: [tagBeta!.id, tagBeta!.id, tagBeta!.id],
        });
        expect(updateRes.bookmark?.tags).toEqual([tagBeta!.id]);
      });
    });

    it('handles very long URLs exceeding 2,048 characters without throwing', async () => {
      await mountHarness();

      const queryPadding = 'x'.repeat(2200);
      const longUrl = `https://example.com/search?q=${queryPadding}`;
      expect(longUrl.length).toBeGreaterThan(2048);

      let savedBm: Bookmark | null = null;
      await act(async () => {
        const res = await bookmarkCtx.addBookmark({
          url: longUrl,
          title: 'Very Long Query URL',
        });
        savedBm = res.bookmark;
      });

      expect(savedBm).not.toBeNull();
      expect(savedBm!.url).toBe(longUrl);
      expect(bookmarkCtx.bookmarks[0].url.length).toBeGreaterThan(2048);
    });
  });

  // =========================================================================
  // Section 5: Component Workflow (BookmarkModal / Quick Add)
  // =========================================================================
  describe('5. Component Workflow: QuickAdd / BookmarkModal Integration', () => {
    it('creates a bookmark and updates cross-context state when submitted via the modal', async () => {
      let isModalOpen = true;
      const handleClose = vi.fn(() => {
        isModalOpen = false;
      });

      await mountHarness(
        <BookmarkModal
          isOpen={isModalOpen}
          onClose={handleClose}
          initialUrl="https://vitest.dev"
        />
      );

      // BookmarkModal renders into document.body via Modal's createPortal
      const urlInput = document.getElementById('full-bookmark-url-input') as HTMLInputElement;
      expect(urlInput).not.toBeNull();
      expect(urlInput.value).toBe('https://vitest.dev');

      // Submit the form using standard React submit trigger
      const form = document.querySelector('form') as HTMLFormElement;
      expect(form).not.toBeNull();

      await act(async () => {
        const propsKey = Object.keys(form).find((k) => k.startsWith('__reactProps'));
        if (propsKey && (form as any)[propsKey]?.onSubmit) {
          await (form as any)[propsKey].onSubmit({
            preventDefault: () => {},
            stopPropagation: () => {},
          });
        } else {
          form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        }
      });

      // Verify bookmark was added to BookmarkContext
      expect(bookmarkCtx.bookmarks.length).toBe(1);
      expect(bookmarkCtx.bookmarks[0].url).toBe('https://vitest.dev');
    });
  });
});

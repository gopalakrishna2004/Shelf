import { describe, it, expect, beforeEach } from 'vitest';
import { LocalBookmarkRepository } from '../bookmarkService';

describe('Bookmark Tag Association & Integrity', () => {
  let bookmarkRepo: LocalBookmarkRepository;
  const userA = 'user_author_1';
  const userB = 'user_author_2';

  beforeEach(() => {
    localStorage.clear();
    bookmarkRepo = new LocalBookmarkRepository();
  });

  it('saves bookmarks with tags and deduplicates duplicate tag IDs', async () => {
    const bookmark = await bookmarkRepo.addBookmark(userA, {
      url: 'https://example.com/essay-1',
      title: 'First Essay',
      tags: ['tag_1', 'tag_2', 'tag_1', 'tag_3', 'tag_2'],
    });

    expect(bookmark.tags).toEqual(['tag_1', 'tag_2', 'tag_3']);

    const stored = await bookmarkRepo.getBookmarks(userA);
    expect(stored[0].tags).toEqual(['tag_1', 'tag_2', 'tag_3']);
  });

  it('updates bookmark tags and clears tags when empty array is passed', async () => {
    const initial = await bookmarkRepo.addBookmark(userA, {
      url: 'https://example.com/tool-1',
      title: 'Great Tool',
      tags: ['tag_1'],
    });

    // Update with new tags
    const updated = await bookmarkRepo.updateBookmark(userA, initial.id, {
      tags: ['tag_2', 'tag_3'],
    });
    expect(updated.tags).toEqual(['tag_2', 'tag_3']);

    // Clear tags
    const cleared = await bookmarkRepo.updateBookmark(userA, initial.id, {
      tags: [],
    });
    expect(cleared.tags).toBeUndefined();
  });

  it('removeTagFromBookmarks cleanly removes tag from bookmarks without deleting bookmarks', async () => {
    // Bookmark 1: has tag_1 and tag_2
    const b1 = await bookmarkRepo.addBookmark(userA, {
      url: 'https://example.com/item-1',
      title: 'Item 1',
      tags: ['tag_1', 'tag_2'],
    });

    // Bookmark 2: has only tag_1
    const b2 = await bookmarkRepo.addBookmark(userA, {
      url: 'https://example.com/item-2',
      title: 'Item 2',
      tags: ['tag_1'],
    });

    // Bookmark 3: has only tag_3 (unaffected)
    const b3 = await bookmarkRepo.addBookmark(userA, {
      url: 'https://example.com/item-3',
      title: 'Item 3',
      tags: ['tag_3'],
    });

    // Other user bookmark: has tag_1
    const bOther = await bookmarkRepo.addBookmark(userB, {
      url: 'https://example.com/other-item',
      title: 'Other User Item',
      tags: ['tag_1'],
    });

    // Remove tag_1 for userA
    await bookmarkRepo.removeTagFromBookmarks(userA, 'tag_1');

    const bookmarksA = await bookmarkRepo.getBookmarks(userA);

    // Verify all 3 bookmarks still exist (NO bookmarks deleted)
    expect(bookmarksA.length).toBe(3);

    const updatedB1 = bookmarksA.find((b) => b.id === b1.id);
    const updatedB2 = bookmarksA.find((b) => b.id === b2.id);
    const updatedB3 = bookmarksA.find((b) => b.id === b3.id);

    // B1: tag_1 removed, tag_2 retained
    expect(updatedB1?.tags).toEqual(['tag_2']);

    // B2: had only tag_1, now tags is undefined
    expect(updatedB2?.tags).toBeUndefined();

    // B3: untouched
    expect(updatedB3?.tags).toEqual(['tag_3']);

    // Other user: untouched (tenant isolation)
    const bookmarksB = await bookmarkRepo.getBookmarks(userB);
    const updatedBOther = bookmarksB.find((b) => b.id === bOther.id);
    expect(updatedBOther?.tags).toEqual(['tag_1']);
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { LocalBookmarkRepository } from '../bookmarkService';
import { LocalCollectionRepository } from '../collectionService';

describe('Collection and Bookmark Rename/Delete Data Integrity', () => {
  let bookmarkRepo: LocalBookmarkRepository;
  let collectionRepo: LocalCollectionRepository;
  const userId = 'user_curator_888';

  beforeEach(() => {
    localStorage.clear();
    bookmarkRepo = new LocalBookmarkRepository();
    collectionRepo = new LocalCollectionRepository();
  });

  it('cascades collection rename to all assigned bookmarks without changing other bookmark properties', async () => {
    // 1. Create a collection
    const col = await collectionRepo.createCollection(userId, { name: 'Design' });

    // 2. Add bookmarks: two in "Design", one in "Other", one unassigned
    const bm1 = await bookmarkRepo.addBookmark(userId, {
      url: 'https://designsystems.com',
      title: 'Design Systems Guide',
      description: 'Comprehensive tokens reference',
      collectionId: col.id,
      collectionName: col.name,
      isFavourite: true,
    });

    const bm2 = await bookmarkRepo.addBookmark(userId, {
      url: 'https://smashingmagazine.com',
      title: 'Smashing Mag',
      collectionId: col.id,
      collectionName: col.name,
      isFavourite: false,
    });

    const bm3 = await bookmarkRepo.addBookmark(userId, {
      url: 'https://news.ycombinator.com',
      title: 'Hacker News',
      collectionId: 'other_col_999',
      collectionName: 'News',
    });

    const bm4 = await bookmarkRepo.addBookmark(userId, {
      url: 'https://wikipedia.org',
      title: 'Wikipedia',
    });

    // 3. Rename collection
    const renamedCol = await collectionRepo.updateCollection(userId, col.id, {
      name: 'Design Systems',
    });
    expect(renamedCol.name).toBe('Design Systems');

    // 4. Propagate rename to bookmark repository
    await bookmarkRepo.updateBookmarksCollectionName(userId, col.id, 'Design Systems');

    // 5. Verify bookmarks
    const updated1 = await bookmarkRepo.getBookmarkById(userId, bm1.id);
    expect(updated1?.collectionId).toBe(col.id);
    expect(updated1?.collectionName).toBe('Design Systems');
    expect(updated1?.title).toBe('Design Systems Guide');
    expect(updated1?.description).toBe('Comprehensive tokens reference');
    expect(updated1?.isFavourite).toBe(true);
    expect(updated1?.createdAt).toBe(bm1.createdAt);

    const updated2 = await bookmarkRepo.getBookmarkById(userId, bm2.id);
    expect(updated2?.collectionId).toBe(col.id);
    expect(updated2?.collectionName).toBe('Design Systems');

    // Verify unrelated bookmarks were not affected
    const updated3 = await bookmarkRepo.getBookmarkById(userId, bm3.id);
    expect(updated3?.collectionId).toBe('other_col_999');
    expect(updated3?.collectionName).toBe('News');

    const updated4 = await bookmarkRepo.getBookmarkById(userId, bm4.id);
    expect(updated4?.collectionId).toBeUndefined();
    expect(updated4?.collectionName).toBeUndefined();
  });

  it('safely disassociates bookmarks when collection is deleted without deleting the bookmarks', async () => {
    // 1. Create collection
    const col = await collectionRepo.createCollection(userId, { name: 'Reading Queue' });

    // 2. Add bookmarks to this collection
    const bm1 = await bookmarkRepo.addBookmark(userId, {
      url: 'https://longform.org/article-1',
      title: 'Essay on Typography',
      description: 'Historical review of serif typefaces',
      collectionId: col.id,
      collectionName: col.name,
      isFavourite: true,
    });

    const bm2 = await bookmarkRepo.addBookmark(userId, {
      url: 'https://longform.org/article-2',
      title: 'The Modern Monolith',
      collectionId: col.id,
      collectionName: col.name,
      isFavourite: false,
    });

    // 3. Delete collection and disassociate bookmarks
    await collectionRepo.deleteCollection(userId, col.id);
    await bookmarkRepo.removeBookmarksFromCollection(userId, col.id);

    // 4. Verify collection is gone
    const collections = await collectionRepo.getCollections(userId);
    expect(collections.length).toBe(0);

    // 5. Verify bookmarks are still present and have become unassigned
    const allBookmarks = await bookmarkRepo.getBookmarks(userId);
    expect(allBookmarks.length).toBe(2);

    const book1 = await bookmarkRepo.getBookmarkById(userId, bm1.id);
    expect(book1).not.toBeNull();
    expect(book1?.id).toBe(bm1.id);
    expect(book1?.title).toBe('Essay on Typography');
    expect(book1?.url).toBe('https://longform.org/article-1');
    expect(book1?.description).toBe('Historical review of serif typefaces');
    expect(book1?.isFavourite).toBe(true);
    expect(book1?.createdAt).toBe(bm1.createdAt);
    expect(book1?.collectionId).toBeUndefined();
    expect(book1?.collectionName).toBeUndefined();

    const book2 = await bookmarkRepo.getBookmarkById(userId, bm2.id);
    expect(book2).not.toBeNull();
    expect(book2?.collectionId).toBeUndefined();
    expect(book2?.collectionName).toBeUndefined();
  });
});

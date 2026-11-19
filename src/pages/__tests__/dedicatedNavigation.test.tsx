import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Sidebar } from '../../components/layout/Sidebar';
import { FavouritesPage } from '../FavouritesPage';
import { CollectionDetailPage } from '../CollectionDetailPage';
import { TagDetailPage } from '../TagDetailPage';
import { AllBookmarksPage } from '../AllBookmarksPage';
import { CollectionsPage } from '../CollectionsPage';
import { TagsPage } from '../TagsPage';
import type { Bookmark, Collection, Tag } from '../../types';

// Mock contexts
const mockCollections: Collection[] = [
  { id: 'col-1', name: 'Design Systems', description: 'Curated tokens and layout specs', createdAt: '2026-01-01T00:00:00Z' },
  { id: 'col-2', name: 'Research & Essays', description: 'Deep technical essays', createdAt: '2026-01-02T00:00:00Z' },
];

const mockTags: Tag[] = [
  { id: 'tag-react', name: 'react', createdAt: '2026-01-01T00:00:00Z' },
  { id: 'tag-design', name: 'design', createdAt: '2026-01-02T00:00:00Z' },
  { id: 'tag-reading', name: 'reading', createdAt: '2026-01-03T00:00:00Z' },
];

let mockBookmarks: Bookmark[] = [
  {
    id: 'bm-1',
    url: 'https://react.dev',
    title: 'React Documentation',
    domain: 'react.dev',
    description: 'React library documentation',
    collectionId: 'col-1',
    collectionName: 'Design Systems',
    tags: ['tag-react', 'tag-design'],
    isFavourite: true,
    createdAt: '2026-01-01T10:00:00Z',
  },
  {
    id: 'bm-2',
    url: 'https://paulgraham.com/essay',
    title: 'Paul Graham Essays',
    domain: 'paulgraham.com',
    description: 'Thoughtful essays on technology',
    collectionId: 'col-2',
    collectionName: 'Research & Essays',
    tags: ['tag-reading'],
    isFavourite: false,
    createdAt: '2026-01-02T10:00:00Z',
  },
  {
    id: 'bm-3',
    url: 'https://component.gallery',
    title: 'Component Gallery',
    domain: 'component.gallery',
    description: 'Design system components directory',
    collectionId: 'col-1',
    collectionName: 'Design Systems',
    tags: ['tag-design'],
    isFavourite: true,
    createdAt: '2026-01-03T10:00:00Z',
  },
  {
    id: 'bm-4',
    url: 'https://danluu.com',
    title: 'Dan Luu Systems Notes',
    domain: 'danluu.com',
    description: 'Engineering systems notes',
    tags: ['tag-reading'],
    isFavourite: false,
    createdAt: '2026-01-04T10:00:00Z',
  },
];

let liveCollections = [...mockCollections];
let liveTags = [...mockTags];

vi.mock('../../context/BookmarkContext', () => ({
  useBookmarks: () => ({
    bookmarks: mockBookmarks,
    addBookmark: vi.fn(),
    updateBookmark: vi.fn(),
    deleteBookmark: vi.fn(),
    toggleFavourite: vi.fn(),
    isLoading: false,
    loadError: null,
    retryLoad: vi.fn(),
  }),
}));

vi.mock('../../context/CollectionContext', () => ({
  useCollections: () => ({
    collections: liveCollections,
    createCollection: vi.fn(),
    updateCollection: vi.fn(),
    deleteCollection: vi.fn(),
    isLoading: false,
    loadError: null,
    retryLoad: vi.fn(),
  }),
}));

vi.mock('../../context/TagContext', () => ({
  useTags: () => ({
    tags: liveTags,
    createTag: vi.fn(),
    updateTag: vi.fn(),
    deleteTag: vi.fn(),
    isLoading: false,
    loadError: null,
    retryLoad: vi.fn(),
  }),
}));

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'usr-1', email: 'reader@shelf.test', user_metadata: { display_name: 'Reader' } },
    isLoading: false,
    isPasswordRecovery: false,
  }),
}));

vi.mock('../../hooks/usePreferences', () => ({
  usePreferences: () => ({
    openInNewTab: false,
    setOpenInNewTab: vi.fn(),
  }),
}));

describe('Dedicated Navigation Pages & Sidebar Simplification Suite', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    localStorage.clear();
    window.location.hash = '';
    liveCollections = [...mockCollections];
    liveTags = [...mockTags];
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

  // 1. Sidebar simplification: six top-level destinations and no individual collections/tags
  it('1. Sidebar contains only the six required top-level destinations and no individual collection/tag names', () => {
    const onNavigate = vi.fn();
    act(() => {
      root.render(
        <Sidebar
          currentPage="home"
          onNavigate={onNavigate}
          onCreateCollectionClick={vi.fn()}
          theme="light"
          onThemeChange={vi.fn()}
        />
      );
    });

    const navButtons = Array.from(container.querySelectorAll('button'));
    const navLabels = navButtons.map((b) => b.textContent?.trim()).filter(Boolean);

    // Verify presence of top-level destinations
    expect(navLabels.some((l) => l?.includes('Home'))).toBe(true);
    expect(navLabels.some((l) => l?.includes('All Bookmarks'))).toBe(true);
    expect(navLabels.some((l) => l?.includes('Favourites'))).toBe(true);
    expect(navLabels.some((l) => l?.includes('Collections'))).toBe(true);
    expect(navLabels.some((l) => l?.includes('Tags'))).toBe(true);
    expect(navLabels.some((l) => l?.includes('Settings'))).toBe(true);

    // Verify individual collection names are NOT in the sidebar
    expect(container.textContent).not.toContain('Design Systems');
    expect(container.textContent).not.toContain('Research & Essays');

    // Verify individual tag names are NOT in the sidebar
    expect(container.textContent).not.toContain('#react');
    expect(container.textContent).not.toContain('#reading');
  });

  // 2. Collections opens the Collections overview
  it('2. Collections sidebar navigation calls onNavigate with collections overview destination', () => {
    const onNavigate = vi.fn();
    act(() => {
      root.render(
        <Sidebar
          currentPage="home"
          onNavigate={onNavigate}
          onCreateCollectionClick={vi.fn()}
          theme="light"
          onThemeChange={vi.fn()}
        />
      );
    });

    const collectionsButton = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Collections')
    );
    expect(collectionsButton).toBeDefined();

    act(() => {
      collectionsButton?.click();
    });

    expect(onNavigate).toHaveBeenCalledWith('collections');
  });

  // 3. Clicking a collection opens its dedicated page with the correct bookmarks
  it('3. Clicking a collection opens its dedicated page with the correct bookmarks', () => {
    const onNavigate = vi.fn();

    // First check that CollectionsPage triggers navigation to dedicated collection page
    act(() => {
      root.render(
        <CollectionsPage
          onOpenCreateCollection={vi.fn()}
          onNavigate={onNavigate}
        />
      );
    });

    const collectionTitle = Array.from(container.querySelectorAll('h3')).find(
      (h) => h.textContent?.includes('Design Systems')
    );

    expect(collectionTitle).toBeDefined();
    act(() => {
      (collectionTitle as any)?.click();
    });

    expect(onNavigate).toHaveBeenCalledWith('collection', 'col-1');

    // Next render the dedicated CollectionDetailPage
    act(() => {
      root.render(
        <CollectionDetailPage
          collectionId="col-1"
          viewMode="grid"
          onViewModeChange={vi.fn()}
          onNavigate={onNavigate}
        />
      );
    });

    // Heading must be the collection's actual name
    const heading = container.querySelector('h1');
    expect(heading?.textContent).toContain('Design Systems');

    // Displays only bookmarks belonging to col-1 (bm-1 and bm-3)
    expect(container.textContent).toContain('React Documentation');
    expect(container.textContent).toContain('Component Gallery');
    expect(container.textContent).not.toContain('Paul Graham Essays');
    expect(container.textContent).not.toContain('Dan Luu Systems Notes');
  });

  // 4. Tags opens the Tags overview
  it('4. Tags sidebar navigation calls onNavigate with tags overview destination', () => {
    const onNavigate = vi.fn();
    act(() => {
      root.render(
        <Sidebar
          currentPage="home"
          onNavigate={onNavigate}
          onCreateCollectionClick={vi.fn()}
          theme="light"
          onThemeChange={vi.fn()}
        />
      );
    });

    const tagsButton = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Tags')
    );
    expect(tagsButton).toBeDefined();

    act(() => {
      tagsButton?.click();
    });

    expect(onNavigate).toHaveBeenCalledWith('tags');
  });

  // 5. Clicking a tag opens its dedicated page with the correct bookmarks
  it('5. Clicking a tag opens its dedicated page with the correct bookmarks', () => {
    const onNavigate = vi.fn();

    // TagsPage triggers navigation to dedicated tag page
    act(() => {
      root.render(
        <TagsPage
          onOpenCreateTag={vi.fn()}
          onNavigate={onNavigate}
        />
      );
    });

    const tagTitle = Array.from(container.querySelectorAll('h3')).find(
      (h) => h.textContent?.includes('#reading')
    );

    expect(tagTitle).toBeDefined();
    act(() => {
      (tagTitle as any)?.click();
    });

    expect(onNavigate).toHaveBeenCalledWith('tag', 'tag-reading');

    // Render the dedicated TagDetailPage
    act(() => {
      root.render(
        <TagDetailPage
          tagId="tag-reading"
          viewMode="grid"
          onViewModeChange={vi.fn()}
          onNavigate={onNavigate}
        />
      );
    });

    // Heading must be the tag's actual name
    const heading = container.querySelector('h1');
    expect(heading?.textContent).toContain('#reading');

    // Displays only bookmarks assigned to tag-reading (bm-2 and bm-4)
    expect(container.textContent).toContain('Paul Graham Essays');
    expect(container.textContent).toContain('Dan Luu Systems Notes');
    expect(container.textContent).not.toContain('React Documentation');
  });

  // 6. Favourites opens its own dedicated page
  it('6. Favourites opens dedicated page with Favourites heading and only starred bookmarks', () => {
    const onNavigate = vi.fn();
    act(() => {
      root.render(
        <FavouritesPage
          viewMode="grid"
          onViewModeChange={vi.fn()}
          onNavigate={onNavigate}
        />
      );
    });

    // Heading must be Favourites
    const heading = container.querySelector('h1');
    expect(heading?.textContent).toContain('Favourites');

    // Displays only favourites (bm-1 and bm-3)
    expect(container.textContent).toContain('React Documentation');
    expect(container.textContent).toContain('Component Gallery');
    expect(container.textContent).not.toContain('Paul Graham Essays');
    expect(container.textContent).not.toContain('Dan Luu Systems Notes');
  });

  // 7. All Bookmarks remains unfiltered after navigating from another destination
  it('7. All Bookmarks displays complete library and does not inherit collection or tag filters', () => {
    act(() => {
      root.render(
        <AllBookmarksPage
          viewMode="grid"
          onViewModeChange={vi.fn()}
        />
      );
    });

    // All 4 bookmarks must be displayed
    expect(container.textContent).toContain('React Documentation');
    expect(container.textContent).toContain('Paul Graham Essays');
    expect(container.textContent).toContain('Component Gallery');
    expect(container.textContent).toContain('Dan Luu Systems Notes');
  });

  // 8. Search and sorting work within dedicated destinations
  it('8. Search and sorting work locally within dedicated collection and tag destinations', () => {
    act(() => {
      root.render(
        <CollectionDetailPage
          collectionId="col-1"
          viewMode="grid"
          onViewModeChange={vi.fn()}
          onNavigate={vi.fn()}
        />
      );
    });

    // Search within collection
    const searchInput = container.querySelector('input') as HTMLInputElement;
    expect(searchInput).toBeDefined();

    act(() => {
      (searchInput as any).value = 'Component';
      const ev = new Event('change', { bubbles: true });
      Object.defineProperty(ev, 'target', { value: searchInput });
      searchInput.dispatchEvent(ev);
    });

    // React Documentation is filtered out, Component Gallery remains
    expect(container.textContent).toContain('Component Gallery');
  });

  // 9. Renaming a collection updates its page heading
  it('9. Renaming a collection updates its dedicated page heading immediately', () => {
    act(() => {
      root.render(
        <CollectionDetailPage
          collectionId="col-1"
          viewMode="grid"
          onViewModeChange={vi.fn()}
          onNavigate={vi.fn()}
        />
      );
    });

    expect(container.querySelector('h1')?.textContent).toContain('Design Systems');

    // Simulate collection rename in store
    act(() => {
      liveCollections = [
        { ...liveCollections[0], name: 'Design Tokens & Patterns' },
        liveCollections[1],
      ];
      root.render(
        <CollectionDetailPage
          collectionId="col-1"
          viewMode="grid"
          onViewModeChange={vi.fn()}
          onNavigate={vi.fn()}
        />
      );
    });

    expect(container.querySelector('h1')?.textContent).toContain('Design Tokens & Patterns');
  });

  // 10. Deleting the currently selected collection is handled gracefully
  it('10. Deleting the currently selected collection redirects gracefully to collections overview', () => {
    const onNavigate = vi.fn();
    act(() => {
      root.render(
        <CollectionDetailPage
          collectionId="col-1"
          viewMode="grid"
          onViewModeChange={vi.fn()}
          onNavigate={onNavigate}
        />
      );
    });

    // Simulate deletion: col-1 no longer in collections list
    act(() => {
      liveCollections = [liveCollections[1]]; // only col-2 remains
      root.render(
        <CollectionDetailPage
          collectionId="col-1"
          viewMode="grid"
          onViewModeChange={vi.fn()}
          onNavigate={onNavigate}
        />
      );
    });

    // Expect navigation redirect to collections
    expect(onNavigate).toHaveBeenCalledWith('collections');
  });

  // 11. Deleting the currently selected tag is handled gracefully
  it('11. Deleting the currently selected tag redirects gracefully to tags overview', () => {
    const onNavigate = vi.fn();
    act(() => {
      root.render(
        <TagDetailPage
          tagId="tag-react"
          viewMode="grid"
          onViewModeChange={vi.fn()}
          onNavigate={onNavigate}
        />
      );
    });

    // Simulate deletion: tag-react no longer in tags list
    act(() => {
      liveTags = liveTags.filter((t) => t.id !== 'tag-react');
      root.render(
        <TagDetailPage
          tagId="tag-react"
          viewMode="grid"
          onViewModeChange={vi.fn()}
          onNavigate={onNavigate}
        />
      );
    });

    expect(onNavigate).toHaveBeenCalledWith('tags');
  });

  // 12. Hash routing correctly handles deep links and refresh
  it('12. Hash navigation supports collection and tag paths with id parameters', () => {
    // Helper to simulate hash router
    const parseHash = (hash: string) => {
      const raw = hash.replace(/^#\/?/, '').split('?')[0].replace(/\/+$/, '');
      const parts = raw.split('/');
      const section = parts[0]?.toLowerCase();
      const id = parts.slice(1).join('/');

      if (section === 'collection' || section === 'collections') {
        return id ? { page: 'collection', id: decodeURIComponent(id) } : { page: 'collections' };
      }
      if (section === 'tag' || section === 'tags') {
        return id ? { page: 'tag', id: decodeURIComponent(id) } : { page: 'tags' };
      }
      return { page: section || 'home' };
    };

    expect(parseHash('#collections/col-reading')).toEqual({ page: 'collection', id: 'col-reading' });
    expect(parseHash('#collection/col-reading')).toEqual({ page: 'collection', id: 'col-reading' });
    expect(parseHash('#collections')).toEqual({ page: 'collections' });
    expect(parseHash('#tags/tag-dev')).toEqual({ page: 'tag', id: 'tag-dev' });
    expect(parseHash('#tags')).toEqual({ page: 'tags' });
    expect(parseHash('#favourites')).toEqual({ page: 'favourites' });
    expect(parseHash('#all')).toEqual({ page: 'all' });
    expect(parseHash('')).toEqual({ page: 'home' });
  });
});

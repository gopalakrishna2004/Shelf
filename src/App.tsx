import { useState, useEffect, lazy, Suspense } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { BookmarkProvider } from './context/BookmarkContext';
import { CollectionProvider } from './context/CollectionContext';
import { TagProvider } from './context/TagContext';
import { MigrationGate } from './components/auth/MigrationGate';
import { RootLayout } from './layouts/RootLayout';
import { useTheme } from './hooks/useTheme';
import { useBookmarksView } from './hooks/useBookmarksView';
import { usePreferences } from './hooks/usePreferences';
import { getActiveSearchQuery, setActiveSearchQuery, consumePendingSearchQuery } from './lib/searchNavigation';
import type { PageId } from './types';

// Route-level lazy loading for performance and code splitting
const AuthPage = lazy(() => import('./pages/AuthPage').then((m) => ({ default: m.AuthPage })));
const HomePage = lazy(() => import('./pages/HomePage').then((m) => ({ default: m.HomePage })));
const AllBookmarksPage = lazy(() => import('./pages/AllBookmarksPage').then((m) => ({ default: m.AllBookmarksPage })));
const FavouritesPage = lazy(() => import('./pages/FavouritesPage').then((m) => ({ default: m.FavouritesPage })));
const CollectionsPage = lazy(() => import('./pages/CollectionsPage').then((m) => ({ default: m.CollectionsPage })));
const CollectionDetailPage = lazy(() => import('./pages/CollectionDetailPage').then((m) => ({ default: m.CollectionDetailPage })));
const TagsPage = lazy(() => import('./pages/TagsPage').then((m) => ({ default: m.TagsPage })));
const TagDetailPage = lazy(() => import('./pages/TagDetailPage').then((m) => ({ default: m.TagDetailPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })));

interface RouteState {
  page: PageId;
  id?: string;
}

function AppContent() {
  const { user, isLoading, isPasswordRecovery } = useAuth();
  const { theme, setTheme } = useTheme();
  const { viewMode, setViewMode } = useBookmarksView();
  const { openInNewTab, setOpenInNewTab } = usePreferences();

  // Hash-based routing supporting dedicated destinations, refresh persistence & back/forward
  const getRouteFromHash = (): RouteState => {
    const raw = window.location.hash
      .replace(/^#\/?/, '')
      .split('?')[0]
      .replace(/\/+$/, '');
    if (!raw) return { page: 'home' };

    const parts = raw.split('/');
    const section = parts[0]?.toLowerCase();
    const id = parts.slice(1).join('/');

    if (section === 'collection' || section === 'collections') {
      if (id) {
        return { page: 'collection', id: decodeURIComponent(id) };
      }
      return { page: 'collections' };
    }

    if (section === 'tag' || section === 'tags') {
      if (id) {
        return { page: 'tag', id: decodeURIComponent(id) };
      }
      return { page: 'tags' };
    }

    if (section === 'all' || section === 'favourites' || section === 'settings') {
      return { page: section as PageId };
    }

    return { page: 'home' };
  };

  const [currentRoute, setCurrentRoute] = useState<RouteState>(getRouteFromHash);
  const currentPage = currentRoute.page;

  const [searchQuery, setSearchQuery] = useState<string>(() => {
    return consumePendingSearchQuery() || getActiveSearchQuery();
  });

  const handleSearchQueryChange = (query: string) => {
    setSearchQuery(query);
    setActiveSearchQuery(query);
  };

  const handleHomeSearch = (query: string) => {
    setActiveSearchQuery(query);
    setSearchQuery(query);
    navigateTo('all');
  };

  useEffect(() => {
    const onHashChange = () => {
      setCurrentRoute(getRouteFromHash());
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // Listen to global collection and tag navigation events
  useEffect(() => {
    const handleSelectCollection = (e: Event) => {
      const customEvent = e as CustomEvent<{ collectionId?: string }>;
      if (customEvent.detail?.collectionId) {
        navigateTo('collection', customEvent.detail.collectionId);
      }
    };
    const handleSelectTag = (e: Event) => {
      const customEvent = e as CustomEvent<{ tagId?: string }>;
      if (customEvent.detail?.tagId) {
        navigateTo('tag', customEvent.detail.tagId);
      }
    };
    window.addEventListener('shelf-select-collection', handleSelectCollection);
    window.addEventListener('shelf-select-tag', handleSelectTag);
    return () => {
      window.removeEventListener('shelf-select-collection', handleSelectCollection);
      window.removeEventListener('shelf-select-tag', handleSelectTag);
    };
  }, []);

  // Reset route to home whenever the user signs out
  useEffect(() => {
    if (!user && !isLoading) {
      setCurrentRoute({ page: 'home' });
    }
  }, [user, isLoading]);

  const navigateTo = (page: PageId, id?: string) => {
    setCurrentRoute({ page, id });
    if (page === 'home') {
      window.location.hash = '';
    } else if (page === 'collection' && id) {
      window.location.hash = `collections/${encodeURIComponent(id)}`;
    } else if (page === 'tag' && id) {
      window.location.hash = `tags/${encodeURIComponent(id)}`;
    } else {
      window.location.hash = page;
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // 1. Initial Session Loading Screen
  if (isLoading) {
    return (
      <div className="min-h-screen bg-shelf-ivory dark:bg-shelf-dark flex flex-col items-center justify-center p-6 text-shelf-dark dark:text-shelf-ivory transition-colors">
        <div className="w-12 h-12 rounded-[16px] bg-shelf-dark dark:bg-shelf-ivory flex items-center justify-center p-2.5 mb-4 shadow-[0_6px_20px_rgba(201,75,54,0.18)] animate-pulse">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-full h-full text-shelf-ivory dark:text-shelf-dark"
          >
            <line x1="3" y1="6" x2="21" y2="6" strokeWidth="2.2" />
            <line x1="3" y1="12" x2="21" y2="12" strokeWidth="2.2" />
            <line x1="3" y1="18" x2="21" y2="18" strokeWidth="2.2" />
            <rect x="6.5" y="6" width="3.5" height="6" rx="0.5" fill="#C94B36" stroke="none" />
            <rect x="13.5" y="12" width="3.5" height="6" rx="0.5" fill="#C94B36" stroke="none" fillOpacity="0.8" />
          </svg>
        </div>
        <span className="font-editorial text-xl font-medium tracking-tight">
          Opening Shelf...
        </span>
        <span className="text-xs text-shelf-muted dark:text-shelf-mutedDark font-mono mt-1">
          Verifying security session
        </span>
      </div>
    );
  }

  // 2. Password Recovery Flow
  if (isPasswordRecovery) {
    return (
      <Suspense fallback={null}>
        <AuthPage
          initialMode="reset-password"
          theme={theme}
          onThemeChange={setTheme}
        />
      </Suspense>
    );
  }

  // 3. Unauthenticated View (Login / Register / Forgot Password)
  if (!user) {
    return (
      <Suspense fallback={null}>
        <AuthPage
          initialMode="login"
          theme={theme}
          onThemeChange={setTheme}
        />
      </Suspense>
    );
  }

  // 4. Authenticated Application Shell
  return (
    <MigrationGate>
      <RootLayout
        currentPage={currentPage}
        onNavigate={navigateTo}
        theme={theme}
        onThemeChange={setTheme}
      >
        <Suspense
          fallback={
            <div className="flex-1 flex flex-col items-center justify-center p-12 min-h-[300px]">
              <div className="w-8 h-8 rounded-full border-2 border-shelf-terracotta/20 border-t-shelf-terracotta animate-spin mb-3" />
              <span className="font-editorial text-sm text-shelf-muted dark:text-shelf-mutedDark">
                Opening view...
              </span>
            </div>
          }
        >
          {currentPage === 'home' && (
            <HomePage
              onNavigate={navigateTo}
              onOpenCreateCollection={() => navigateTo('collections')}
              onSearch={handleHomeSearch}
            />
          )}

          {currentPage === 'all' && (
            <AllBookmarksPage
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              searchQuery={searchQuery}
              onSearchQueryChange={handleSearchQueryChange}
            />
          )}

          {currentPage === 'favourites' && (
            <FavouritesPage
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              onNavigate={navigateTo}
              searchQuery={searchQuery}
              onSearchQueryChange={handleSearchQueryChange}
            />
          )}

          {currentPage === 'collections' && (
            <CollectionsPage
              onOpenCreateCollection={() => {
                window.dispatchEvent(new Event('shelf-open-create-collection'));
              }}
              onNavigate={navigateTo}
            />
          )}

          {currentPage === 'collection' && currentRoute.id && (
            <CollectionDetailPage
              key={`collection-${currentRoute.id}`}
              collectionId={currentRoute.id}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              onNavigate={navigateTo}
            />
          )}

          {currentPage === 'tags' && (
            <TagsPage
              onOpenCreateTag={() => {
                window.dispatchEvent(new Event('shelf-open-create-tag'));
              }}
              onNavigate={navigateTo}
            />
          )}

          {currentPage === 'tag' && currentRoute.id && (
            <TagDetailPage
              key={`tag-${currentRoute.id}`}
              tagId={currentRoute.id}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              onNavigate={navigateTo}
            />
          )}

          {currentPage === 'settings' && (
            <SettingsPage
              theme={theme}
              onThemeChange={setTheme}
              defaultView={viewMode}
              onDefaultViewChange={setViewMode}
              openInNewTab={openInNewTab}
              onOpenInNewTabChange={setOpenInNewTab}
            />
          )}
        </Suspense>
      </RootLayout>
    </MigrationGate>
  );
}

export function App() {
  return (
    <AuthProvider>
      <BookmarkProvider>
        <CollectionProvider>
          <TagProvider>
            <AppContent />
          </TagProvider>
        </CollectionProvider>
      </BookmarkProvider>
    </AuthProvider>
  );
}

export default App;

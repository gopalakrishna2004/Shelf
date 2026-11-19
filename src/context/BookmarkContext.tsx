import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import type { Bookmark } from '../types';
import { useAuth } from '../hooks/useAuth';
import { bookmarkRepository, type CreateBookmarkInput } from '../services/bookmarkService';
import { translateSupabaseError } from '../services/supabaseError';
import { normalizeUrl } from '../lib/metadata';

export interface BookmarkContextType {
  bookmarks: Bookmark[];
  isLoading: boolean;
  loadError: Error | null;
  retryLoad: () => Promise<{ success: boolean; error: Error | null }>;
  addBookmark: (input: CreateBookmarkInput) => Promise<{ bookmark: Bookmark | null; error: Error | null }>;
  updateBookmark: (id: string, updates: Partial<Bookmark>) => Promise<{ bookmark: Bookmark | null; error: Error | null }>;
  deleteBookmark: (id: string) => Promise<{ success: boolean; error: Error | null }>;
  isDuplicateUrl: (url: string, excludeId?: string) => boolean;
  toggleFavourite: (id: string) => Promise<void>;
  updateBookmarksCollectionName: (collectionId: string, newCollectionName: string) => void;
  removeBookmarksFromCollection: (collectionId: string) => void;
  removeTagFromBookmarks: (tagId: string) => void;
  refreshBookmarks: () => Promise<void>;
}

const BookmarkContext = createContext<BookmarkContextType | undefined>(undefined);

export const BookmarkProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<Error | null>(null);

  // Track the active user ID and request counter to prevent asynchronous race conditions and stale response overwrites
  const activeUserIdRef = useRef<string | null>(null);
  const latestRequestIdRef = useRef<number>(0);
  const inFlightPromiseRef = useRef<Promise<{ success: boolean; error: Error | null }> | null>(null);

  const loadUserBookmarks = useCallback(
    async (userId: string | null, force: boolean = false): Promise<{ success: boolean; error: Error | null }> => {
      // If no authenticated user, immediately wipe in-memory bookmarks to prevent data leakage
      if (!userId) {
        activeUserIdRef.current = null;
        latestRequestIdRef.current++;
        inFlightPromiseRef.current = null;
        setBookmarks([]);
        setLoadError(null);
        setIsLoading(false);
        return { success: true, error: null };
      }

      // If switching accounts, immediately clear previous user's data
      if (activeUserIdRef.current !== userId) {
        activeUserIdRef.current = userId;
        latestRequestIdRef.current++;
        inFlightPromiseRef.current = null;
        setBookmarks([]);
        setLoadError(null);
      }

      // Avoid duplicate simultaneous loads for the same user unless forced
      if (!force && inFlightPromiseRef.current) {
        return inFlightPromiseRef.current;
      }

      const requestId = ++latestRequestIdRef.current;
      setIsLoading(true);
      setLoadError(null);

      const fetchPromise = (async () => {
        try {
          const data = await bookmarkRepository.getBookmarks(userId);
          // Guard: Ensure user hasn't switched accounts and this request is still the newest
          if (activeUserIdRef.current === userId && latestRequestIdRef.current === requestId) {
            setBookmarks(data);
            setLoadError(null);
            setIsLoading(false);
            return { success: true, error: null };
          }
          return {
            success: false,
            error: new Error('Request was superseded by a newer operation.'),
          };
        } catch (err: any) {
          const translated = translateSupabaseError(err);
          if (activeUserIdRef.current === userId && latestRequestIdRef.current === requestId) {
            console.error('[Shelf Bookmark Context] Failed to load bookmarks for user:', err);
            setLoadError(translated);
            setIsLoading(false);
            return { success: false, error: translated };
          }
          return { success: false, error: translated };
        } finally {
          if (latestRequestIdRef.current === requestId) {
            inFlightPromiseRef.current = null;
          }
        }
      })();

      inFlightPromiseRef.current = fetchPromise;
      return fetchPromise;
    },
    []
  );

  // Synchronize bookmark state whenever user changes, logs in, or signs out
  useEffect(() => {
    const currentUserId = user?.id || null;
    loadUserBookmarks(currentUserId);
  }, [user?.id, loadUserBookmarks]);

  // Listen for storage / cross-tab updates for the current user
  useEffect(() => {
    const handleStorageUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<{ userId?: string }>;
      if (user?.id && (!customEvent.detail?.userId || customEvent.detail.userId === user.id)) {
        loadUserBookmarks(user.id);
      }
    };

    window.addEventListener('shelf-bookmarks-updated', handleStorageUpdate);
    return () => {
      window.removeEventListener('shelf-bookmarks-updated', handleStorageUpdate);
    };
  }, [user?.id, loadUserBookmarks]);

  const retryLoad = useCallback(async (): Promise<{ success: boolean; error: Error | null }> => {
    if (!user?.id) {
      return {
        success: false,
        error: new Error('You must be signed in to load bookmarks.'),
      };
    }
    return loadUserBookmarks(user.id, true);
  }, [user?.id, loadUserBookmarks]);

  const addBookmark = async (
    input: CreateBookmarkInput
  ): Promise<{ bookmark: Bookmark | null; error: Error | null }> => {
    if (!user?.id) {
      return {
        bookmark: null,
        error: new Error('You must be signed in to add bookmarks to your shelf.'),
      };
    }

    try {
      const created = await bookmarkRepository.addBookmark(user.id, input);
      if (activeUserIdRef.current === user.id) {
        setBookmarks((prev) => [created, ...prev.filter((b) => b.id !== created.id)]);
      }
      return { bookmark: created, error: null };
    } catch (err: any) {
      const translated = translateSupabaseError(err);
      return {
        bookmark: null,
        error: translated,
      };
    }
  };

  const isDuplicateUrl = (url: string, excludeId?: string): boolean => {
    const normalized = normalizeUrl(url).toLowerCase();
    if (!normalized) return false;
    return bookmarks.some(
      (b) => b.id !== excludeId && normalizeUrl(b.url).toLowerCase() === normalized
    );
  };

  const updateBookmark = async (
    id: string,
    updates: Partial<Bookmark>
  ): Promise<{ bookmark: Bookmark | null; error: Error | null }> => {
    if (!user?.id) {
      return {
        bookmark: null,
        error: new Error('You must be signed in to update bookmarks.'),
      };
    }

    try {
      const updated = await bookmarkRepository.updateBookmark(user.id, id, updates);
      if (activeUserIdRef.current === user.id) {
        setBookmarks((prev) => prev.map((b) => (b.id === id ? updated : b)));
      }
      return { bookmark: updated, error: null };
    } catch (err: any) {
      const translated = translateSupabaseError(err);
      return {
        bookmark: null,
        error: translated,
      };
    }
  };

  const deleteBookmark = async (
    id: string
  ): Promise<{ success: boolean; error: Error | null }> => {
    if (!user?.id) {
      return {
        success: false,
        error: new Error('You must be signed in to delete bookmarks.'),
      };
    }

    try {
      await bookmarkRepository.deleteBookmark(user.id, id);
      if (activeUserIdRef.current === user.id) {
        setBookmarks((prev) => prev.filter((b) => b.id !== id));
      }
      return { success: true, error: null };
    } catch (err: any) {
      const translated = translateSupabaseError(err);
      return {
        success: false,
        error: translated,
      };
    }
  };

  const toggleFavourite = async (id: string) => {
    if (!user?.id) return;
    try {
      const updated = await bookmarkRepository.toggleFavourite(user.id, id);
      if (activeUserIdRef.current === user.id) {
        setBookmarks((prev) => prev.map((b) => (b.id === id ? updated : b)));
      }
    } catch (err) {
      console.error('[Shelf Bookmark Context] Failed to toggle favourite:', err);
    }
  };

  // In-memory update of collectionName snapshots for loaded bookmarks after collection rename
  const updateBookmarksCollectionName = useCallback(
    (collectionId: string, newCollectionName: string) => {
      setBookmarks((prev) =>
        prev.map((b) =>
          b.collectionId === collectionId
            ? { ...b, collectionName: newCollectionName }
            : b
        )
      );
    },
    []
  );

  // In-memory disassociation of deleted collection from loaded bookmarks
  const removeBookmarksFromCollection = useCallback((collectionId: string) => {
    setBookmarks((prev) =>
      prev.map((b) =>
        b.collectionId === collectionId
          ? { ...b, collectionId: undefined, collectionName: undefined }
          : b
      )
    );
  }, []);

  // In-memory removal of deleted tag ID from loaded bookmarks
  const removeTagFromBookmarks = useCallback((tagId: string) => {
    setBookmarks((prev) =>
      prev.map((b) => {
        if (b.tags && b.tags.includes(tagId)) {
          const remainingTags = b.tags.filter((t) => t !== tagId);
          return {
            ...b,
            tags: remainingTags.length > 0 ? remainingTags : undefined,
          };
        }
        return b;
      })
    );
  }, []);

  const refreshBookmarks = async () => {
    await retryLoad();
  };

  return (
    <BookmarkContext.Provider
      value={{
        bookmarks,
        isLoading,
        loadError,
        retryLoad,
        addBookmark,
        updateBookmark,
        deleteBookmark,
        isDuplicateUrl,
        toggleFavourite,
        updateBookmarksCollectionName,
        removeBookmarksFromCollection,
        removeTagFromBookmarks,
        refreshBookmarks,
      }}
    >
      {children}
    </BookmarkContext.Provider>
  );
};

export function useBookmarks(): BookmarkContextType {
  const context = useContext(BookmarkContext);
  if (!context) {
    throw new Error('useBookmarks must be used within a BookmarkProvider');
  }
  return context;
}

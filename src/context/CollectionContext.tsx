import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import type { Collection } from '../types';
import { useAuth } from '../hooks/useAuth';
import { useBookmarks } from './BookmarkContext';
import {
  collectionRepository,
  type CreateCollectionInput,
  type UpdateCollectionInput,
} from '../services/collectionService';
import { translateSupabaseError } from '../services/supabaseError';

export interface CollectionContextType {
  collections: Collection[];
  isLoading: boolean;
  loadError: Error | null;
  retryLoad: () => Promise<{ success: boolean; error: Error | null }>;
  createCollection: (
    input: CreateCollectionInput
  ) => Promise<{ collection: Collection | null; error: Error | null }>;
  updateCollection: (
    id: string,
    input: UpdateCollectionInput
  ) => Promise<{ collection: Collection | null; error: Error | null }>;
  deleteCollection: (id: string) => Promise<{ success: boolean; error: Error | null }>;
  getCollectionById: (id: string) => Collection | null;
  refreshCollections: () => Promise<void>;
}

const CollectionContext = createContext<CollectionContextType | undefined>(undefined);

export const CollectionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { updateBookmarksCollectionName, removeBookmarksFromCollection } = useBookmarks();

  const [collections, setCollections] = useState<Collection[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<Error | null>(null);

  // Active user and request counter to prevent asynchronous race conditions and stale response overwrites
  const activeUserIdRef = useRef<string | null>(null);
  const latestRequestIdRef = useRef<number>(0);
  const inFlightPromiseRef = useRef<Promise<{ success: boolean; error: Error | null }> | null>(null);

  const loadUserCollections = useCallback(
    async (userId: string | null, force: boolean = false): Promise<{ success: boolean; error: Error | null }> => {
      if (!userId) {
        activeUserIdRef.current = null;
        latestRequestIdRef.current++;
        inFlightPromiseRef.current = null;
        setCollections([]);
        setLoadError(null);
        setIsLoading(false);
        return { success: true, error: null };
      }

      if (activeUserIdRef.current !== userId) {
        activeUserIdRef.current = userId;
        latestRequestIdRef.current++;
        inFlightPromiseRef.current = null;
        setCollections([]);
        setLoadError(null);
      }

      if (!force && inFlightPromiseRef.current) {
        return inFlightPromiseRef.current;
      }

      const requestId = ++latestRequestIdRef.current;
      setIsLoading(true);
      setLoadError(null);

      const fetchPromise = (async () => {
        try {
          const data = await collectionRepository.getCollections(userId);
          if (activeUserIdRef.current === userId && latestRequestIdRef.current === requestId) {
            setCollections(data);
            setLoadError(null);
            setIsLoading(false);
            return { success: true, error: null };
          }
          return {
            success: false,
            error: new Error('Request was superseded by a newer operation.'),
          };
        } catch (err: any) {
          const translated = translateSupabaseError(err, { entityType: 'collection' });
          if (activeUserIdRef.current === userId && latestRequestIdRef.current === requestId) {
            console.error('[Shelf Collection Context] Failed to load collections for user:', err);
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

  // Synchronise collection state whenever user changes
  useEffect(() => {
    const currentUserId = user?.id || null;
    loadUserCollections(currentUserId);
  }, [user?.id, loadUserCollections]);

  // Listen for storage / cross-tab updates for current user
  useEffect(() => {
    const handleStorageUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<{ userId?: string }>;
      if (user?.id && (!customEvent.detail?.userId || customEvent.detail.userId === user.id)) {
        loadUserCollections(user.id);
      }
    };

    window.addEventListener('shelf-collections-updated', handleStorageUpdate);
    return () => {
      window.removeEventListener('shelf-collections-updated', handleStorageUpdate);
    };
  }, [user?.id, loadUserCollections]);

  const retryLoad = useCallback(async (): Promise<{ success: boolean; error: Error | null }> => {
    if (!user?.id) {
      return {
        success: false,
        error: new Error('You must be signed in to load collections.'),
      };
    }
    return loadUserCollections(user.id, true);
  }, [user?.id, loadUserCollections]);

  const createCollection = async (
    input: CreateCollectionInput
  ): Promise<{ collection: Collection | null; error: Error | null }> => {
    if (!user?.id) {
      return {
        collection: null,
        error: new Error('You must be signed in to create collections.'),
      };
    }

    try {
      const created = await collectionRepository.createCollection(user.id, input);
      if (activeUserIdRef.current === user.id) {
        setCollections((prev) => [...prev.filter((c) => c.id !== created.id), created]);
      }
      return { collection: created, error: null };
    } catch (err: any) {
      const translated = translateSupabaseError(err, { entityType: 'collection', name: input.name });
      return {
        collection: null,
        error: translated,
      };
    }
  };

  const updateCollection = async (
    id: string,
    input: UpdateCollectionInput
  ): Promise<{ collection: Collection | null; error: Error | null }> => {
    if (!user?.id) {
      return {
        collection: null,
        error: new Error('You must be signed in to update collections.'),
      };
    }

    try {
      // 1. Perform only the collection repository update as persistence
      const updated = await collectionRepository.updateCollection(user.id, id, input);

      // 2. Update collection list in memory
      if (activeUserIdRef.current === user.id) {
        setCollections((prev) => prev.map((c) => (c.id === id ? updated : c)));
      }

      // 3. If the name changed, update collectionName snapshot on loaded bookmarks in memory
      if (input.name !== undefined && input.name.trim() !== '') {
        updateBookmarksCollectionName(id, updated.name);
      }

      return { collection: updated, error: null };
    } catch (err: any) {
      const translated = translateSupabaseError(err, { entityType: 'collection', name: input.name });
      return {
        collection: null,
        error: translated,
      };
    }
  };

  const deleteCollection = async (
    id: string
  ): Promise<{ success: boolean; error: Error | null }> => {
    if (!user?.id) {
      return {
        success: false,
        error: new Error('You must be signed in to delete collections.'),
      };
    }

    try {
      // 1. Delete collection from repository (ONLY persistence call)
      await collectionRepository.deleteCollection(user.id, id);

      // 2. Clear collection association on currently loaded bookmarks in memory
      removeBookmarksFromCollection(id);

      // 3. Update collection list in memory
      if (activeUserIdRef.current === user.id) {
        setCollections((prev) => prev.filter((c) => c.id !== id));
      }

      return { success: true, error: null };
    } catch (err: any) {
      const translated = translateSupabaseError(err, { entityType: 'collection' });
      return {
        success: false,
        error: translated,
      };
    }
  };

  const getCollectionById = useCallback(
    (id: string): Collection | null => {
      return collections.find((c) => c.id === id) || null;
    },
    [collections]
  );

  const refreshCollections = async () => {
    await retryLoad();
  };

  return (
    <CollectionContext.Provider
      value={{
        collections,
        isLoading,
        loadError,
        retryLoad,
        createCollection,
        updateCollection,
        deleteCollection,
        getCollectionById,
        refreshCollections,
      }}
    >
      {children}
    </CollectionContext.Provider>
  );
};

export function useCollections(): CollectionContextType {
  const context = useContext(CollectionContext);
  if (!context) {
    throw new Error('useCollections must be used within a CollectionProvider');
  }
  return context;
}

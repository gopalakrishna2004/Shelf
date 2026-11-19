import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import type { Tag } from '../types';
import { useAuth } from '../hooks/useAuth';
import { useBookmarks } from './BookmarkContext';
import {
  tagRepository,
  type CreateTagInput,
  type UpdateTagInput,
} from '../services/tagService';
import { translateSupabaseError } from '../services/supabaseError';

export interface TagContextType {
  tags: Tag[];
  isLoading: boolean;
  loadError: Error | null;
  retryLoad: () => Promise<{ success: boolean; error: Error | null }>;
  createTag: (input: CreateTagInput) => Promise<{ tag: Tag | null; error: Error | null }>;
  updateTag: (id: string, input: UpdateTagInput) => Promise<{ tag: Tag | null; error: Error | null }>;
  deleteTag: (id: string) => Promise<{ success: boolean; error: Error | null }>;
  getTagById: (id: string) => Tag | null;
  refreshTags: () => Promise<void>;
}

const TagContext = createContext<TagContextType | undefined>(undefined);

export const TagProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { removeTagFromBookmarks } = useBookmarks();

  const [tags, setTags] = useState<Tag[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<Error | null>(null);

  // Active user and request counter to prevent asynchronous race conditions and stale response overwrites
  const activeUserIdRef = useRef<string | null>(null);
  const latestRequestIdRef = useRef<number>(0);
  const inFlightPromiseRef = useRef<Promise<{ success: boolean; error: Error | null }> | null>(null);

  const loadUserTags = useCallback(
    async (userId: string | null, force: boolean = false): Promise<{ success: boolean; error: Error | null }> => {
      if (!userId) {
        activeUserIdRef.current = null;
        latestRequestIdRef.current++;
        inFlightPromiseRef.current = null;
        setTags([]);
        setLoadError(null);
        setIsLoading(false);
        return { success: true, error: null };
      }

      if (activeUserIdRef.current !== userId) {
        activeUserIdRef.current = userId;
        latestRequestIdRef.current++;
        inFlightPromiseRef.current = null;
        setTags([]);
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
          const data = await tagRepository.getTags(userId);
          if (activeUserIdRef.current === userId && latestRequestIdRef.current === requestId) {
            setTags(data);
            setLoadError(null);
            setIsLoading(false);
            return { success: true, error: null };
          }
          return {
            success: false,
            error: new Error('Request was superseded by a newer operation.'),
          };
        } catch (err: any) {
          const translated = translateSupabaseError(err, { entityType: 'tag' });
          if (activeUserIdRef.current === userId && latestRequestIdRef.current === requestId) {
            console.error('[Shelf Tag Context] Failed to load tags for user:', err);
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

  // Synchronise tag state whenever user changes
  useEffect(() => {
    const currentUserId = user?.id || null;
    loadUserTags(currentUserId);
  }, [user?.id, loadUserTags]);

  // Listen for storage / cross-tab updates for current user
  useEffect(() => {
    const handleStorageUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<{ userId?: string }>;
      if (user?.id && (!customEvent.detail?.userId || customEvent.detail.userId === user.id)) {
        loadUserTags(user.id);
      }
    };

    window.addEventListener('shelf-tags-updated', handleStorageUpdate);
    return () => {
      window.removeEventListener('shelf-tags-updated', handleStorageUpdate);
    };
  }, [user?.id, loadUserTags]);

  const retryLoad = useCallback(async (): Promise<{ success: boolean; error: Error | null }> => {
    if (!user?.id) {
      return {
        success: false,
        error: new Error('You must be signed in to load tags.'),
      };
    }
    return loadUserTags(user.id, true);
  }, [user?.id, loadUserTags]);

  const createTag = async (
    input: CreateTagInput
  ): Promise<{ tag: Tag | null; error: Error | null }> => {
    if (!user?.id) {
      return {
        tag: null,
        error: new Error('You must be signed in to create tags.'),
      };
    }

    try {
      const created = await tagRepository.createTag(user.id, input);
      if (activeUserIdRef.current === user.id) {
        setTags((prev) => [...prev.filter((t) => t.id !== created.id), created]);
      }
      return { tag: created, error: null };
    } catch (err: any) {
      const translated = translateSupabaseError(err, { entityType: 'tag', name: input.name });
      return {
        tag: null,
        error: translated,
      };
    }
  };

  const updateTag = async (
    id: string,
    input: UpdateTagInput
  ): Promise<{ tag: Tag | null; error: Error | null }> => {
    if (!user?.id) {
      return {
        tag: null,
        error: new Error('You must be signed in to update tags.'),
      };
    }

    try {
      const updated = await tagRepository.updateTag(user.id, id, input);
      if (activeUserIdRef.current === user.id) {
        setTags((prev) => prev.map((t) => (t.id === id ? updated : t)));
      }
      return { tag: updated, error: null };
    } catch (err: any) {
      const translated = translateSupabaseError(err, { entityType: 'tag', name: input.name });
      return {
        tag: null,
        error: translated,
      };
    }
  };

  const deleteTag = async (
    id: string
  ): Promise<{ success: boolean; error: Error | null }> => {
    if (!user?.id) {
      return {
        success: false,
        error: new Error('You must be signed in to delete tags.'),
      };
    }

    try {
      // 1. Delete tag from storage repository (ONLY persistence call)
      await tagRepository.deleteTag(user.id, id);

      // 2. Remove this tag from loaded bookmarks in memory
      removeTagFromBookmarks(id);

      // 3. Update tag list in memory
      if (activeUserIdRef.current === user.id) {
        setTags((prev) => prev.filter((t) => t.id !== id));
      }

      return { success: true, error: null };
    } catch (err: any) {
      const translated = translateSupabaseError(err, { entityType: 'tag' });
      return {
        success: false,
        error: translated,
      };
    }
  };

  const getTagById = useCallback(
    (id: string): Tag | null => {
      return tags.find((t) => t.id === id) || null;
    },
    [tags]
  );

  const refreshTags = async () => {
    await retryLoad();
  };

  return (
    <TagContext.Provider
      value={{
        tags,
        isLoading,
        loadError,
        retryLoad,
        createTag,
        updateTag,
        deleteTag,
        getTagById,
        refreshTags,
      }}
    >
      {children}
    </TagContext.Provider>
  );
};

export function useTags(): TagContextType {
  const context = useContext(TagContext);
  if (!context) {
    throw new Error('useTags must be used within a TagProvider');
  }
  return context;
}

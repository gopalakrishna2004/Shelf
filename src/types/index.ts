export type Theme = 'light' | 'dark' | 'system';

export type PageId =
  | 'home'
  | 'all'
  | 'favourites'
  | 'collections'
  | 'collection'
  | 'tags'
  | 'tag'
  | 'settings';

export type ViewMode = 'grid' | 'list';

export type SortOption = 'newest' | 'oldest' | 'title-asc' | 'title-desc';

export interface Bookmark {
  id: string;
  url: string;
  title: string;
  domain: string;
  description?: string;
  favicon?: string;
  previewImage?: string;
  collectionId?: string;
  collectionName?: string;
  tags?: string[];
  isFavourite: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface Collection {
  id: string;
  name: string;
  description?: string;
  color?: string;
  count?: number;
  createdAt: string;
  updatedAt?: string;
}

export interface Tag {
  id: string;
  name: string;
  createdAt: string;
  updatedAt?: string;
}

export interface AppPreferences {
  theme: Theme;
  defaultView: ViewMode;
  defaultSort: SortOption;
  openInNewTab: boolean;
  showDescriptions: boolean;
}

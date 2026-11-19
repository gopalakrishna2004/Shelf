import React from 'react';
import { Bookmark, Star, FolderPlus, Tag, Compass } from 'lucide-react';
import { Button } from '../ui/Button';

export interface BookmarkEmptyStateProps {
  type?: 'all' | 'favourites' | 'collections' | 'tags' | 'search' | 'recent';
  title?: string;
  description?: string;
  onAction?: () => void;
  actionLabel?: string;
}

export const BookmarkEmptyState: React.FC<BookmarkEmptyStateProps> = ({
  type = 'all',
  title,
  description,
  onAction,
  actionLabel
}) => {
  const content = {
    all: {
      icon: <Bookmark className="w-6 h-6 text-shelf-terracotta" strokeWidth={1.8} />,
      title: "Your library is ready",
      description: "You haven't saved any websites to Shelf yet. Add your first bookmark or import links to begin curating your collection.",
      defaultAction: "Add your first link"
    },
    favourites: {
      icon: <Star className="w-6 h-6 text-shelf-terracotta fill-shelf-terracotta" strokeWidth={1.8} />,
      title: "No starred bookmarks",
      description: "Mark essential essays, references, and daily tools as favourites to access them quickly here.",
      defaultAction: "Browse all bookmarks"
    },
    collections: {
      icon: <FolderPlus className="w-6 h-6 text-shelf-terracotta" strokeWidth={1.8} />,
      title: "No shelves created yet",
      description: "Collections let you group related links by research project, reading list, or subject matter.",
      defaultAction: "Create a shelf"
    },
    tags: {
      icon: <Tag className="w-6 h-6 text-shelf-terracotta" strokeWidth={1.8} />,
      title: "No tags created yet",
      description: "Tags let you label and organise bookmarks flexibly across multiple topics and shelves.",
      defaultAction: "Create a tag"
    },
    search: {
      icon: <Compass className="w-6 h-6 text-shelf-terracotta" strokeWidth={1.8} />,
      title: "No matching bookmarks found",
      description: "Try adjusting your search terms or clearing active collection and sorting filters.",
      defaultAction: "Clear filters"
    },
    recent: {
      icon: <Bookmark className="w-6 h-6 text-shelf-terracotta" strokeWidth={1.8} />,
      title: "Nothing added recently",
      description: "Newly saved links will appear here for immediate access across desktop sessions.",
      defaultAction: "Add a link"
    }
  }[type];

  return (
    <div className="flex flex-col items-center justify-center text-center p-10 sm:p-14 rounded-[22px] bg-gradient-to-b from-white/75 to-shelf-surfaceSubtle/60 dark:from-shelf-surfaceDark/70 dark:to-shelf-dark/80 border border-shelf-borderLight/60 dark:border-shelf-borderDark/60 shadow-[0_4px_20px_rgba(36,35,33,0.03)] my-3 transition-colors">
      <div className="w-14 h-14 p-3.5 mb-4 rounded-[18px] bg-white dark:bg-shelf-surfaceDark border-2 border-shelf-terracotta/30 dark:border-shelf-terracotta/40 shadow-[0_6px_20px_rgba(201,75,54,0.18)] flex items-center justify-center">
        {content.icon}
      </div>
      <h3 className="font-editorial text-2xl font-medium tracking-tight text-shelf-dark dark:text-shelf-ivory">
        {title || content.title}
      </h3>
      <p className="mt-2 max-w-md text-xs sm:text-sm text-shelf-muted dark:text-shelf-mutedDark leading-relaxed">
        {description || content.description}
      </p>
      {onAction && (
        <div className="mt-6">
          <Button
            variant="primary"
            size="md"
            onClick={onAction}
          >
            {actionLabel || content.defaultAction}
          </Button>
        </div>
      )}
    </div>
  );
};

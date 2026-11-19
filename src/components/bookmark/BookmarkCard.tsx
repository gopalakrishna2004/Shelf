import React, { useState } from 'react';
import { Star, ExternalLink, Globe } from 'lucide-react';
import type { Bookmark, ViewMode } from '../../types';
import { cn, extractDomain, getDomainInitial } from '../../lib/utils';
import { getPreviewImageUrl } from '../../lib/metadata';
import { Badge } from '../ui/Badge';
import { usePreferences } from '../../hooks/usePreferences';
import { useBookmarks } from '../../context/BookmarkContext';
import { useTags } from '../../context/TagContext';
import { BookmarkActionMenu } from './BookmarkActionMenu';

export interface BookmarkCardProps {
  bookmark: Bookmark;
  viewMode?: ViewMode;
  openInNewTab?: boolean;
  onToggleFavourite?: (id: string) => void;
  onEdit?: (bookmark: Bookmark) => void;
  onDelete?: (bookmark: Bookmark) => void;
  onOpenActions?: (bookmark: Bookmark) => void;
}

export const BookmarkCard: React.FC<BookmarkCardProps> = ({
  bookmark,
  viewMode = 'grid',
  openInNewTab: propOpenInNewTab,
  onToggleFavourite: propOnToggleFavourite,
  onEdit,
  onDelete,
  onOpenActions,
}) => {
  const { openInNewTab: prefOpenInNewTab } = usePreferences();
  const { toggleFavourite: contextToggleFavourite } = useBookmarks();
  const { tags } = useTags();

  const [faviconError, setFaviconError] = useState(false);
  const [imageError, setImageError] = useState(false);

  const handleTagClick = (e: React.MouseEvent, tagId: string) => {
    e.preventDefault();
    e.stopPropagation();
    window.dispatchEvent(
      new CustomEvent('shelf-select-tag', { detail: { tagId } })
    );
  };

  const handleCollectionClick = (e: React.MouseEvent, collectionId: string) => {
    e.preventDefault();
    e.stopPropagation();
    window.dispatchEvent(
      new CustomEvent('shelf-select-collection', { detail: { collectionId } })
    );
  };

  const shouldOpenInNewTab = propOpenInNewTab ?? prefOpenInNewTab;
  const linkTarget = shouldOpenInNewTab ? '_blank' : '_self';
  const linkRel = shouldOpenInNewTab ? 'noopener noreferrer' : undefined;

  const domain = bookmark.domain || extractDomain(bookmark.url);
  const initial = getDomainInitial(domain);

  // Determine thumbnail: use explicitly stored previewImage, or derive on the fly
  const previewUrl = bookmark.previewImage || (bookmark.url ? getPreviewImageUrl(bookmark.url) : undefined);

  const handleToggleFav = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (propOnToggleFavourite) {
      propOnToggleFavourite(bookmark.id);
    } else {
      contextToggleFavourite(bookmark.id);
    }
  };

  const handleEdit = () => {
    if (onEdit) {
      onEdit(bookmark);
    } else {
      window.dispatchEvent(
        new CustomEvent('shelf-open-bookmark-edit', { detail: { bookmark } })
      );
    }
  };

  const handleDelete = () => {
    if (onDelete) {
      onDelete(bookmark);
    } else {
      window.dispatchEvent(
        new CustomEvent('shelf-open-bookmark-delete', { detail: { bookmark } })
      );
    }
  };

  // ==========================================
  // LIST VIEW ROW
  // ==========================================
  if (viewMode === 'list') {
    return (
      <div className="group relative flex items-center justify-between gap-4 px-4 sm:px-5 py-3 min-h-[66px] bg-white dark:bg-shelf-surfaceDark border border-shelf-borderLight/70 dark:border-shelf-borderDark/80 rounded-[14px] hover:border-shelf-terracotta/50 hover:shadow-[0_6px_20px_rgba(201,75,54,0.1)] hover:-translate-y-[1px] transition-all duration-150">
        <div className="flex items-center gap-3.5 min-w-0 flex-1">
          {/* Favicon / Monogram Badge */}
          <div className="w-9 h-9 shrink-0 flex items-center justify-center rounded-[10px] bg-shelf-stone/20 dark:bg-shelf-borderDark text-shelf-dark dark:text-shelf-ivory border border-shelf-borderLight/60 dark:border-shelf-borderDark text-xs font-mono font-medium shadow-sm overflow-hidden">
            {bookmark.favicon && !faviconError ? (
              <img
                src={bookmark.favicon}
                alt=""
                className="w-4 h-4 object-contain rounded-[3px]"
                onError={() => setFaviconError(true)}
              />
            ) : initial ? (
              <span className="text-shelf-terracotta font-mono font-semibold">{initial}</span>
            ) : (
              <Globe className="w-4 h-4 text-shelf-terracotta" />
            )}
          </div>

          {/* Details */}
          <div className="min-w-0 flex-1 flex flex-col justify-center">
            {/* Title & Collection Row */}
            <div className="flex items-center gap-2 min-w-0">
              <a
                href={bookmark.url}
                target={linkTarget}
                rel={linkRel}
                onClick={(e) => e.stopPropagation()}
                className="font-medium text-xs sm:text-sm text-shelf-dark dark:text-shelf-ivory hover:text-shelf-terracotta dark:hover:text-shelf-terracotta transition-colors truncate focus-ring"
                title={bookmark.title}
              >
                {bookmark.title}
              </a>
              {bookmark.collectionName && bookmark.collectionId ? (
                <button
                  type="button"
                  onClick={(e) => handleCollectionClick(e, bookmark.collectionId!)}
                  className="hover:opacity-80 transition-opacity focus-ring rounded-[6px]"
                  title={`View ${bookmark.collectionName} collection`}
                >
                  <Badge variant="accent" className="text-[10px] shrink-0 font-mono py-0.5 px-2 cursor-pointer">
                    {bookmark.collectionName}
                  </Badge>
                </button>
              ) : bookmark.collectionName ? (
                <Badge variant="accent" className="text-[10px] shrink-0 font-mono py-0.5 px-2">
                  {bookmark.collectionName}
                </Badge>
              ) : null}
              {bookmark.tags && bookmark.tags.length > 0 && (
                <div className="flex items-center gap-1 shrink-0">
                  {bookmark.tags.slice(0, 2).map((tagId) => {
                    const tagObj = tags.find((t) => t.id === tagId);
                    const tagName = tagObj ? tagObj.name : tagId;
                    return (
                      <button
                        key={tagId}
                        type="button"
                        onClick={(e) => handleTagClick(e, tagId)}
                        className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-shelf-stone/20 dark:bg-shelf-surfaceDark text-shelf-muted dark:text-shelf-mutedDark hover:text-shelf-terracotta dark:hover:text-shelf-terracotta transition-colors"
                        title={`Filter by #${tagName}`}
                      >
                        #{tagName}
                      </button>
                    );
                  })}
                  {bookmark.tags.length > 2 && (
                    <span className="text-[10px] font-mono text-shelf-muted/60 dark:text-shelf-mutedDark/60">
                      +{bookmark.tags.length - 2}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Domain & Note Row */}
            <div className="flex items-center gap-2 mt-1 text-xs text-shelf-muted dark:text-shelf-mutedDark min-w-0">
              <span className="font-mono text-[11px] text-shelf-muted/90 dark:text-shelf-mutedDark/90 shrink-0">
                {domain}
              </span>
              {bookmark.description && (
                <>
                  <span className="text-shelf-muted/40 dark:text-shelf-mutedDark/40 shrink-0 select-none">•</span>
                  <span
                    className="truncate min-w-0 text-shelf-muted/80 dark:text-shelf-mutedDark/80 text-[11px]"
                    title={bookmark.description}
                  >
                    {bookmark.description}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1 shrink-0 ml-auto">
          <button
            type="button"
            onClick={handleToggleFav}
            title={bookmark.isFavourite ? 'Remove from favourites' : 'Add to favourites'}
            aria-label={bookmark.isFavourite ? 'Remove from favourites' : 'Add to favourites'}
            className={cn(
              'w-8 h-8 flex items-center justify-center rounded-[8px] transition-all duration-150 focus-ring hover:bg-shelf-stone/20 dark:hover:bg-white/[0.05]',
              bookmark.isFavourite
                ? 'text-shelf-terracotta'
                : 'text-shelf-muted dark:text-shelf-mutedDark hover:text-shelf-dark dark:hover:text-shelf-ivory opacity-60 group-hover:opacity-100'
            )}
          >
            <Star className={cn('w-4 h-4', bookmark.isFavourite && 'fill-shelf-terracotta text-shelf-terracotta')} />
          </button>

          <a
            href={bookmark.url}
            target={linkTarget}
            rel={linkRel}
            onClick={(e) => e.stopPropagation()}
            title="Open website"
            aria-label="Open website"
            className="w-8 h-8 flex items-center justify-center text-shelf-muted dark:text-shelf-mutedDark hover:text-shelf-dark dark:hover:text-shelf-ivory opacity-60 group-hover:opacity-100 rounded-[8px] hover:bg-shelf-stone/20 dark:hover:bg-white/[0.05] transition-all duration-150 focus-ring"
          >
            <ExternalLink className="w-4 h-4" />
          </a>

          {/* More Options Dropdown Container */}
          <BookmarkActionMenu
            onEdit={handleEdit}
            onDelete={handleDelete}
            onOpenActions={onOpenActions ? () => onOpenActions(bookmark) : undefined}
            iconClassName="w-4 h-4"
          />
        </div>
      </div>
    );
  }

  // ==========================================
  // GRID VIEW CARD
  // ==========================================
  return (
    <div className="group relative flex flex-col justify-between p-4 sm:p-5 bg-white dark:bg-shelf-surfaceDark border border-shelf-borderLight/70 dark:border-shelf-borderDark/80 rounded-[18px] hover:border-shelf-terracotta/50 hover:shadow-[0_12px_32px_rgba(201,75,54,0.12)] hover:-translate-y-1 transition-all duration-200 shadow-[0_4px_16px_rgba(36,35,33,0.03)] h-full min-h-[310px]">
      <div className="flex flex-col flex-1">
        {/* Card Header: Icon & Domain & Actions */}
        <div className="flex items-center justify-between gap-3 mb-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 shrink-0 flex items-center justify-center rounded-[8px] bg-shelf-stone/20 dark:bg-shelf-borderDark text-shelf-dark dark:text-shelf-ivory border border-shelf-borderLight/60 dark:border-shelf-borderDark text-xs font-mono font-medium shadow-sm overflow-hidden">
              {bookmark.favicon && !faviconError ? (
                <img
                  src={bookmark.favicon}
                  alt=""
                  className="w-3.5 h-3.5 object-contain rounded-[2px]"
                  onError={() => setFaviconError(true)}
                />
              ) : initial ? (
                <span className="text-shelf-terracotta font-mono font-semibold text-[11px]">{initial}</span>
              ) : (
                <Globe className="w-3.5 h-3.5 text-shelf-terracotta" />
              )}
            </div>
            <span className="font-mono text-[11px] text-shelf-muted dark:text-shelf-mutedDark truncate px-2 py-0.5 rounded-full bg-shelf-stone/20 dark:bg-shelf-surfaceDark">
              {domain}
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={handleToggleFav}
              title={bookmark.isFavourite ? 'Remove from favourites' : 'Add to favourites'}
              aria-label={bookmark.isFavourite ? 'Remove from favourites' : 'Add to favourites'}
              className={cn(
                'p-1.5 rounded-[8px] transition-all focus-ring hover:bg-shelf-stone/20 dark:hover:bg-white/[0.05]',
                bookmark.isFavourite
                  ? 'text-shelf-terracotta'
                  : 'text-shelf-muted dark:text-shelf-mutedDark hover:text-shelf-dark dark:hover:text-shelf-ivory opacity-50 group-hover:opacity-100'
              )}
            >
              <Star className={cn('w-3.5 h-3.5', bookmark.isFavourite && 'fill-shelf-terracotta text-shelf-terracotta')} />
            </button>

            <a
              href={bookmark.url}
              target={linkTarget}
              rel={linkRel}
              onClick={(e) => e.stopPropagation()}
              title="Open website"
              aria-label="Open website"
              className="p-1.5 text-shelf-muted dark:text-shelf-mutedDark hover:text-shelf-dark dark:hover:text-shelf-ivory opacity-50 group-hover:opacity-100 rounded-[8px] hover:bg-shelf-stone/20 dark:hover:bg-white/[0.05] transition-all focus-ring"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>

            {/* More Options Dropdown Container */}
            <BookmarkActionMenu
              onEdit={handleEdit}
              onDelete={handleDelete}
              onOpenActions={onOpenActions ? () => onOpenActions(bookmark) : undefined}
              triggerClassName="p-1.5 opacity-50 group-hover:opacity-100"
              iconClassName="w-3.5 h-3.5"
            />
          </div>
        </div>

        {/* Title */}
        <h4 className="font-editorial text-[17px] font-medium text-shelf-dark dark:text-shelf-ivory group-hover:text-shelf-terracotta transition-colors line-clamp-2 leading-snug tracking-tight mb-1">
          <a
            href={bookmark.url}
            target={linkTarget}
            rel={linkRel}
            onClick={(e) => e.stopPropagation()}
            className="focus-ring"
            title={bookmark.title}
          >
            {bookmark.title}
          </a>
        </h4>

        {/* Description / Personal Note */}
        {bookmark.description && (
          <p className="text-xs text-shelf-muted dark:text-shelf-mutedDark line-clamp-2 leading-relaxed mb-2">
            {bookmark.description}
          </p>
        )}

        {/* Visual Preview / Thumbnail Area */}
        <div className="relative w-full h-32 rounded-[12px] overflow-hidden bg-shelf-stone/20 dark:bg-shelf-surfaceDarkElevated border border-shelf-borderLight/60 dark:border-shelf-borderDark/60 my-2 shrink-0 flex items-center justify-center">
          {previewUrl && !imageError ? (
            <img
              src={previewUrl}
              alt=""
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
              onError={() => setImageError(true)}
              loading="lazy"
            />
          ) : (
            /* Intentional Shelf Bespoke Editorial Fallback Plate */
            <div className="w-full h-full relative flex flex-col items-center justify-center p-3 bg-gradient-to-br from-shelf-surfaceSubtle via-shelf-surfaceStone/40 to-shelf-stone/20 dark:from-[#262422] dark:via-[#2D2A28] dark:to-[#36322E] select-none">
              {/* Subtle background monogram watermark */}
              <div className="absolute right-3 -bottom-2 font-serif text-[72px] font-bold text-shelf-terracotta/[0.07] dark:text-shelf-terracotta/[0.12] pointer-events-none leading-none">
                {initial || 'S'}
              </div>

              {/* Center branded plaque */}
              <div className="relative z-10 flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/80 dark:bg-black/30 border border-shelf-borderLight/80 dark:border-white/10 shadow-sm backdrop-blur-sm">
                <span className="w-4 h-4 rounded-full bg-shelf-terracotta/10 dark:bg-shelf-terracotta/20 flex items-center justify-center text-shelf-terracotta">
                  {initial ? (
                    <span className="font-mono text-[10px] font-semibold">{initial}</span>
                  ) : (
                    <Globe className="w-3 h-3" />
                  )}
                </span>
                <span className="font-mono text-[11px] text-shelf-dark/80 dark:text-shelf-ivory/80 font-medium truncate max-w-[140px]">
                  {domain}
                </span>
              </div>

              {/* Quiet subtle bottom indicator bar */}
              <div className="relative z-10 mt-2.5 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-shelf-terracotta/40" />
                <span className="font-mono text-[9px] uppercase tracking-wider text-shelf-muted/70 dark:text-shelf-mutedDark/70">
                  Curated Reference
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Card Footer: Collection Tag Badge & Saved Indicator */}
      <div className="pt-2.5 border-t border-shelf-borderLight/40 dark:border-shelf-borderDark/40 flex items-center justify-between text-xs text-shelf-muted dark:text-shelf-mutedDark gap-2 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden">
          {bookmark.collectionName && bookmark.collectionId ? (
            <button
              type="button"
              onClick={(e) => handleCollectionClick(e, bookmark.collectionId!)}
              className="text-left shrink-0 hover:opacity-80 transition-opacity focus-ring rounded-[6px]"
              title={`View ${bookmark.collectionName} collection`}
            >
              <Badge variant="accent" className="text-[10px] font-mono shrink-0 cursor-pointer">
                {bookmark.collectionName}
              </Badge>
            </button>
          ) : bookmark.collectionName ? (
            <Badge variant="accent" className="text-[10px] font-mono shrink-0">
              {bookmark.collectionName}
            </Badge>
          ) : (
            <span className="text-[11px] font-mono text-shelf-muted/70 dark:text-shelf-mutedDark/70 shrink-0">Unsorted</span>
          )}

          {/* Tag Badges */}
          {bookmark.tags && bookmark.tags.length > 0 && (
            <div className="flex items-center gap-1 overflow-hidden">
              {bookmark.tags.slice(0, 2).map((tagId) => {
                const tagObj = tags.find((t) => t.id === tagId);
                const tagName = tagObj ? tagObj.name : tagId;
                return (
                  <button
                    key={tagId}
                    type="button"
                    onClick={(e) => handleTagClick(e, tagId)}
                    className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-shelf-stone/20 dark:bg-shelf-surfaceDarkElevated text-shelf-muted dark:text-shelf-mutedDark hover:border-shelf-terracotta/40 hover:text-shelf-terracotta dark:hover:text-shelf-terracotta transition-colors truncate max-w-[80px]"
                    title={`Filter by #${tagName}`}
                  >
                    #{tagName}
                  </button>
                );
              })}
              {bookmark.tags.length > 2 && (
                <span className="text-[10px] font-mono text-shelf-muted/60 dark:text-shelf-mutedDark/60 shrink-0">
                  +{bookmark.tags.length - 2}
                </span>
              )}
            </div>
          )}
        </div>
        <span className="text-[10.5px] font-mono text-shelf-muted/60 dark:text-shelf-mutedDark/60 shrink-0">Saved</span>
      </div>
    </div>
  );
};

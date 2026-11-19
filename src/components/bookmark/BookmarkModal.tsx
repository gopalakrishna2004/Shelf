import React, { useState, useEffect, useRef } from 'react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import {
  Bookmark as BookmarkIcon,
  Globe,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Star,
  Link2,
  Folder,
  ChevronDown,
  Tag as TagIcon,
  Plus,
  X,
} from 'lucide-react';
import { useBookmarks } from '../../context/BookmarkContext';
import { useCollections } from '../../context/CollectionContext';
import { useTags } from '../../context/TagContext';
import {
  normalizeUrl,
  isValidUrl,
  getFaviconUrl,
  getPreviewImageUrl,
  generateFallbackTitle,
  fetchOpenGraphImage,
} from '../../lib/metadata';
import { cn, extractDomain, getDomainInitial } from '../../lib/utils';
import type { Bookmark } from '../../types';

export interface BookmarkModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialBookmark?: Bookmark | null;
  initialUrl?: string;
}

export const BookmarkModal: React.FC<BookmarkModalProps> = ({
  isOpen,
  onClose,
  initialBookmark,
  initialUrl,
}) => {
  const { addBookmark, updateBookmark, isDuplicateUrl } = useBookmarks();
  const { collections } = useCollections();
  const { tags, createTag } = useTags();

  const isEditMode = Boolean(initialBookmark?.id);

  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>('');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [tagInputValue, setTagInputValue] = useState('');
  const [isFavourite, setIsFavourite] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | undefined>(undefined);
  const [favicon, setFavicon] = useState<string | undefined>(undefined);

  const [error, setError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasManuallyEditedTitle, setHasManuallyEditedTitle] = useState(false);
  const [faviconError, setFaviconError] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Safeguards against asynchronous preview race conditions
  const activeUrlRef = useRef<string>('');
  const requestSeqRef = useRef<number>(0);

  // Initialize or reset form state when modal opens or target bookmark changes
  useEffect(() => {
    if (isOpen) {
      setError(null);
      setSuccessNotice(null);
      setIsSubmitting(false);
      setFaviconError(false);
      setImageError(false);
      requestSeqRef.current += 1;

      if (initialBookmark) {
        // Edit mode: populate existing values
        const currentUrl = initialBookmark.url || '';
        activeUrlRef.current = currentUrl;
        setUrl(currentUrl);
        setTitle(initialBookmark.title || '');
        setNotes(initialBookmark.description || '');
        setSelectedCollectionId(initialBookmark.collectionId || '');
        setSelectedTagIds(initialBookmark.tags ? [...initialBookmark.tags] : []);
        setTagInputValue('');
        setIsFavourite(Boolean(initialBookmark.isFavourite));
        setPreviewImage(initialBookmark.previewImage || (currentUrl ? getPreviewImageUrl(currentUrl) : undefined));
        setFavicon(initialBookmark.favicon || (currentUrl ? getFaviconUrl(extractDomain(currentUrl)) : undefined));
        setHasManuallyEditedTitle(true);
      } else {
        // Create mode: start fresh (or with pre-filled initialUrl)
        const startingUrl = initialUrl?.trim() || '';
        activeUrlRef.current = startingUrl;
        setUrl(startingUrl);
        setTitle(startingUrl ? generateFallbackTitle(startingUrl) : '');
        setNotes('');
        setSelectedCollectionId('');
        setSelectedTagIds([]);
        setTagInputValue('');
        setIsFavourite(false);
        setPreviewImage(startingUrl ? getPreviewImageUrl(startingUrl) : undefined);
        setFavicon(startingUrl ? getFaviconUrl(extractDomain(startingUrl)) : undefined);
        setHasManuallyEditedTitle(false);
      }
    }
  }, [isOpen, initialBookmark, initialUrl]);

  // Derived metadata preview
  const normalizedCandidate = url.trim() ? normalizeUrl(url) : '';
  const domainPreview = normalizedCandidate ? extractDomain(normalizedCandidate) : '';
  const faviconPreviewUrl = favicon || (domainPreview ? getFaviconUrl(domainPreview) : '');
  const domainInitial = domainPreview ? getDomainInitial(domainPreview) : '';

  // Duplicate detection (excluding the bookmark currently being edited)
  const isDuplicate = Boolean(
    normalizedCandidate && isDuplicateUrl(normalizedCandidate, initialBookmark?.id)
  );

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextVal = e.target.value;
    setUrl(nextVal);
    setError(null);
    setFaviconError(false);
    setImageError(false);

    activeUrlRef.current = nextVal;
    const currentSeq = ++requestSeqRef.current;

    const trimmed = nextVal.trim();
    if (!trimmed) {
      setPreviewImage(undefined);
      setFavicon(undefined);
      return;
    }

    const normalized = normalizeUrl(trimmed);
    if (!normalized || !isValidUrl(normalized)) {
      return;
    }

    // Check if the URL matches the initial bookmark (preserve existing metadata)
    if (initialBookmark && normalizeUrl(initialBookmark.url).toLowerCase() === normalized.toLowerCase()) {
      setPreviewImage(initialBookmark.previewImage || getPreviewImageUrl(normalized));
      setFavicon(initialBookmark.favicon || getFaviconUrl(extractDomain(normalized)));
      return;
    }

    // URL has changed: rederive domain, favicon and immediate synchronous preview
    const nextDomain = extractDomain(normalized);
    const immediatePreview = getPreviewImageUrl(normalized);
    const immediateFavicon = getFaviconUrl(nextDomain);

    setPreviewImage(immediatePreview);
    setFavicon(immediateFavicon);

    // Asynchronously resolve Open Graph image with race-condition guard
    fetchOpenGraphImage(normalized, 1800)
      .then((og) => {
        if (og && currentSeq === requestSeqRef.current && activeUrlRef.current === nextVal) {
          setPreviewImage(og);
        }
      })
      .catch(() => {
        // Fallback already assigned synchronously
      });
  };

  const handleUrlBlur = () => {
    if (!url.trim()) return;

    const normalized = normalizeUrl(url);
    if (normalized) {
      setUrl(normalized);
      setFaviconError(false);

      // Auto-populate fallback title if user hasn't typed a custom title
      if (!hasManuallyEditedTitle || !title.trim()) {
        const fallback = generateFallbackTitle(normalized);
        setTitle(fallback);
      }

      // Live duplicate check
      if (isDuplicateUrl(normalized, initialBookmark?.id)) {
        setError('This link is already saved in your shelf.');
      } else if (error === 'This link is already saved in your shelf.') {
        setError(null);
      }
    }
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
    setHasManuallyEditedTitle(true);
  };

  const handleAddTag = async () => {
    const trimmed = tagInputValue.trim();
    if (!trimmed) return;

    // Check if an existing tag matches (case-insensitive)
    const existing = tags.find((t) => t.name.toLowerCase() === trimmed.toLowerCase());
    if (existing) {
      if (!selectedTagIds.includes(existing.id)) {
        setSelectedTagIds((prev) => [...prev, existing.id]);
      }
      setTagInputValue('');
      return;
    }

    // Otherwise create tag
    const { tag, error: tagErr } = await createTag({ name: trimmed });
    if (tag) {
      setSelectedTagIds((prev) => [...prev, tag.id]);
      setTagInputValue('');
    } else if (tagErr) {
      setError(tagErr.message);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setError(null);
    setSuccessNotice(null);

    const rawUrl = url.trim();
    if (!rawUrl) {
      setError('Please enter a website URL.');
      return;
    }

    const normalized = normalizeUrl(rawUrl);
    if (!normalized || !isValidUrl(normalized)) {
      setError('Please enter a valid website URL (e.g. https://example.com).');
      return;
    }

    if (isDuplicateUrl(normalized, initialBookmark?.id)) {
      setError('This link is already saved in your shelf.');
      return;
    }

    setIsSubmitting(true);

    const domain = extractDomain(normalized);
    const finalTitle = title.trim() || generateFallbackTitle(normalized);
    const finalDescription = notes.trim() || undefined;
    const finalFavicon = favicon || getFaviconUrl(domain);
    const finalPreview = previewImage || getPreviewImageUrl(normalized);

    let targetCollectionName: string | undefined = undefined;
    if (selectedCollectionId) {
      const found = collections.find((c) => c.id === selectedCollectionId);
      targetCollectionName = found?.name || (initialBookmark?.collectionId === selectedCollectionId ? initialBookmark.collectionName : undefined);
    }

    if (isEditMode && initialBookmark?.id) {
      // EDIT MODE: Update existing bookmark
      const { bookmark, error: updateErr } = await updateBookmark(initialBookmark.id, {
        url: normalized,
        title: finalTitle,
        domain,
        description: finalDescription,
        isFavourite,
        favicon: finalFavicon,
        previewImage: finalPreview,
        collectionId: selectedCollectionId || undefined,
        collectionName: targetCollectionName,
        tags: selectedTagIds,
      });

      if (updateErr || !bookmark) {
        setIsSubmitting(false);
        setError(updateErr?.message || 'Failed to update bookmark. Please try again.');
        return;
      }

      setSuccessNotice(`Updated "${bookmark.title}" successfully.`);
    } else {
      // CREATE MODE: Add new bookmark
      const { bookmark, error: saveErr } = await addBookmark({
        url: normalized,
        title: finalTitle,
        description: finalDescription,
        isFavourite,
        favicon: finalFavicon,
        previewImage: finalPreview,
        collectionId: selectedCollectionId || undefined,
        collectionName: targetCollectionName,
        tags: selectedTagIds,
      });

      if (saveErr || !bookmark) {
        setIsSubmitting(false);
        setError(saveErr?.message || 'Failed to save bookmark. Please try again.');
        return;
      }

      setSuccessNotice(`Saved "${bookmark.title}" to your shelf.`);
    }

    // Brief tactile confirmation before closing
    setTimeout(() => {
      setIsSubmitting(false);
      onClose();
    }, 800);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (!isSubmitting) onClose();
      }}
      title={isEditMode ? 'Edit Bookmark' : 'Add Bookmark'}
      description={
        isEditMode
          ? 'Refine title, notes, and curation details for this link.'
          : 'Catalog a thoughtful essay, documentation, or tool in your library.'
      }
      className="max-w-xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
        {/* 1. Website URL Input */}
        <div>
          <label
            htmlFor="full-bookmark-url-input"
            className="block text-xs font-medium text-shelf-dark dark:text-shelf-ivory mb-1.5"
          >
            Website URL <span className="text-shelf-terracotta">*</span>
          </label>
          <Input
            id="full-bookmark-url-input"
            type="text"
            placeholder="https://example.com/thoughtful-essay"
            value={url}
            onChange={handleUrlChange}
            onBlur={handleUrlBlur}
            disabled={isSubmitting || Boolean(successNotice)}
            required
            autoFocus={!isEditMode}
            icon={<Link2 className="w-4 h-4 text-shelf-terracotta" />}
          />

          {/* Domain & Favicon Preview Chip */}
          {domainPreview && (
            <div className="mt-2 flex items-center gap-2 px-2.5 py-1.5 rounded-[10px] bg-shelf-stone/20 dark:bg-shelf-surfaceDark border border-shelf-borderLight/60 dark:border-shelf-borderDark/60 text-xs w-fit text-shelf-muted dark:text-shelf-mutedDark animate-fadeIn">
              <div className="w-4 h-4 rounded-[4px] bg-white dark:bg-black/30 flex items-center justify-center shrink-0 overflow-hidden shadow-xs">
                {faviconPreviewUrl && !faviconError ? (
                  <img
                    src={faviconPreviewUrl}
                    alt=""
                    className="w-3.5 h-3.5 object-contain"
                    onError={() => setFaviconError(true)}
                  />
                ) : domainInitial ? (
                  <span className="text-[9px] font-mono font-semibold text-shelf-terracotta">
                    {domainInitial}
                  </span>
                ) : (
                  <Globe className="w-3 h-3 text-shelf-terracotta" />
                )}
              </div>
              <span className="font-mono text-[11px] truncate">{domainPreview}</span>
            </div>
          )}
        </div>

        {/* 2. Visual Preview & Thumbnail Card */}
        {domainPreview && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-shelf-dark dark:text-shelf-ivory">
                Visual Preview
              </span>
              <span className="text-[10px] text-shelf-muted dark:text-shelf-mutedDark font-mono">
                Grid card display
              </span>
            </div>

            <div className="relative w-full h-28 sm:h-32 rounded-[12px] overflow-hidden bg-shelf-stone/20 dark:bg-shelf-surfaceDarkElevated border border-shelf-borderLight/70 dark:border-shelf-borderDark/70 shrink-0 flex items-center justify-center shadow-xs">
              {previewImage && !imageError ? (
                <img
                  src={previewImage}
                  alt="Website preview thumbnail"
                  className="w-full h-full object-cover transition-transform duration-300"
                  onError={() => setImageError(true)}
                  loading="lazy"
                />
              ) : (
                /* Intentional Shelf Bespoke Editorial Fallback Plate */
                <div className="w-full h-full relative flex flex-col items-center justify-center p-3 bg-gradient-to-br from-shelf-surfaceSubtle via-shelf-surfaceStone/40 to-shelf-stone/20 dark:from-[#262422] dark:via-[#2D2A28] dark:to-[#36322E] select-none">
                  {/* Subtle background monogram watermark */}
                  <div className="absolute right-3 -bottom-2 font-serif text-[64px] font-bold text-shelf-terracotta/[0.07] dark:text-shelf-terracotta/[0.12] pointer-events-none leading-none">
                    {domainInitial || 'S'}
                  </div>

                  {/* Center branded plaque */}
                  <div className="relative z-10 flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/80 dark:bg-black/30 border border-shelf-borderLight/80 dark:border-white/10 shadow-sm backdrop-blur-sm">
                    <span className="w-4 h-4 rounded-full bg-shelf-terracotta/10 dark:bg-shelf-terracotta/20 flex items-center justify-center text-shelf-terracotta">
                      {domainInitial ? (
                        <span className="font-mono text-[10px] font-semibold">{domainInitial}</span>
                      ) : (
                        <Globe className="w-3 h-3" />
                      )}
                    </span>
                    <span className="font-mono text-[11px] text-shelf-dark/80 dark:text-shelf-ivory/80 font-medium truncate max-w-[150px]">
                      {domainPreview}
                    </span>
                  </div>

                  {/* Quiet subtle indicator */}
                  <div className="relative z-10 mt-2 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-shelf-terracotta/40" />
                    <span className="font-mono text-[9px] uppercase tracking-wider text-shelf-muted/70 dark:text-shelf-mutedDark/70">
                      Editorial Library Plate
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 3. Bookmark Title */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label
              htmlFor="full-bookmark-title-input"
              className="block text-xs font-medium text-shelf-dark dark:text-shelf-ivory"
            >
              Title
            </label>
            <span className="text-[10px] text-shelf-muted dark:text-shelf-mutedDark font-mono">
              Auto-formatted from URL
            </span>
          </div>
          <Input
            id="full-bookmark-title-input"
            placeholder="Title of this link or article"
            value={title}
            onChange={handleTitleChange}
            disabled={isSubmitting || Boolean(successNotice)}
          />
        </div>

        {/* 4. Shelf / Collection Assignment */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label
              htmlFor="full-bookmark-collection-select"
              className="block text-xs font-medium text-shelf-dark dark:text-shelf-ivory"
            >
              Shelf / Collection
            </label>
            <span className="text-[10px] text-shelf-muted dark:text-shelf-mutedDark font-mono">
              Organisational space
            </span>
          </div>
          <div className="relative">
            <select
              id="full-bookmark-collection-select"
              value={selectedCollectionId}
              onChange={(e) => setSelectedCollectionId(e.target.value)}
              disabled={isSubmitting || Boolean(successNotice)}
              className="w-full appearance-none bg-shelf-surfaceLight dark:bg-shelf-surfaceDark text-shelf-dark dark:text-shelf-ivory border border-shelf-borderLight/80 dark:border-shelf-borderDark/80 rounded-[12px] text-xs sm:text-sm py-2.5 pr-8 pl-9 cursor-pointer transition-all focus-ring hover:border-shelf-stone dark:hover:border-shelf-muted shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
            >
              <option value="">None / Unassigned</option>
              {collections.map((col) => (
                <option key={col.id} value={col.id}>
                  {col.name}
                </option>
              ))}
            </select>
            <Folder className="w-4 h-4 text-shelf-terracotta absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <ChevronDown className="w-4 h-4 text-shelf-muted dark:text-shelf-mutedDark absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* 5. Tags Selection & Inline Tagging */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-medium text-shelf-dark dark:text-shelf-ivory">
              Tags
            </label>
            <span className="text-[10px] text-shelf-muted dark:text-shelf-mutedDark font-mono">
              Multiple tags allowed
            </span>
          </div>

          {/* Active / Selected Tag Badges */}
          {selectedTagIds.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {selectedTagIds.map((tagId) => {
                const tagObj = tags.find((t) => t.id === tagId);
                const tagName = tagObj ? tagObj.name : tagId;
                return (
                  <span
                    key={tagId}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-shelf-terracottaMuted text-shelf-terracotta border border-shelf-terracotta/20 animate-fadeIn"
                  >
                    <span>#{tagName}</span>
                    <button
                      type="button"
                      onClick={() => setSelectedTagIds((prev) => prev.filter((id) => id !== tagId))}
                      disabled={isSubmitting || Boolean(successNotice)}
                      className="hover:bg-shelf-terracotta/15 rounded-full p-0.5 transition-colors focus-ring"
                      title={`Remove tag #${tagName}`}
                      aria-label={`Remove tag #${tagName}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                );
              })}
            </div>
          )}

          {/* Inline Tag Input */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Add or create a tag (e.g. Design, Reading)..."
                value={tagInputValue}
                onChange={(e) => setTagInputValue(e.target.value)}
                onKeyDown={async (e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    await handleAddTag();
                  }
                }}
                disabled={isSubmitting || Boolean(successNotice)}
                className="w-full bg-shelf-surfaceLight dark:bg-shelf-surfaceDark text-shelf-dark dark:text-shelf-ivory placeholder:text-shelf-muted/60 dark:placeholder:text-shelf-mutedDark/50 border border-shelf-borderLight/80 dark:border-shelf-borderDark/80 rounded-[12px] text-xs sm:text-sm py-2 pl-8 pr-3 focus-ring transition-all hover:border-shelf-stone dark:hover:border-shelf-muted shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
              />
              <TagIcon className="w-3.5 h-3.5 text-shelf-terracotta absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
            <button
              type="button"
              onClick={handleAddTag}
              disabled={!tagInputValue.trim() || isSubmitting || Boolean(successNotice)}
              className="px-3 py-2 text-xs font-medium bg-shelf-stone/30 dark:bg-shelf-surfaceDark text-shelf-dark dark:text-shelf-ivory hover:bg-shelf-terracotta hover:text-white dark:hover:bg-shelf-terracotta dark:hover:text-white rounded-[12px] border border-shelf-borderLight dark:border-shelf-borderDark transition-colors flex items-center gap-1 disabled:opacity-40 disabled:pointer-events-none"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add</span>
            </button>
          </div>

          {/* Available tags suggestions to click-and-pick */}
          {tags.filter((t) => !selectedTagIds.includes(t.id)).length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[10px] text-shelf-muted dark:text-shelf-mutedDark font-mono mr-1">
                Suggestions:
              </span>
              {tags
                .filter((t) => !selectedTagIds.includes(t.id))
                .slice(0, 6)
                .map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelectedTagIds((prev) => [...prev, t.id])}
                    disabled={isSubmitting || Boolean(successNotice)}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-shelf-surfaceSubtle dark:bg-shelf-surfaceDarkElevated text-shelf-muted dark:text-shelf-mutedDark border border-shelf-borderLight/80 dark:border-shelf-borderDark/80 hover:border-shelf-terracotta/40 hover:text-shelf-terracotta dark:hover:text-shelf-terracotta transition-colors"
                  >
                    <span>+{t.name}</span>
                  </button>
                ))}
            </div>
          )}
        </div>

        {/* 6. Personal Description / Curator Note */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label
              htmlFor="full-bookmark-notes-input"
              className="block text-xs font-medium text-shelf-dark dark:text-shelf-ivory"
            >
              Curator Note / Description
            </label>
            <span className="text-[10px] text-shelf-muted dark:text-shelf-mutedDark font-mono">
              Optional
            </span>
          </div>
          <textarea
            id="full-bookmark-notes-input"
            rows={3}
            placeholder="Why is this worth keeping? Thoughts, quotes, or takeaways..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={isSubmitting || Boolean(successNotice)}
            className="w-full bg-shelf-surfaceLight dark:bg-shelf-surfaceDark text-shelf-dark dark:text-shelf-ivory placeholder:text-shelf-muted/60 dark:placeholder:text-shelf-mutedDark/50 border border-shelf-borderLight/80 dark:border-shelf-borderDark/80 rounded-[12px] text-xs sm:text-sm p-3 focus-ring transition-all hover:border-shelf-stone dark:hover:border-shelf-muted shadow-[0_1px_2px_rgba(0,0,0,0.02)] resize-none"
          />
        </div>

        {/* 5. Tactile Favourite Toggle Row */}
        <div className="flex items-center justify-between p-3 rounded-[14px] bg-shelf-surfaceSubtle dark:bg-shelf-surfaceDark border border-shelf-borderLight/70 dark:border-shelf-borderDark/70 transition-colors">
          <div className="flex items-center gap-3 min-w-0 pr-3">
            <div
              className={cn(
                'w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0 transition-colors',
                isFavourite
                  ? 'bg-shelf-terracotta text-white shadow-xs'
                  : 'bg-shelf-stone/30 dark:bg-white/[0.05] text-shelf-muted dark:text-shelf-mutedDark'
              )}
            >
              <Star className={cn('w-4 h-4', isFavourite && 'fill-white text-white')} />
            </div>
            <div className="min-w-0">
              <span className="text-xs font-medium text-shelf-dark dark:text-shelf-ivory block leading-tight">
                Star as Favourite
              </span>
              <span className="text-[11px] text-shelf-muted dark:text-shelf-mutedDark block leading-tight mt-0.5 truncate">
                Keep this link directly accessible in your Starred shelf
              </span>
            </div>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={isFavourite}
            onClick={() => setIsFavourite(!isFavourite)}
            disabled={isSubmitting || Boolean(successNotice)}
            className={cn(
              'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-ring',
              isFavourite ? 'bg-shelf-terracotta' : 'bg-shelf-stone/60 dark:bg-shelf-borderDark'
            )}
          >
            <span
              className={cn(
                'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out',
                isFavourite ? 'translate-x-5' : 'translate-x-0'
              )}
            />
          </button>
        </div>

        {/* Inline Error State */}
        {error && (
          <div className="p-3 rounded-[12px] bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-start gap-2 animate-fadeIn">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}

        {/* Inline Success Notice */}
        {successNotice && (
          <div className="p-3 rounded-[12px] bg-shelf-terracottaMuted border border-shelf-terracotta/25 text-shelf-terracotta text-xs flex items-start gap-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-shelf-terracotta" />
            <span className="leading-relaxed font-medium">{successNotice}</span>
          </div>
        )}

        {/* Modal Footer Controls */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-shelf-borderLight/40 dark:border-shelf-borderDark/40">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={!url.trim() || isSubmitting || Boolean(successNotice) || isDuplicate}
            icon={
              isSubmitting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : isEditMode ? (
                <CheckCircle2 className="w-3.5 h-3.5" />
              ) : (
                <BookmarkIcon className="w-3.5 h-3.5" />
              )
            }
          >
            {isSubmitting
              ? isEditMode
                ? 'Saving Changes...'
                : 'Saving to Shelf...'
              : isEditMode
              ? 'Save Changes'
              : 'Save Bookmark'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

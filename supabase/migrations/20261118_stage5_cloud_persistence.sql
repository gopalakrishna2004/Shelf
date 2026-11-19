-- ============================================================================
-- Shelf - Stage 5: Online-Only Cloud Persistence Migration
-- File: supabase/migrations/20261118_stage5_cloud_persistence.sql
-- ============================================================================
-- Architecture: Online-Only, Authenticated PostgreSQL Persistence via Supabase
-- Target: collections, tags, bookmarks, bookmark_tags
-- Security: Row Level Security (RLS) enabled on all tables, same-user composite
--           foreign keys, SECURITY INVOKER transactional functions.
-- ============================================================================

-- ============================================================================
-- 1. HELPER: AUTOMATIC updated_at TIMESTAMP TRIGGER
-- ============================================================================
CREATE OR REPLACE FUNCTION public.fn_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := clock_timestamp();
    NEW.created_at := OLD.created_at; -- Invariant: created_at is immutable on update
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public, pg_temp;

-- ============================================================================
-- 2. COLLECTIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.collections (
    id TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT NULL,
    color TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT pk_collections PRIMARY KEY (id),
    -- Required for composite same-user foreign keys from bookmarks
    CONSTRAINT uq_collections_user_id UNIQUE (user_id, id),
    CONSTRAINT chk_collection_name_not_empty CHECK (length(trim(name)) > 0)
);

-- Case-insensitive unique collection name per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_collections_user_lower_name 
ON public.collections (user_id, lower(trim(name)));

-- Index for ordering collections by creation time
CREATE INDEX IF NOT EXISTS idx_collections_user_created 
ON public.collections (user_id, created_at DESC);

-- Trigger to maintain updated_at on collection update
DROP TRIGGER IF EXISTS trg_collections_updated_at ON public.collections;
CREATE TRIGGER trg_collections_updated_at
BEFORE UPDATE ON public.collections
FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- ============================================================================
-- 3. TAGS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.tags (
    id TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT pk_tags PRIMARY KEY (id),
    -- Required for composite same-user foreign keys from bookmark_tags
    CONSTRAINT uq_tags_user_id UNIQUE (user_id, id),
    CONSTRAINT chk_tag_name_not_empty CHECK (length(trim(name)) > 0)
);

-- Case-insensitive unique tag name per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_tags_user_lower_name 
ON public.tags (user_id, lower(trim(name)));

-- Index for ordering tags by creation time
CREATE INDEX IF NOT EXISTS idx_tags_user_created 
ON public.tags (user_id, created_at DESC);

-- Trigger to maintain updated_at on tag update
DROP TRIGGER IF EXISTS trg_tags_updated_at ON public.tags;
CREATE TRIGGER trg_tags_updated_at
BEFORE UPDATE ON public.tags
FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- ============================================================================
-- 4. BOOKMARKS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.bookmarks (
    id TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    title TEXT NOT NULL,
    domain TEXT NOT NULL,
    description TEXT NULL,
    favicon TEXT NULL,
    preview_image TEXT NULL,
    collection_id TEXT NULL,
    is_favourite BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT pk_bookmarks PRIMARY KEY (id),
    -- Required for composite same-user foreign keys from bookmark_tags
    CONSTRAINT uq_bookmarks_user_id UNIQUE (user_id, id),
    CONSTRAINT chk_bookmark_url_not_empty CHECK (length(trim(url)) > 0),
    CONSTRAINT chk_bookmark_title_not_empty CHECK (length(trim(title)) > 0),
    -- Composite foreign key guarantees collection belongs to the same user
    -- Deleting a collection unassigns its bookmarks without deleting them (user_id preserved)
    CONSTRAINT fk_bookmarks_collection FOREIGN KEY (user_id, collection_id)
        REFERENCES public.collections (user_id, id) ON DELETE SET NULL (collection_id)
);

-- Index for sorting bookmarks newest-first
CREATE INDEX IF NOT EXISTS idx_bookmarks_user_created 
ON public.bookmarks (user_id, created_at DESC);

-- Index for filtering bookmarks by collection
CREATE INDEX IF NOT EXISTS idx_bookmarks_user_collection 
ON public.bookmarks (user_id, collection_id);

-- Partial index for quick access to favourites
CREATE INDEX IF NOT EXISTS idx_bookmarks_user_favourite 
ON public.bookmarks (user_id, is_favourite) WHERE is_favourite = true;

-- Trigger to maintain updated_at on bookmark update
DROP TRIGGER IF EXISTS trg_bookmarks_updated_at ON public.bookmarks;
CREATE TRIGGER trg_bookmarks_updated_at
BEFORE UPDATE ON public.bookmarks
FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- ============================================================================
-- 5. BOOKMARK_TAGS (JOIN TABLE)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.bookmark_tags (
    bookmark_id TEXT NOT NULL,
    tag_id TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT pk_bookmark_tags PRIMARY KEY (bookmark_id, tag_id),
    -- Composite foreign keys strictly guarantee same-user ownership
    CONSTRAINT fk_bt_bookmark FOREIGN KEY (user_id, bookmark_id)
        REFERENCES public.bookmarks (user_id, id) ON DELETE CASCADE,
    CONSTRAINT fk_bt_tag FOREIGN KEY (user_id, tag_id)
        REFERENCES public.tags (user_id, id) ON DELETE CASCADE
);

-- Index for looking up all bookmarks for a specific tag
CREATE INDEX IF NOT EXISTS idx_bookmark_tags_tag_lookup 
ON public.bookmark_tags (user_id, tag_id);

-- Index for looking up all tags for a specific bookmark
CREATE INDEX IF NOT EXISTS idx_bookmark_tags_user_lookup 
ON public.bookmark_tags (user_id, bookmark_id, tag_id);

-- ============================================================================
-- 6. ROW LEVEL SECURITY (RLS) & TABLE PERMISSIONS
-- ============================================================================

-- Enable RLS across all application tables
ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookmark_tags ENABLE ROW LEVEL SECURITY;

-- Grant standard CRUD permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON public.collections TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tags TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bookmarks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bookmark_tags TO authenticated;

-- Revoke all table access from anonymous users
REVOKE ALL ON public.collections FROM anon;
REVOKE ALL ON public.tags FROM anon;
REVOKE ALL ON public.bookmarks FROM anon;
REVOKE ALL ON public.bookmark_tags FROM anon;

-- ============================================================================
-- RLS POLICIES (Strict User Isolation)
-- ============================================================================

-- Collections Policies
CREATE POLICY "collections_select" ON public.collections 
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "collections_insert" ON public.collections 
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "collections_update" ON public.collections 
FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "collections_delete" ON public.collections 
FOR DELETE USING (auth.uid() = user_id);

-- Tags Policies
CREATE POLICY "tags_select" ON public.tags 
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "tags_insert" ON public.tags 
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "tags_update" ON public.tags 
FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "tags_delete" ON public.tags 
FOR DELETE USING (auth.uid() = user_id);

-- Bookmarks Policies
CREATE POLICY "bookmarks_select" ON public.bookmarks 
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "bookmarks_insert" ON public.bookmarks 
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "bookmarks_update" ON public.bookmarks 
FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "bookmarks_delete" ON public.bookmarks 
FOR DELETE USING (auth.uid() = user_id);

-- Bookmark Tags Policies
CREATE POLICY "bookmark_tags_select" ON public.bookmark_tags 
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "bookmark_tags_insert" ON public.bookmark_tags 
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "bookmark_tags_update" ON public.bookmark_tags 
FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "bookmark_tags_delete" ON public.bookmark_tags 
FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- 7. TRANSACTIONAL HELPER: save_bookmark_with_tags
-- ============================================================================
-- Purpose: Atomically creates or updates a bookmark and replaces its tag
-- associations within a single PostgreSQL transaction.
-- Security: Configured as SECURITY INVOKER. Runs with the permissions and RLS
-- context of the authenticated caller (auth.uid()).
-- Ownership: Inspects GET DIAGNOSTICS ROW_COUNT immediately after the upsert.
-- If 0 rows were affected (due to another user owning the ID), raises an
-- exception and aborts before altering any tag associations.
-- Tag Normalization: Trims, filters blanks, and deduplicates tag IDs before
-- inserting and returning them in the response.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.save_bookmark_with_tags(
    p_bookmark JSONB,
    p_tag_ids TEXT[]
)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_bookmark_id TEXT;
    v_tag_id TEXT;
    v_row_count INT;
    v_normalized_tags TEXT[] := ARRAY[]::TEXT[];
    v_created_at TIMESTAMPTZ;
    v_updated_at TIMESTAMPTZ;
    v_res RECORD;
BEGIN
    -- 1. Enforce authentication
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'ERR_UNAUTHENTICATED: Authentication required';
    END IF;

    -- 2. Validate bookmark ID
    v_bookmark_id := p_bookmark->>'id';
    IF v_bookmark_id IS NULL OR trim(v_bookmark_id) = '' THEN
        RAISE EXCEPTION 'ERR_INVALID_INPUT: Bookmark id is required';
    END IF;

    -- 3. Validate required fields
    IF p_bookmark->>'url' IS NULL OR trim(p_bookmark->>'url') = '' THEN
        RAISE EXCEPTION 'ERR_INVALID_INPUT: Bookmark url is required';
    END IF;
    IF p_bookmark->>'title' IS NULL OR trim(p_bookmark->>'title') = '' THEN
        RAISE EXCEPTION 'ERR_INVALID_INPUT: Bookmark title is required';
    END IF;

    -- 4. Parse timestamps safely with fallbacks (legacy record compatibility)
    BEGIN
        v_created_at := COALESCE((p_bookmark->>'createdAt')::timestamptz, now());
    EXCEPTION WHEN OTHERS THEN
        v_created_at := now();
    END;

    BEGIN
        v_updated_at := COALESCE((p_bookmark->>'updatedAt')::timestamptz, now());
    EXCEPTION WHEN OTHERS THEN
        v_updated_at := now();
    END;

    -- 5. Normalize, trim, and deduplicate tag IDs
    IF p_tag_ids IS NOT NULL AND array_length(p_tag_ids, 1) > 0 THEN
        SELECT COALESCE(array_agg(DISTINCT trimmed_tag), ARRAY[]::TEXT[])
        INTO v_normalized_tags
        FROM (
            SELECT trim(t) AS trimmed_tag
            FROM unnest(p_tag_ids) AS t
            WHERE t IS NOT NULL AND length(trim(t)) > 0
        ) sub;
    END IF;

    -- 6. Atomically Upsert Bookmark
    INSERT INTO public.bookmarks (
        id,
        user_id,
        url,
        title,
        domain,
        description,
        favicon,
        preview_image,
        collection_id,
        is_favourite,
        created_at,
        updated_at
    ) VALUES (
        v_bookmark_id,
        v_user_id,
        p_bookmark->>'url',
        p_bookmark->>'title',
        COALESCE(p_bookmark->>'domain', ''),
        p_bookmark->>'description',
        p_bookmark->>'favicon',
        p_bookmark->>'previewImage',
        p_bookmark->>'collectionId',
        COALESCE((p_bookmark->>'isFavourite')::boolean, false),
        v_created_at,
        v_updated_at
    )
    ON CONFLICT (id) DO UPDATE SET
        url = EXCLUDED.url,
        title = EXCLUDED.title,
        domain = EXCLUDED.domain,
        description = EXCLUDED.description,
        favicon = EXCLUDED.favicon,
        preview_image = EXCLUDED.preview_image,
        collection_id = EXCLUDED.collection_id,
        is_favourite = EXCLUDED.is_favourite,
        updated_at = EXCLUDED.updated_at
    WHERE bookmarks.user_id = v_user_id;

    -- 7. Inspect Affected-Row Count (Detect cross-account collision)
    GET DIAGNOSTICS v_row_count = ROW_COUNT;

    IF v_row_count IS NULL OR v_row_count = 0 THEN
        RAISE EXCEPTION 'ERR_CROSS_ACCOUNT_COLLISION: Bookmark ID % belongs to another user or could not be updated', v_bookmark_id;
    END IF;

    -- 8. Atomically Replace Tag Associations (only reached when upsert affected a row)
    DELETE FROM public.bookmark_tags 
    WHERE user_id = v_user_id AND bookmark_id = v_bookmark_id;

    IF v_normalized_tags IS NOT NULL AND array_length(v_normalized_tags, 1) > 0 THEN
        FOREACH v_tag_id IN ARRAY v_normalized_tags
        LOOP
            INSERT INTO public.bookmark_tags (user_id, bookmark_id, tag_id)
            VALUES (v_user_id, v_bookmark_id, v_tag_id);
        END LOOP;
    END IF;

    -- 9. Return Full Resolved Entity with Normalized Tags
    SELECT b.*, c.name AS collection_name INTO v_res
    FROM public.bookmarks b
    LEFT JOIN public.collections c ON c.id = b.collection_id AND c.user_id = v_user_id
    WHERE b.id = v_bookmark_id AND b.user_id = v_user_id;

    RETURN jsonb_build_object(
        'id', v_res.id,
        'url', v_res.url,
        'title', v_res.title,
        'domain', v_res.domain,
        'description', v_res.description,
        'favicon', v_res.favicon,
        'previewImage', v_res.preview_image,
        'collectionId', v_res.collection_id,
        'collectionName', v_res.collection_name,
        'tags', COALESCE(v_normalized_tags, ARRAY[]::TEXT[]),
        'isFavourite', v_res.is_favourite,
        'createdAt', v_res.created_at,
        'updatedAt', v_res.updated_at
    );
END;
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public, pg_temp;

-- Revoke all function access from public and anonymous callers
REVOKE ALL ON FUNCTION public.save_bookmark_with_tags(JSONB, TEXT[]) FROM PUBLIC, anon;

-- Grant execution exclusively to authenticated users
GRANT EXECUTE ON FUNCTION public.save_bookmark_with_tags(JSONB, TEXT[]) TO authenticated;

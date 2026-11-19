/**
 * Supabase & PostgREST error translation utilities.
 * Maps low-level PostgreSQL and PostgREST error codes to user-friendly UI messages.
 */

export interface ErrorContext {
  entityType?: 'collection' | 'tag' | 'bookmark';
  name?: string;
}

/**
 * Translates an arbitrary error (PostgREST, network, auth, or generic) into a clean,
 * actionable Error instance for the Shelf UI.
 */
export function translateSupabaseError(error: any, context?: ErrorContext): Error {
  if (!error) {
    return new Error('An unexpected database error occurred.');
  }

  // If already an Error instance without Supabase code/status, check message
  const rawMessage = typeof error.message === 'string' ? error.message : String(error);
  const code = typeof error.code === 'string' ? error.code : '';
  const status = typeof error.status === 'number' ? error.status : undefined;

  // 1. Network & Offline errors
  if (
    (error instanceof TypeError && (rawMessage.includes('fetch') || rawMessage.includes('Failed to fetch'))) ||
    rawMessage.includes('Failed to fetch') ||
    rawMessage.includes('NetworkError') ||
    rawMessage.includes('Load failed') ||
    rawMessage.includes('ERR_CONNECTION_REFUSED') ||
    status === 0
  ) {
    return new Error('Unable to connect to Shelf cloud. Please check your internet connection.');
  }

  // 2. Authentication & Session expiration
  if (
    status === 401 ||
    code === 'PGRST301' ||
    rawMessage.includes('JWT') ||
    rawMessage.includes('invalid claim') ||
    rawMessage.includes('ERR_UNAUTHENTICATED') ||
    rawMessage.includes('Authentication required')
  ) {
    return new Error('Your session has expired. Please sign in again.');
  }

  // 3. PostgreSQL 23505: Unique constraint violation (case-insensitive duplicate name)
  if (code === '23505') {
    const quotedName = context?.name ? ` "${context.name}"` : '';
    if (context?.entityType === 'collection' || rawMessage.includes('idx_collections_user_lower_name')) {
      return new Error(`A collection named${quotedName} already exists.`);
    }
    if (context?.entityType === 'tag' || rawMessage.includes('idx_tags_user_lower_name')) {
      return new Error(`A tag named${quotedName} already exists.`);
    }
    return new Error(`An item with this name already exists.`);
  }

  // 4. PostgreSQL 23503: Foreign key violation
  if (code === '23503') {
    return new Error('Referenced collection or tag does not exist.');
  }

  // 5. Cross-account collision from save_bookmark_with_tags RPC
  if (rawMessage.includes('ERR_CROSS_ACCOUNT_COLLISION')) {
    return new Error('Bookmark ID belongs to another user or could not be updated.');
  }

  // 6. Input validation exceptions raised by RPC
  if (rawMessage.includes('ERR_INVALID_INPUT')) {
    const cleanMsg = rawMessage.replace(/^.*ERR_INVALID_INPUT:\s*/, '').trim();
    return new Error(cleanMsg || 'Invalid bookmark data provided.');
  }

  return new Error(rawMessage || 'An unexpected error occurred while communicating with Shelf cloud.');
}

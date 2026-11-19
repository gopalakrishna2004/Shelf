import { describe, it, expect } from 'vitest';
import { translateSupabaseError } from '../supabaseError';

describe('translateSupabaseError', () => {
  it('translates TypeError with fetch into network error message', () => {
    const error = new TypeError('Failed to fetch');
    const result = translateSupabaseError(error);
    expect(result.message).toBe(
      'Unable to connect to Shelf cloud. Please check your internet connection.'
    );
  });

  it('translates status: 0 or NetworkError into network error message', () => {
    const error = { status: 0, message: 'NetworkError when attempting to fetch resource' };
    const result = translateSupabaseError(error);
    expect(result.message).toBe(
      'Unable to connect to Shelf cloud. Please check your internet connection.'
    );
  });

  it('translates 401 and PGRST301 into session expired message', () => {
    const error401 = { status: 401, message: 'Invalid token' };
    expect(translateSupabaseError(error401).message).toBe(
      'Your session has expired. Please sign in again.'
    );

    const errorPGRST = { code: 'PGRST301', message: 'JWT expired' };
    expect(translateSupabaseError(errorPGRST).message).toBe(
      'Your session has expired. Please sign in again.'
    );
  });

  it('translates 23505 duplicate collection name', () => {
    const error = {
      code: '23505',
      message: 'duplicate key value violates unique constraint "idx_collections_user_lower_name"',
    };
    const result = translateSupabaseError(error, { entityType: 'collection', name: 'Reading List' });
    expect(result.message).toBe('A collection named "Reading List" already exists.');
  });

  it('translates 23505 duplicate tag name', () => {
    const error = {
      code: '23505',
      message: 'duplicate key value violates unique constraint "idx_tags_user_lower_name"',
    };
    const result = translateSupabaseError(error, { entityType: 'tag', name: 'react' });
    expect(result.message).toBe('A tag named "react" already exists.');
  });

  it('translates 23503 foreign key violation', () => {
    const error = {
      code: '23503',
      message: 'violates foreign key constraint fk_bookmarks_collection',
    };
    const result = translateSupabaseError(error);
    expect(result.message).toBe('Referenced collection or tag does not exist.');
  });

  it('translates ERR_CROSS_ACCOUNT_COLLISION', () => {
    const error = {
      message: 'ERR_CROSS_ACCOUNT_COLLISION: Bookmark ID belongs to another user or could not be updated',
    };
    const result = translateSupabaseError(error);
    expect(result.message).toBe('Bookmark ID belongs to another user or could not be updated.');
  });

  it('translates ERR_INVALID_INPUT', () => {
    const error = {
      message: 'ERR_INVALID_INPUT: Bookmark title is required',
    };
    const result = translateSupabaseError(error);
    expect(result.message).toBe('Bookmark title is required');
  });

  it('falls back to error.message or default error message', () => {
    const custom = { message: 'Some specific database error' };
    expect(translateSupabaseError(custom).message).toBe('Some specific database error');

    expect(translateSupabaseError(null).message).toBe('An unexpected database error occurred.');
  });
});

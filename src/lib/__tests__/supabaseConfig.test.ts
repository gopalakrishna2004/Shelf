import { describe, it, expect } from 'vitest';
import { validateSupabaseConfig, getSupabaseProjectRef } from '../supabase';

describe('Supabase Environment Configuration & Placeholder Validation', () => {
  it('validates genuine active Supabase credentials successfully', () => {
    const res = validateSupabaseConfig(
      'https://sample-project-id.supabase.co',
      'sbp_active_valid_anon_key_12345'
    );
    expect(res.isValid).toBe(true);
    expect(res.missingKeys).toHaveLength(0);
    expect(res.error).toBeUndefined();
  });

  it('rejects missing or empty URL and key', () => {
    const res = validateSupabaseConfig('', '');
    expect(res.isValid).toBe(false);
    expect(res.missingKeys).toContain('VITE_SUPABASE_URL');
    expect(res.missingKeys).toContain('VITE_SUPABASE_PUBLISHABLE_KEY');
    expect(res.error).toContain('Missing required Supabase configuration');
  });

  it('rejects malformed URLs that cannot be parsed', () => {
    const res = validateSupabaseConfig('not-a-valid-url', 'valid_anon_key');
    expect(res.isValid).toBe(false);
    expect(res.error).toContain('It must be a valid HTTP or HTTPS URL');
  });

  it('rejects placeholder URL from .env.example (your-project-ref)', () => {
    const res = validateSupabaseConfig(
      'https://your-project-ref.supabase.co',
      'sbp_active_valid_anon_key_12345'
    );
    expect(res.isValid).toBe(false);
    expect(res.error).toContain('contains placeholder values');
  });

  it('rejects placeholder key from .env.example (your-supabase-publishable-key)', () => {
    const res = validateSupabaseConfig(
      'https://sample-project-id.supabase.co',
      'your-supabase-publishable-key'
    );
    expect(res.isValid).toBe(false);
    expect(res.error).toContain('contains placeholder values');
  });

  it('rejects bracketed placeholder keys (<your-key>)', () => {
    const res = validateSupabaseConfig(
      'https://sample-project-id.supabase.co',
      '<your-supabase-anon-key>'
    );
    expect(res.isValid).toBe(false);
    expect(res.error).toContain('contains placeholder values');
  });

  it('correctly extracts project reference or falls back safely', () => {
    const ref = getSupabaseProjectRef();
    expect(typeof ref).toBe('string');
    expect(ref.length).toBeGreaterThan(0);
  });
});

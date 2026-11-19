import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export interface SupabaseConfigStatus {
  isValid: boolean;
  missingKeys: string[];
  error?: string;
}

/**
 * Validates Supabase environment variables according to Vite conventions.
 */
export function validateSupabaseConfig(
  url: string | undefined = supabaseUrl,
  key: string | undefined = supabasePublishableKey
): SupabaseConfigStatus {
  const missingKeys: string[] = [];

  if (!url || !url.trim()) {
    missingKeys.push('VITE_SUPABASE_URL');
  }
  if (!key || !key.trim()) {
    missingKeys.push('VITE_SUPABASE_PUBLISHABLE_KEY');
  }

  if (missingKeys.length > 0) {
    return {
      isValid: false,
      missingKeys,
      error: `Missing required Supabase configuration: ${missingKeys.join(', ')}. Please add them to your local .env file.`,
    };
  }

  try {
    new URL(url);
  } catch {
    return {
      isValid: false,
      missingKeys: [],
      error: `Invalid VITE_SUPABASE_URL: "${url}". It must be a valid HTTP or HTTPS URL.`,
    };
  }

  // Reject unreplaced placeholder values from .env.example
  const isPlaceholderUrl =
    url.includes('your-project') ||
    url.includes('<') ||
    url.includes('placeholder');
  const isPlaceholderKey =
    key.includes('your-supabase-publishable-key') ||
    key.includes('<') ||
    key.includes('placeholder');

  if (isPlaceholderUrl || isPlaceholderKey) {
    return {
      isValid: false,
      missingKeys: [],
      error: 'Supabase configuration contains placeholder values. Please replace them with active project credentials.',
    };
  }

  return {
    isValid: true,
    missingKeys: [],
  };
}

const configStatus = validateSupabaseConfig();

if (!configStatus.isValid) {
  // Produce a clear development warning/error
  console.warn(
    `[Shelf / Supabase] Configuration Notice: ${configStatus.error}\n` +
    `Ensure your local .env contains:\n` +
    `VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co\n` +
    `VITE_SUPABASE_PUBLISHABLE_KEY=<your-supabase-publishable-key>`
  );
}

// Singleton client instance
let clientInstance: SupabaseClient | null = null;

/**
 * Retrieves the shared Supabase client singleton.
 * Throws a descriptive error if environment variables are not yet configured.
 */
export function getSupabaseClient(): SupabaseClient {
  if (clientInstance) {
    return clientInstance;
  }

  const validation = validateSupabaseConfig();
  if (!validation.isValid) {
    throw new Error(
      `[Supabase Client Initialization Failed] ${validation.error}`
    );
  }

  clientInstance = createClient(supabaseUrl, supabasePublishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
    },
  });

  return clientInstance;
}

/**
 * Exported shared Supabase client instance.
 * Initialized if configuration is present, or null if awaiting environment variables.
 * Shares the exact same clientInstance as getSupabaseClient().
 */
export const supabase: SupabaseClient | null = configStatus.isValid
  ? getSupabaseClient()
  : null;

/**
 * Helper to check whether Supabase is configured with valid environment variables.
 */
export const isSupabaseConfigured = configStatus.isValid;

/**
 * Extracts the Supabase project reference identifier from the URL (e.g. 'your-project-ref').
 */
export function getSupabaseProjectRef(): string {
  if (!supabaseUrl) return 'project';
  try {
    const url = new URL(supabaseUrl);
    const hostParts = url.hostname.split('.');
    return hostParts[0] || 'project';
  } catch {
    return 'project';
  }
}

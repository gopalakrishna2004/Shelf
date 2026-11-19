import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User, Session, AuthError } from '@supabase/supabase-js';
import { getSupabaseClient, isSupabaseConfigured, getSupabaseProjectRef } from '../lib/supabase';
import { isGoogleAuthUser } from '../components/ui/Avatar';

/**
 * Purges only Shelf's specific Supabase project auth tokens, chunked sessions, and PKCE verifiers from localStorage.
 * Does NOT delete unrelated Supabase project sessions or unrelated application data.
 */
function purgeShelfAuthStorage(supabaseInstance?: any) {
  try {
    const projectRef = getSupabaseProjectRef();
    const projectPrefix = `sb-${projectRef}-`;
    const clientStorageKey = supabaseInstance?.auth?.storageKey;

    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (
        key &&
        (key.startsWith(projectPrefix) ||
          (clientStorageKey && key.startsWith(clientStorageKey)))
      ) {
        localStorage.removeItem(key);
      }
    }
    sessionStorage.removeItem('shelf_in_password_recovery');
  } catch {
    // Ignore storage exceptions
  }
}

export interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isPasswordRecovery: boolean;
  recoveryError: string | null;
  oauthError: string | null;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | Error | null }>;
  signUp: (email: string, password: string) => Promise<{
    data: { user: User | null; session: Session | null } | null;
    error: AuthError | Error | null;
  }>;
  signInWithGoogle: () => Promise<{ error: AuthError | Error | null }>;
  signOut: () => Promise<{ error: AuthError | Error | null }>;
  resetPasswordForEmail: (email: string) => Promise<{ error: AuthError | Error | null }>;
  updatePassword: (password: string) => Promise<{ error: AuthError | Error | null }>;
  updateProfile: (displayName: string) => Promise<{ error: AuthError | Error | null }>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ error: AuthError | Error | null }>;
  deleteAccount: () => Promise<{ error: Error | null }>;
  clearPasswordRecovery: () => void;
  clearOAuthError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState<boolean>(false);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [oauthError, setOauthError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setIsLoading(false);
      return;
    }

    const supabase = getSupabaseClient();
    let isInitialResolutionDone = false;

    const safetyTimeout = window.setTimeout(() => {
      if (!isInitialResolutionDone) {
        setIsLoading(false);
      }
    }, 7000);

    // 1. Inspect URL parameters for errors or recovery state
    const searchParams = new URLSearchParams(window.location.search);
    let urlErrorDesc = searchParams.get('error_description');
    let urlErrorCode = searchParams.get('error_code') || searchParams.get('error');

    if (!urlErrorDesc && window.location.hash) {
      const hashStr = window.location.hash.replace(/^#/, '');
      const hashParams = new URLSearchParams(
        hashStr.includes('?') ? hashStr.split('?')[1] : hashStr
      );
      urlErrorDesc = hashParams.get('error_description');
      urlErrorCode = hashParams.get('error_code') || hashParams.get('error');
    }

    if (urlErrorDesc || urlErrorCode) {
      const rawDesc = urlErrorDesc ? decodeURIComponent(urlErrorDesc.replace(/\+/g, ' ')) : '';
      const rawCode = (urlErrorCode || '').toLowerCase();

      // Check if error is specifically from an email recovery/OTP flow
      const isRecoveryError =
        rawCode === 'otp_expired' ||
        rawDesc.toLowerCase().includes('email link') ||
        rawDesc.toLowerCase().includes('otp') ||
        rawDesc.toLowerCase().includes('recovery');

      if (isRecoveryError) {
        setRecoveryError(
          rawDesc || 'The password reset link is invalid or has expired. Please request a fresh reset link.'
        );
      } else {
        // OAuth or general authentication callback error
        if (
          rawCode === 'access_denied' ||
          rawDesc.toLowerCase().includes('access_denied') ||
          rawDesc.toLowerCase().includes('user cancelled') ||
          rawDesc.toLowerCase().includes('cancelled')
        ) {
          setOauthError('Google sign-in was cancelled. Please try again or continue with email.');
        } else {
          setOauthError(
            rawDesc || 'Unable to authenticate with Google. Please try again or continue with email.'
          );
        }
      }

      try {
        window.history.replaceState({}, document.title, window.location.pathname);
      } catch {
        // Ignore
      }
    }

    // 2. Check for hash-stranded code (e.g., from older emails with /#reset-password?code=...)
    const hash = window.location.hash;
    const hashMatch = hash.match(/[?&#]code=([^&]+)/);
    const codeInSearch = searchParams.has('code');

    if (!codeInSearch && hashMatch) {
      const code = decodeURIComponent(hashMatch[1]);
      supabase.auth.exchangeCodeForSession(code).then(({ data, error }) => {
        if (error) {
          console.error('[Shelf Auth] Error exchanging hash recovery code:', error.message);
          setRecoveryError(error.message);
        } else if (data.session) {
          isInitialResolutionDone = true;
          window.clearTimeout(safetyTimeout);
          setSession(data.session);
          setUser(data.session.user);
          setIsPasswordRecovery(true);
          try {
            sessionStorage.setItem('shelf_in_password_recovery', '1');
          } catch {
            // Ignore
          }
        }
        try {
          window.history.replaceState({}, document.title, window.location.pathname);
        } catch {
          // Ignore
        }
      });
    }

    // 3. Restore existing session on initial load with a safety fallback timeout
    supabase.auth.getSession().then(({ data: { session: existingSession }, error }) => {
      if (isInitialResolutionDone) {
        return;
      }
      isInitialResolutionDone = true;
      window.clearTimeout(safetyTimeout);
      if (error) {
        console.error('[Shelf Auth] Error restoring session:', error.message);
      }
      setSession(existingSession);
      setUser(existingSession?.user ?? null);

      let inRecovery = false;
      try {
        inRecovery = sessionStorage.getItem('shelf_in_password_recovery') === '1';
      } catch {
        // Ignore
      }

      if (inRecovery && existingSession) {
        setIsPasswordRecovery(true);
      } else if (!existingSession) {
        setIsPasswordRecovery(false);
        try {
          sessionStorage.removeItem('shelf_in_password_recovery');
        } catch {
          // Ignore
        }
      }

      setIsLoading(false);
    }).catch(() => {
      if (isInitialResolutionDone) {
        return;
      }
      isInitialResolutionDone = true;
      window.clearTimeout(safetyTimeout);
      setIsLoading(false);
    });

    // 4. Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        isInitialResolutionDone = true;
        window.clearTimeout(safetyTimeout);
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        setIsLoading(false);

        // Clean query/hash parameters once code/tokens are exchanged to prevent double-exchange errors on refresh
        if (event === 'SIGNED_IN' || event === 'PASSWORD_RECOVERY') {
          try {
            const hasCodeInSearch = window.location.search.includes('code=');
            const hasAuthInHash =
              window.location.hash.includes('code=') ||
              window.location.hash.includes('access_token=') ||
              window.location.hash.includes('error=');
            if (hasCodeInSearch || hasAuthInHash) {
              const cleanHash =
                window.location.hash.startsWith('#') && !hasAuthInHash
                  ? window.location.hash
                  : '';
              window.history.replaceState(
                {},
                document.title,
                window.location.pathname + cleanHash
              );
            }
          } catch {
            // Ignore history state errors
          }
        }

        if (event === 'PASSWORD_RECOVERY') {
          setIsPasswordRecovery(true);
          setRecoveryError(null);
          try {
            sessionStorage.setItem('shelf_in_password_recovery', '1');
          } catch {
            // Ignore
          }
        } else if (event === 'SIGNED_OUT') {
          setIsPasswordRecovery(false);
          try {
            sessionStorage.removeItem('shelf_in_password_recovery');
          } catch {
            // Ignore
          }
        }
      }
    );

    return () => {
      window.clearTimeout(safetyTimeout);
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    if (!isSupabaseConfigured) {
      return { error: new Error('Supabase is not configured.') };
    }
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (!error) {
      setUser(data.user);
      setSession(data.session);
    }
    return { error };
  };

  const signUp = async (email: string, password: string) => {
    if (!isSupabaseConfigured) {
      return { data: null, error: new Error('Supabase is not configured.') };
    }
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: window.location.origin,
      },
    });
    return { data, error };
  };

  const signInWithGoogle = async () => {
    if (!isSupabaseConfigured) {
      return { error: new Error('Supabase is not configured.') };
    }
    setOauthError(null);
    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    });
    if (error) {
      setOauthError(error.message);
    }
    return { error };
  };

  const clearOAuthError = () => {
    setOauthError(null);
  };

  const signOut = async () => {
    if (!isSupabaseConfigured) {
      setUser(null);
      setSession(null);
      return { error: null };
    }
    const supabase = getSupabaseClient();
    let signOutError: AuthError | Error | null = null;
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        signOutError = error;
      }
    } catch (err: any) {
      signOutError = err;
    } finally {
      purgeShelfAuthStorage(supabase);
      setUser(null);
      setSession(null);
      setIsPasswordRecovery(false);
      setOauthError(null);
      try {
        if (window.location.hash) {
          window.location.hash = '';
        }
      } catch {
        // Ignore
      }
    }
    return { error: signOutError };
  };

  const resetPasswordForEmail = async (email: string) => {
    if (!isSupabaseConfigured) {
      return { error: new Error('Supabase is not configured.') };
    }
    const supabase = getSupabaseClient();
    // Redirect to clean origin URL without hash fragments so PKCE parameters (?code=...)
    // are attached to window.location.search where Supabase automatic detection handles them.
    const redirectUrl = window.location.origin;
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: redirectUrl,
    });
    return { error };
  };

  const updatePassword = async (password: string) => {
    if (!isSupabaseConfigured) {
      return { error: new Error('Supabase is not configured.') };
    }
    const supabase = getSupabaseClient();

    // Verify session explicitly before requesting update
    const {
      data: { session: currentSession },
    } = await supabase.auth.getSession();

    if (!currentSession) {
      return {
        error: new Error(
          'Auth session missing! Your password recovery session has expired or is invalid. Please request a fresh reset link.'
        ),
      };
    }

    const { error } = await supabase.auth.updateUser({
      password,
    });

    if (!error) {
      try {
        sessionStorage.removeItem('shelf_in_password_recovery');
      } catch {
        // Ignore
      }
      if (window.location.hash.includes('reset-password')) {
        window.location.hash = '';
      }
    }
    return { error };
  };

  const updateProfile = async (displayName: string) => {
    if (!isSupabaseConfigured) {
      return { error: new Error('Supabase is not configured.') };
    }
    const trimmed = displayName.trim();
    if (!trimmed) {
      return { error: new Error('Display name cannot be empty.') };
    }
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.auth.updateUser({
      data: {
        full_name: trimmed,
      },
    });
    if (!error && data.user) {
      setUser(data.user);
    }
    return { error };
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    if (!isSupabaseConfigured) {
      return { error: new Error('Supabase is not configured.') };
    }
    if (!user?.email) {
      return { error: new Error('No active user session detected.') };
    }
    if (isGoogleAuthUser(user)) {
      return {
        error: new Error(
          'This account signs in with Google OAuth. Passwords are managed directly via your Google Account.'
        ),
      };
    }
    if (!currentPassword) {
      return { error: new Error('Please enter your current password.') };
    }
    if (!newPassword || newPassword.length < 6) {
      return { error: new Error('New password must be at least 6 characters in length.') };
    }
    if (currentPassword === newPassword) {
      return { error: new Error('New password cannot be the same as your current password.') };
    }

    const supabase = getSupabaseClient();

    // Verify current password by attempting re-authentication
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });
    if (verifyError) {
      return {
        error: new Error('Current password is incorrect. Please verify your details.'),
      };
    }

    // Update password
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });
    return { error: updateError };
  };

  const deleteAccount = async () => {
    if (!isSupabaseConfigured) {
      return { error: new Error('Supabase is not configured.') };
    }
    const supabase = getSupabaseClient();

    // 1. Invoke server-side Supabase Edge Function to delete user
    const { error } = await supabase.functions.invoke('delete-account', {
      method: 'POST',
    });

    if (error) {
      // Preserve the user's active session if server deletion fails
      return { error };
    }

    // 2. Server deletion succeeded: guarantee complete local session cleanup
    try {
      // Clear GoTrueClient internal memory state & timers locally without remote network call
      await supabase.auth.signOut({ scope: 'local' });
    } catch (signOutErr) {
      console.warn('Local signOut encountered an error during account deletion cleanup:', signOutErr);
    } finally {
      // Purge only Shelf's specific Supabase project auth tokens, verifiers, and recovery state
      purgeShelfAuthStorage(supabase);

      // Reset all AuthContext state
      setUser(null);
      setSession(null);
      setIsPasswordRecovery(false);
      setOauthError(null);
    }

    return { error: null };
  };

  const clearPasswordRecovery = () => {
    setIsPasswordRecovery(false);
    setRecoveryError(null);
    try {
      sessionStorage.removeItem('shelf_in_password_recovery');
    } catch {
      // Ignore
    }
    if (
      window.location.hash.includes('reset-password') ||
      window.location.hash.includes('type=recovery')
    ) {
      window.location.hash = '';
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isLoading,
        isPasswordRecovery,
        recoveryError,
        oauthError,
        signIn,
        signUp,
        signInWithGoogle,
        signOut,
        resetPasswordForEmail,
        updatePassword,
        updateProfile,
        changePassword,
        deleteAccount,
        clearPasswordRecovery,
        clearOAuthError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

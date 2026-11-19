import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { User, Session, AuthChangeEvent } from '@supabase/supabase-js';

// Setup mutable mock for supabase client
let mockIsConfigured = true;
let authListenerCallback: ((event: AuthChangeEvent, session: Session | null) => void) | null = null;
const unsubscribeMock = vi.fn();

const mockAuthClient = {
  storageKey: 'sb-test-project-auth-token',
  getSession: vi.fn(),
  onAuthStateChange: vi.fn((cb) => {
    authListenerCallback = cb;
    return {
      data: {
        subscription: {
          unsubscribe: unsubscribeMock,
        },
      },
    };
  }),
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  signInWithOAuth: vi.fn(),
  signOut: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  updateUser: vi.fn(),
  exchangeCodeForSession: vi.fn(),
};

const mockFunctionsClient = {
  invoke: vi.fn(),
};

const mockSupabaseInstance = {
  auth: mockAuthClient,
  functions: mockFunctionsClient,
};

vi.mock('../../lib/supabase', () => ({
  getSupabaseClient: () => {
    if (!mockIsConfigured) {
      throw new Error('[Supabase Client Initialization Failed] Missing configuration');
    }
    return mockSupabaseInstance;
  },
  get isSupabaseConfigured() {
    return mockIsConfigured;
  },
  get isSupabaseConfiguredValue() {
    return mockIsConfigured;
  },
  getSupabaseProjectRef: () => 'test-project',
}));

// We need AuthContext to observe mockIsConfigured dynamically if tested, or mock modules
import { AuthProvider, useAuth, type AuthContextType } from '../AuthContext';

describe('AuthContext Lifecycle, Events & Contract Suite', () => {
  let container: HTMLDivElement;
  let root: Root;
  let contextValue: AuthContextType;

  const Consumer: React.FC = () => {
    contextValue = useAuth();
    return null;
  };

  const sampleUser: User = {
    id: 'user-shelf-42',
    app_metadata: { provider: 'email' },
    user_metadata: { full_name: 'Shelf Reader' },
    aud: 'authenticated',
    created_at: '2026-01-01T00:00:00Z',
    email: 'reader@shelf.test',
  } as unknown as User;

  const sampleSession: Session = {
    access_token: 'fake-access-token-xyz',
    token_type: 'bearer',
    expires_in: 3600,
    refresh_token: 'fake-refresh-token-xyz',
    user: sampleUser,
  };

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
    mockIsConfigured = true;
    authListenerCallback = null;
    window.location.hash = '';
    window.location.search = '';

    mockAuthClient.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });
    mockAuthClient.signInWithPassword.mockResolvedValue({
      data: { user: sampleUser, session: sampleSession },
      error: null,
    });
    mockAuthClient.signUp.mockResolvedValue({
      data: { user: sampleUser, session: sampleSession },
      error: null,
    });
    mockAuthClient.signInWithOAuth.mockResolvedValue({
      data: { provider: 'google', url: 'https://accounts.google.com' },
      error: null,
    });
    mockAuthClient.signOut.mockResolvedValue({ error: null });
    mockAuthClient.resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });
    mockAuthClient.updateUser.mockResolvedValue({
      data: { user: sampleUser },
      error: null,
    });
    mockAuthClient.exchangeCodeForSession.mockResolvedValue({
      data: { user: sampleUser, session: sampleSession },
      error: null,
    });
    mockFunctionsClient.invoke.mockResolvedValue({ data: { success: true }, error: null });

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  // =========================================================================
  // 1. Session Initialization
  // =========================================================================
  describe('1. Session Initialization', () => {
    it('initializes in loading state and resolves with null session when unauthenticated', async () => {
      let capturedInitialLoading = false;
      const LoadingDetector: React.FC = () => {
        const auth = useAuth();
        if (auth.isLoading) capturedInitialLoading = true;
        contextValue = auth;
        return null;
      };

      await act(async () => {
        root.render(
          <AuthProvider>
            <LoadingDetector />
          </AuthProvider>
        );
      });

      expect(capturedInitialLoading).toBe(true);
      expect(contextValue.isLoading).toBe(false);
      expect(contextValue.user).toBeNull();
      expect(contextValue.session).toBeNull();
      expect(mockAuthClient.getSession).toHaveBeenCalled();
    });

    it('successfully restores an existing active session on mount', async () => {
      mockAuthClient.getSession.mockResolvedValue({
        data: { session: sampleSession },
        error: null,
      });

      await act(async () => {
        root.render(
          <AuthProvider>
            <Consumer />
          </AuthProvider>
        );
      });

      expect(contextValue.isLoading).toBe(false);
      expect(contextValue.user).toEqual(sampleUser);
      expect(contextValue.session).toEqual(sampleSession);
      expect(contextValue.isPasswordRecovery).toBe(false);
    });

    it('gracefully handles getSession rejection and exits loading state', async () => {
      mockAuthClient.getSession.mockRejectedValue(new Error('Network offline'));

      await act(async () => {
        root.render(
          <AuthProvider>
            <Consumer />
          </AuthProvider>
        );
      });

      expect(contextValue.isLoading).toBe(false);
      expect(contextValue.user).toBeNull();
      expect(contextValue.session).toBeNull();
    });

    it('gracefully handles getSession error response and exits loading state', async () => {
      mockAuthClient.getSession.mockResolvedValue({
        data: { session: null },
        error: { message: 'Invalid refresh token' } as any,
      });

      await act(async () => {
        root.render(
          <AuthProvider>
            <Consumer />
          </AuthProvider>
        );
      });

      expect(contextValue.isLoading).toBe(false);
      expect(contextValue.user).toBeNull();
    });

    it('initialization: exits loading without attempting remote auth when Supabase is not configured', async () => {
      mockIsConfigured = false;

      await act(async () => {
        root.render(
          <AuthProvider>
            <Consumer />
          </AuthProvider>
        );
      });

      expect(contextValue.isLoading).toBe(false);
      expect(contextValue.user).toBeNull();
      expect(contextValue.session).toBeNull();
      expect(mockAuthClient.getSession).not.toHaveBeenCalled();
      expect(mockAuthClient.onAuthStateChange).not.toHaveBeenCalled();
    });

    it('operations: return configuration error when Supabase is not configured', async () => {
      mockIsConfigured = false;

      await act(async () => {
        root.render(
          <AuthProvider>
            <Consumer />
          </AuthProvider>
        );
      });

      let signInRes: any;
      let signUpRes: any;
      let googleRes: any;
      let signOutRes: any;
      let resetRes: any;
      let updatePassRes: any;
      let updateProfileRes: any;
      let changePassRes: any;
      let deleteRes: any;

      await act(async () => {
        signInRes = await contextValue.signIn('reader@shelf.test', 'pass');
        signUpRes = await contextValue.signUp('new@shelf.test', 'pass');
        googleRes = await contextValue.signInWithGoogle();
        signOutRes = await contextValue.signOut();
        resetRes = await contextValue.resetPasswordForEmail('reader@shelf.test');
        updatePassRes = await contextValue.updatePassword('newPass123');
        updateProfileRes = await contextValue.updateProfile('Arthur Dent');
        changePassRes = await contextValue.changePassword('old', 'newPass123');
        deleteRes = await contextValue.deleteAccount();
      });

      expect(signInRes.error?.message).toBe('Supabase is not configured.');
      expect(signUpRes.error?.message).toBe('Supabase is not configured.');
      expect(googleRes.error?.message).toBe('Supabase is not configured.');
      expect(signOutRes.error).toBeNull();
      expect(contextValue.user).toBeNull();
      expect(contextValue.session).toBeNull();
      expect(resetRes.error?.message).toBe('Supabase is not configured.');
      expect(updatePassRes.error?.message).toBe('Supabase is not configured.');
      expect(updateProfileRes.error?.message).toBe('Supabase is not configured.');
      expect(changePassRes.error?.message).toBe('Supabase is not configured.');
      expect(deleteRes.error?.message).toBe('Supabase is not configured.');
    });
  });

  // =========================================================================
  // 2. Authentication State Events (onAuthStateChange)
  // =========================================================================
  describe('2. Authentication State Events', () => {
    it('handles SIGNED_IN event by updating user and session', async () => {
      await act(async () => {
        root.render(
          <AuthProvider>
            <Consumer />
          </AuthProvider>
        );
      });

      expect(contextValue.user).toBeNull();

      act(() => {
        authListenerCallback?.('SIGNED_IN', sampleSession);
      });

      expect(contextValue.user).toEqual(sampleUser);
      expect(contextValue.session).toEqual(sampleSession);
      expect(contextValue.isLoading).toBe(false);
    });

    it('handles SIGNED_OUT event by clearing session, user, and recovery state', async () => {
      mockAuthClient.getSession.mockResolvedValue({
        data: { session: sampleSession },
        error: null,
      });
      sessionStorage.setItem('shelf_in_password_recovery', '1');

      await act(async () => {
        root.render(
          <AuthProvider>
            <Consumer />
          </AuthProvider>
        );
      });

      expect(contextValue.user).not.toBeNull();

      act(() => {
        authListenerCallback?.('SIGNED_OUT', null);
      });

      expect(contextValue.user).toBeNull();
      expect(contextValue.session).toBeNull();
      expect(contextValue.isPasswordRecovery).toBe(false);
      expect(sessionStorage.getItem('shelf_in_password_recovery')).toBeNull();
    });

    it('handles TOKEN_REFRESHED event by updating session and user', async () => {
      const refreshedUser = { ...sampleUser, email: 'updated@shelf.test' };
      const refreshedSession = { ...sampleSession, user: refreshedUser, access_token: 'new-token' };

      await act(async () => {
        root.render(
          <AuthProvider>
            <Consumer />
          </AuthProvider>
        );
      });

      act(() => {
        authListenerCallback?.('TOKEN_REFRESHED', refreshedSession);
      });

      expect(contextValue.user?.email).toBe('updated@shelf.test');
      expect(contextValue.session?.access_token).toBe('new-token');
    });

    it('handles PASSWORD_RECOVERY event and sets recovery mode', async () => {
      await act(async () => {
        root.render(
          <AuthProvider>
            <Consumer />
          </AuthProvider>
        );
      });

      expect(contextValue.isPasswordRecovery).toBe(false);

      act(() => {
        authListenerCallback?.('PASSWORD_RECOVERY', sampleSession);
      });

      expect(contextValue.isPasswordRecovery).toBe(true);
      expect(contextValue.recoveryError).toBeNull();
      expect(sessionStorage.getItem('shelf_in_password_recovery')).toBe('1');
    });

    it('handles repeated SIGNED_IN events idempotently without corrupting state', async () => {
      await act(async () => {
        root.render(
          <AuthProvider>
            <Consumer />
          </AuthProvider>
        );
      });

      act(() => {
        authListenerCallback?.('SIGNED_IN', sampleSession);
      });
      expect(contextValue.user).toEqual(sampleUser);
      expect(contextValue.session).toEqual(sampleSession);

      // Dispatch duplicate SIGNED_IN event
      act(() => {
        authListenerCallback?.('SIGNED_IN', sampleSession);
      });
      expect(contextValue.user).toEqual(sampleUser);
      expect(contextValue.session).toEqual(sampleSession);
      expect(contextValue.isLoading).toBe(false);
    });

    it('handles repeated TOKEN_REFRESHED events sequentially', async () => {
      await act(async () => {
        root.render(
          <AuthProvider>
            <Consumer />
          </AuthProvider>
        );
      });

      const token1Session = { ...sampleSession, access_token: 'token-v1' };
      act(() => {
        authListenerCallback?.('TOKEN_REFRESHED', token1Session);
      });
      expect(contextValue.session?.access_token).toBe('token-v1');

      const token2Session = { ...sampleSession, access_token: 'token-v2' };
      act(() => {
        authListenerCallback?.('TOKEN_REFRESHED', token2Session);
      });
      expect(contextValue.session?.access_token).toBe('token-v2');
      expect(contextValue.isLoading).toBe(false);
    });

    it('handles unexpected or unsupported auth events gracefully without corrupting session', async () => {
      mockAuthClient.getSession.mockResolvedValue({
        data: { session: sampleSession },
        error: null,
      });

      await act(async () => {
        root.render(
          <AuthProvider>
            <Consumer />
          </AuthProvider>
        );
      });

      expect(contextValue.user).toEqual(sampleUser);

      // 1. Unsupported arbitrary string event
      act(() => {
        authListenerCallback?.('UNKNOWN_CUSTOM_EVENT' as any, sampleSession);
      });
      expect(contextValue.user).toEqual(sampleUser);
      expect(contextValue.session).toEqual(sampleSession);
      expect(contextValue.isPasswordRecovery).toBe(false);

      // 2. USER_UPDATED event with updated user metadata
      const updatedUser = { ...sampleUser, user_metadata: { full_name: 'Updated Name' } };
      const updatedSession = { ...sampleSession, user: updatedUser };
      act(() => {
        authListenerCallback?.('USER_UPDATED' as any, updatedSession);
      });
      expect(contextValue.user?.user_metadata.full_name).toBe('Updated Name');
      expect(contextValue.isPasswordRecovery).toBe(false);
    });

    it('preserves newer auth event when getSession resolves later with stale or null session', async () => {
      let resolveGetSession!: (val: any) => void;
      const deferredGetSession = new Promise((resolve) => {
        resolveGetSession = resolve;
      });
      mockAuthClient.getSession.mockReturnValue(deferredGetSession);

      await act(async () => {
        root.render(
          <AuthProvider>
            <Consumer />
          </AuthProvider>
        );
      });

      expect(contextValue.isLoading).toBe(true);

      // Newer auth event arrives while getSession is still pending
      act(() => {
        authListenerCallback?.('SIGNED_IN', sampleSession);
      });

      expect(contextValue.user).toEqual(sampleUser);
      expect(contextValue.session).toEqual(sampleSession);
      expect(contextValue.isLoading).toBe(false);

      // getSession resolves later with stale null session
      await act(async () => {
        resolveGetSession({ data: { session: null }, error: null });
        await Promise.resolve();
      });

      // Newer session must NOT be overwritten by stale null initialization
      expect(contextValue.user).toEqual(sampleUser);
      expect(contextValue.session).toEqual(sampleSession);
    });

    it('cleans up onAuthStateChange subscription when unmounted', async () => {
      await act(async () => {
        root.render(
          <AuthProvider>
            <Consumer />
          </AuthProvider>
        );
      });

      expect(unsubscribeMock).not.toHaveBeenCalled();

      act(() => {
        root.unmount();
      });

      expect(unsubscribeMock).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 3. Password Recovery & URL Error Lifecycle
  // =========================================================================
  describe('3. Password Recovery & URL Lifecycle', () => {
    it('extracts recovery error from search parameters (e.g. otp_expired)', async () => {
      window.location.search = '?error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired';

      await act(async () => {
        root.render(
          <AuthProvider>
            <Consumer />
          </AuthProvider>
        );
      });

      expect(contextValue.recoveryError).toContain('Email link is invalid or has expired');
    });

    it('extracts oauth error from URL when sign-in is cancelled', async () => {
      window.location.search = '?error=access_denied&error_description=user+cancelled+login';

      await act(async () => {
        root.render(
          <AuthProvider>
            <Consumer />
          </AuthProvider>
        );
      });

      expect(contextValue.oauthError).toBe('Google sign-in was cancelled. Please try again or continue with email.');
    });

    it('exchanges code found in URL hash and enters password recovery mode', async () => {
      window.location.hash = '#reset-password?code=valid-recovery-code-123';
      mockAuthClient.getSession.mockResolvedValue({
        data: { session: sampleSession },
        error: null,
      });

      await act(async () => {
        root.render(
          <AuthProvider>
            <Consumer />
          </AuthProvider>
        );
      });
      await act(async () => {
        await Promise.resolve();
      });

      expect(mockAuthClient.exchangeCodeForSession).toHaveBeenCalledWith('valid-recovery-code-123');
      expect(contextValue.isPasswordRecovery).toBe(true);
      expect(contextValue.user).toEqual(sampleUser);
    });

    it('handles hash code exchange error and captures error message', async () => {
      window.location.hash = '#reset-password?code=bad-code';
      mockAuthClient.exchangeCodeForSession.mockResolvedValue({
        data: { session: null },
        error: { message: 'Code has expired' },
      });

      await act(async () => {
        root.render(
          <AuthProvider>
            <Consumer />
          </AuthProvider>
        );
      });

      expect(contextValue.recoveryError).toBe('Code has expired');
      expect(contextValue.isPasswordRecovery).toBe(false);
    });

    it('recovery race: exchangeCodeForSession resolves before getSession without being overwritten by null session', async () => {
      window.location.hash = '#reset-password?code=rec-code-order-1';

      let resolveExchange!: (val: any) => void;
      let resolveGetSession!: (val: any) => void;

      mockAuthClient.exchangeCodeForSession.mockReturnValue(
        new Promise((resolve) => {
          resolveExchange = resolve;
        })
      );
      mockAuthClient.getSession.mockReturnValue(
        new Promise((resolve) => {
          resolveGetSession = resolve;
        })
      );

      await act(async () => {
        root.render(
          <AuthProvider>
            <Consumer />
          </AuthProvider>
        );
      });

      // 1. exchangeCodeForSession resolves first with valid recovery session
      await act(async () => {
        resolveExchange({
          data: { user: sampleUser, session: sampleSession },
          error: null,
        });
        await Promise.resolve();
      });

      expect(mockAuthClient.exchangeCodeForSession).toHaveBeenCalledWith('rec-code-order-1');
      expect(contextValue.isPasswordRecovery).toBe(true);
      expect(contextValue.user).toEqual(sampleUser);
      expect(sessionStorage.getItem('shelf_in_password_recovery')).toBe('1');

      // 2. getSession resolves later with null session
      await act(async () => {
        resolveGetSession({
          data: { session: null },
          error: null,
        });
        await Promise.resolve();
      });

      // Recovery session and recovery mode must remain intact
      expect(contextValue.isPasswordRecovery).toBe(true);
      expect(contextValue.user).toEqual(sampleUser);
      expect(contextValue.session).toEqual(sampleSession);
      expect(sessionStorage.getItem('shelf_in_password_recovery')).toBe('1');
    });

    it('recovery race: getSession returns null while exchangeCodeForSession is pending, then exchange succeeds', async () => {
      window.location.hash = '#reset-password?code=rec-code-order-2';

      let resolveExchange!: (val: any) => void;
      let resolveGetSession!: (val: any) => void;

      mockAuthClient.exchangeCodeForSession.mockReturnValue(
        new Promise((resolve) => {
          resolveExchange = resolve;
        })
      );
      mockAuthClient.getSession.mockReturnValue(
        new Promise((resolve) => {
          resolveGetSession = resolve;
        })
      );

      await act(async () => {
        root.render(
          <AuthProvider>
            <Consumer />
          </AuthProvider>
        );
      });

      // 1. getSession resolves first with null session
      await act(async () => {
        resolveGetSession({
          data: { session: null },
          error: null,
        });
        await Promise.resolve();
      });

      // 2. exchangeCodeForSession resolves second with valid recovery session
      await act(async () => {
        resolveExchange({
          data: { user: sampleUser, session: sampleSession },
          error: null,
        });
        await Promise.resolve();
      });

      expect(contextValue.isPasswordRecovery).toBe(true);
      expect(contextValue.user).toEqual(sampleUser);
      expect(contextValue.session).toEqual(sampleSession);
      expect(sessionStorage.getItem('shelf_in_password_recovery')).toBe('1');
    });

    it('clearPasswordRecovery clears state, sessionStorage, and reset-password hash', async () => {
      window.location.hash = '#reset-password';
      sessionStorage.setItem('shelf_in_password_recovery', '1');

      await act(async () => {
        root.render(
          <AuthProvider>
            <Consumer />
          </AuthProvider>
        );
      });

      act(() => {
        authListenerCallback?.('PASSWORD_RECOVERY', sampleSession);
      });

      expect(contextValue.isPasswordRecovery).toBe(true);

      act(() => {
        contextValue.clearPasswordRecovery();
      });

      expect(contextValue.isPasswordRecovery).toBe(false);
      expect(contextValue.recoveryError).toBeNull();
      expect(sessionStorage.getItem('shelf_in_password_recovery')).toBeNull();
      expect(window.location.hash).toBe('');
    });
  });

  // =========================================================================
  // 4. Authentication Operations
  // =========================================================================
  describe('4. Authentication Operations', () => {
    it('signIn: calls signInWithPassword with trimmed email and sets session', async () => {
      await act(async () => {
        root.render(
          <AuthProvider>
            <Consumer />
          </AuthProvider>
        );
      });

      let res: any;
      await act(async () => {
        res = await contextValue.signIn('  reader@shelf.test  ', 'secret123');
      });

      expect(mockAuthClient.signInWithPassword).toHaveBeenCalledWith({
        email: 'reader@shelf.test',
        password: 'secret123',
      });
      expect(res.error).toBeNull();
      expect(contextValue.user).toEqual(sampleUser);
      expect(contextValue.session).toEqual(sampleSession);
    });

    it('signIn: returns error without setting user when credentials fail', async () => {
      mockAuthClient.signInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Invalid login credentials' },
      });

      await act(async () => {
        root.render(
          <AuthProvider>
            <Consumer />
          </AuthProvider>
        );
      });

      let res: any;
      await act(async () => {
        res = await contextValue.signIn('reader@shelf.test', 'wrong');
      });

      expect(res.error?.message).toBe('Invalid login credentials');
      expect(contextValue.user).toBeNull();
    });

    it('signUp: calls signUp with email, password, and redirect URL', async () => {
      await act(async () => {
        root.render(
          <AuthProvider>
            <Consumer />
          </AuthProvider>
        );
      });

      let res: any;
      await act(async () => {
        res = await contextValue.signUp('new@shelf.test', 'newpass123');
      });

      expect(mockAuthClient.signUp).toHaveBeenCalledWith({
        email: 'new@shelf.test',
        password: 'newpass123',
        options: { emailRedirectTo: window.location.origin },
      });
      expect(res.error).toBeNull();
      expect(res.data?.user).toEqual(sampleUser);
    });

    it('signUp: returns error when registration fails', async () => {
      mockAuthClient.signUp.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'User already registered' },
      });

      await act(async () => {
        root.render(
          <AuthProvider>
            <Consumer />
          </AuthProvider>
        );
      });

      let res: any;
      await act(async () => {
        res = await contextValue.signUp('existing@shelf.test', 'pass');
      });

      expect(res.error?.message).toBe('User already registered');
    });

    it('signInWithGoogle: calls signInWithOAuth with google provider and records oauth error on failure', async () => {
      await act(async () => {
        root.render(
          <AuthProvider>
            <Consumer />
          </AuthProvider>
        );
      });

      mockAuthClient.signInWithOAuth.mockResolvedValueOnce({
        data: null,
        error: { message: 'OAuth pop-up blocked' },
      });

      let res: any;
      await act(async () => {
        res = await contextValue.signInWithGoogle();
      });

      expect(mockAuthClient.signInWithOAuth).toHaveBeenCalledWith({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      });
      expect(res.error?.message).toBe('OAuth pop-up blocked');
      expect(contextValue.oauthError).toBe('OAuth pop-up blocked');

      act(() => {
        contextValue.clearOAuthError();
      });
      expect(contextValue.oauthError).toBeNull();
    });

    it('signOut: signs out, purges localStorage project keys, and resets state', async () => {
      mockAuthClient.getSession.mockResolvedValue({
        data: { session: sampleSession },
        error: null,
      });
      localStorage.setItem('sb-test-project-token', 'xyz');
      localStorage.setItem('unrelated-storage-key', 'keep-me');
      sessionStorage.setItem('shelf_in_password_recovery', '1');

      await act(async () => {
        root.render(
          <AuthProvider>
            <Consumer />
          </AuthProvider>
        );
      });

      expect(contextValue.user).not.toBeNull();

      let res: any;
      await act(async () => {
        res = await contextValue.signOut();
      });

      expect(mockAuthClient.signOut).toHaveBeenCalled();
      expect(res.error).toBeNull();
      expect(contextValue.user).toBeNull();
      expect(contextValue.session).toBeNull();
      expect(localStorage.getItem('sb-test-project-token')).toBeNull();
      expect(localStorage.getItem('unrelated-storage-key')).toBe('keep-me');
      expect(sessionStorage.getItem('shelf_in_password_recovery')).toBeNull();
    });

    it('signOut: purges local state even when remote signOut throws', async () => {
      mockAuthClient.signOut.mockRejectedValueOnce(new Error('Remote server down'));
      localStorage.setItem('sb-test-project-auth-token', 'token');

      await act(async () => {
        root.render(
          <AuthProvider>
            <Consumer />
          </AuthProvider>
        );
      });

      let res: any;
      await act(async () => {
        res = await contextValue.signOut();
      });

      expect(res.error?.message).toBe('Remote server down');
      expect(contextValue.user).toBeNull();
      expect(localStorage.getItem('sb-test-project-auth-token')).toBeNull();
    });

    it('resetPasswordForEmail: calls resetPasswordForEmail with origin redirect', async () => {
      await act(async () => {
        root.render(
          <AuthProvider>
            <Consumer />
          </AuthProvider>
        );
      });

      let res: any;
      await act(async () => {
        res = await contextValue.resetPasswordForEmail('reader@shelf.test');
      });

      expect(mockAuthClient.resetPasswordForEmail).toHaveBeenCalledWith('reader@shelf.test', {
        redirectTo: window.location.origin,
      });
      expect(res.error).toBeNull();
    });

    it('updatePassword: fails if recovery session is missing', async () => {
      mockAuthClient.getSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      await act(async () => {
        root.render(
          <AuthProvider>
            <Consumer />
          </AuthProvider>
        );
      });

      let res: any;
      await act(async () => {
        res = await contextValue.updatePassword('newPassword123');
      });

      expect(res.error?.message).toContain('Auth session missing');
      expect(mockAuthClient.updateUser).not.toHaveBeenCalled();
    });

    it('updatePassword: succeeds when session is present and clears recovery flags', async () => {
      mockAuthClient.getSession.mockResolvedValue({
        data: { session: sampleSession },
        error: null,
      });
      sessionStorage.setItem('shelf_in_password_recovery', '1');

      await act(async () => {
        root.render(
          <AuthProvider>
            <Consumer />
          </AuthProvider>
        );
      });

      let res: any;
      await act(async () => {
        res = await contextValue.updatePassword('newSecurePassword123');
      });

      expect(mockAuthClient.updateUser).toHaveBeenCalledWith({
        password: 'newSecurePassword123',
      });
      expect(res.error).toBeNull();
      expect(sessionStorage.getItem('shelf_in_password_recovery')).toBeNull();
    });

    it('updateProfile: validates against empty name and updates full_name', async () => {
      mockAuthClient.getSession.mockResolvedValue({
        data: { session: sampleSession },
        error: null,
      });

      await act(async () => {
        root.render(
          <AuthProvider>
            <Consumer />
          </AuthProvider>
        );
      });

      // Empty display name validation
      let emptyRes: any;
      await act(async () => {
        emptyRes = await contextValue.updateProfile('   ');
      });
      expect(emptyRes.error?.message).toBe('Display name cannot be empty.');
      expect(mockAuthClient.updateUser).not.toHaveBeenCalled();

      // Valid display name
      const updatedUser = { ...sampleUser, user_metadata: { full_name: 'Arthur Dent' } };
      mockAuthClient.updateUser.mockResolvedValueOnce({
        data: { user: updatedUser },
        error: null,
      });

      let validRes: any;
      await act(async () => {
        validRes = await contextValue.updateProfile('Arthur Dent');
      });

      expect(mockAuthClient.updateUser).toHaveBeenCalledWith({
        data: { full_name: 'Arthur Dent' },
      });
      expect(validRes.error).toBeNull();
      expect(contextValue.user?.user_metadata.full_name).toBe('Arthur Dent');
    });

    it('changePassword: validates password length and current password mismatch', async () => {
      mockAuthClient.getSession.mockResolvedValue({
        data: { session: sampleSession },
        error: null,
      });

      await act(async () => {
        root.render(
          <AuthProvider>
            <Consumer />
          </AuthProvider>
        );
      });

      // Missing current password
      let res = await contextValue.changePassword('', 'newpassword123');
      expect(res.error?.message).toBe('Please enter your current password.');

      // Too short new password
      res = await contextValue.changePassword('oldpass123', 'short');
      expect(res.error?.message).toBe('New password must be at least 6 characters in length.');

      // New password identical to current password
      res = await contextValue.changePassword('samepass123', 'samepass123');
      expect(res.error?.message).toBe('New password cannot be the same as your current password.');

      // Correct verification and update
      mockAuthClient.signInWithPassword.mockResolvedValueOnce({
        data: { user: sampleUser, session: sampleSession },
        error: null,
      });
      mockAuthClient.updateUser.mockResolvedValueOnce({
        data: { user: sampleUser },
        error: null,
      });

      res = await contextValue.changePassword('oldpass123', 'newpass123');
      expect(res.error).toBeNull();
      expect(mockAuthClient.signInWithPassword).toHaveBeenCalledWith({
        email: 'reader@shelf.test',
        password: 'oldpass123',
      });
      expect(mockAuthClient.updateUser).toHaveBeenCalledWith({
        password: 'newpass123',
      });
    });

    it('changePassword: rejects Google OAuth users with explanation', async () => {
      const googleUser: User = {
        ...sampleUser,
        app_metadata: { provider: 'google' },
      } as unknown as User;

      mockAuthClient.getSession.mockResolvedValue({
        data: { session: { ...sampleSession, user: googleUser } },
        error: null,
      });

      await act(async () => {
        root.render(
          <AuthProvider>
            <Consumer />
          </AuthProvider>
        );
      });

      const res = await contextValue.changePassword('current', 'newpass123');
      expect(res.error?.message).toContain('This account signs in with Google OAuth');
    });

    it('deleteAccount: invokes edge function and calls local signOut on success', async () => {
      mockAuthClient.getSession.mockResolvedValue({
        data: { session: sampleSession },
        error: null,
      });

      await act(async () => {
        root.render(
          <AuthProvider>
            <Consumer />
          </AuthProvider>
        );
      });

      let res: any;
      await act(async () => {
        res = await contextValue.deleteAccount();
      });

      expect(mockFunctionsClient.invoke).toHaveBeenCalledWith('delete-account', {
        method: 'POST',
      });
      expect(mockAuthClient.signOut).toHaveBeenCalledWith({ scope: 'local' });
      expect(res.error).toBeNull();
      expect(contextValue.user).toBeNull();
    });

    it('deleteAccount: preserves active session if server deletion fails', async () => {
      mockAuthClient.getSession.mockResolvedValue({
        data: { session: sampleSession },
        error: null,
      });
      mockFunctionsClient.invoke.mockResolvedValueOnce({
        data: null,
        error: new Error('Server deletion failed'),
      });

      await act(async () => {
        root.render(
          <AuthProvider>
            <Consumer />
          </AuthProvider>
        );
      });

      let res: any;
      await act(async () => {
        res = await contextValue.deleteAccount();
      });

      expect(res.error?.message).toBe('Server deletion failed');
      expect(mockAuthClient.signOut).not.toHaveBeenCalled();
      expect(contextValue.user).not.toBeNull();
    });
  });
});

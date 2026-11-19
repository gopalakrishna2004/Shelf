import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AuthPage } from '../AuthPage';
import type { Session } from '@supabase/supabase-js';

// Mutable mock auth functions
let mockSession: Session | null = null;
let mockRecoveryError: string | null = null;
let mockOAuthError: string | null = null;

const mockSignIn = vi.fn();
const mockSignUp = vi.fn();
const mockSignInWithGoogle = vi.fn();
const mockResetPasswordForEmail = vi.fn();
const mockUpdatePassword = vi.fn();
const mockClearPasswordRecovery = vi.fn();
const mockClearOAuthError = vi.fn();
const mockSignOut = vi.fn();

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: mockSession?.user ?? null,
    session: mockSession,
    isLoading: false,
    isPasswordRecovery: false,
    recoveryError: mockRecoveryError,
    oauthError: mockOAuthError,
    signIn: mockSignIn,
    signUp: mockSignUp,
    signInWithGoogle: mockSignInWithGoogle,
    resetPasswordForEmail: mockResetPasswordForEmail,
    updatePassword: mockUpdatePassword,
    clearPasswordRecovery: mockClearPasswordRecovery,
    clearOAuthError: mockClearOAuthError,
    signOut: mockSignOut,
  }),
}));

describe('AuthPage Form Transitions, Validation & Submission Suite', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSession = null;
    mockRecoveryError = null;
    mockOAuthError = null;

    mockSignIn.mockResolvedValue({ error: null });
    mockSignUp.mockResolvedValue({ data: { user: { id: 'u1' }, session: null }, error: null });
    mockSignInWithGoogle.mockResolvedValue({ error: null });
    mockResetPasswordForEmail.mockResolvedValue({ error: null });
    mockUpdatePassword.mockResolvedValue({ error: null });
    mockSignOut.mockResolvedValue({ error: null });

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

  // Helper to change input value and fire change event
  const changeInput = (input: HTMLInputElement, value: string) => {
    (input as any).value = value;
    const propsKey = Object.keys(input).find((k) => k.startsWith('__reactProps$'));
    if (propsKey && (input as any)[propsKey]?.onChange) {
      (input as any)[propsKey].onChange({
        target: input,
        currentTarget: input,
        preventDefault: () => {},
        stopPropagation: () => {},
        persist: () => {},
      });
    } else {
      const inputEv = new Event('input', { bubbles: true });
      Object.defineProperty(inputEv, 'target', { value: input, configurable: true });
      input.dispatchEvent(inputEv);

      const changeEv = new Event('change', { bubbles: true });
      Object.defineProperty(changeEv, 'target', { value: input, configurable: true });
      input.dispatchEvent(changeEv);
    }
  };

  // Helper to submit a form
  const submitForm = (form: HTMLFormElement) => {
    const propsKey = Object.keys(form).find((k) => k.startsWith('__reactProps$'));
    if (propsKey && (form as any)[propsKey]?.onSubmit) {
      (form as any)[propsKey].onSubmit({
        preventDefault: () => {},
        stopPropagation: () => {},
        target: form,
        currentTarget: form,
        persist: () => {},
      });
    } else {
      const ev = new Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(ev);
    }
  };

  // =========================================================================
  // 1. Form Transitions & Initial Views
  // =========================================================================
  describe('1. Form Transitions', () => {
    it('renders login view by default with email and password fields', () => {
      act(() => {
        root.render(<AuthPage theme="light" onThemeChange={vi.fn()} />);
      });

      expect(container.textContent).toContain('Sign in to');
      expect(container.textContent).toContain('Shelf');
      expect(container.textContent).toContain('Email Address');
      expect(container.textContent).toContain('Password');
      expect(container.textContent).not.toContain('Confirm Password');

      // Submit button text
      const submitBtn = container.querySelector('button[type="submit"]');
      expect(submitBtn?.textContent).toContain('Sign In');
    });

    it('transitions to register view when clicking create account button', () => {
      act(() => {
        root.render(<AuthPage theme="light" onThemeChange={vi.fn()} />);
      });

      // Find "Create an account" switch button
      const switchBtn = Array.from(container.querySelectorAll('button')).find(
        (b) => b.textContent?.includes('Create an account')
      );
      expect(switchBtn).toBeDefined();

      act(() => {
        switchBtn?.click();
      });

      expect(container.textContent).toContain('Create an account');
      expect(container.textContent).toContain('Confirm Password');

      const submitBtn = container.querySelector('button[type="submit"]');
      expect(submitBtn?.textContent).toContain('Create Account');
    });

    it('transitions to forgot-password view when clicking forgot password link', () => {
      act(() => {
        root.render(<AuthPage theme="light" onThemeChange={vi.fn()} />);
      });

      const forgotBtn = Array.from(container.querySelectorAll('button')).find(
        (b) => b.textContent?.includes('Forgot password?')
      );
      expect(forgotBtn).toBeDefined();

      act(() => {
        forgotBtn?.click();
      });

      expect(container.textContent).toContain('Reset password');
      expect(container.textContent).toContain('Send Reset Instructions');
      // Password field should not be present in forgot-password view
      expect(container.textContent).not.toContain('Confirm password');
    });

    it('returns to login view from forgot-password view', () => {
      act(() => {
        root.render(<AuthPage initialMode="forgot-password" theme="light" onThemeChange={vi.fn()} />);
      });

      expect(container.textContent).toContain('Reset password');

      const backBtn = Array.from(container.querySelectorAll('button')).find(
        (b) => b.textContent?.toLowerCase().includes('back to sign in')
      );
      expect(backBtn).toBeDefined();

      act(() => {
        backBtn?.click();
      });

      expect(container.textContent).toContain('Sign in to');
    });

    it('renders reset-password view with required new password fields', () => {
      mockSession = {
        access_token: 'fake-token',
        refresh_token: 'fake-refresh',
        expires_in: 3600,
        token_type: 'bearer',
        user: { id: 'u-rec', email: 'test@example.com' } as any,
      } as Session;

      act(() => {
        root.render(<AuthPage initialMode="reset-password" theme="light" onThemeChange={vi.fn()} />);
      });

      expect(container.textContent).toContain('Set new password');
      expect(container.textContent).toContain('New Password');
      expect(container.textContent).toContain('Confirm New Password');

      const submitBtn = container.querySelector('button[type="submit"]');
      expect(submitBtn?.textContent).toContain('Update Password');
    });
  });

  // =========================================================================
  // 2. Input Validation
  // =========================================================================
  describe('2. Input Validation', () => {
    it('login: validates that both email and password are provided', () => {
      act(() => {
        root.render(<AuthPage initialMode="login" theme="light" onThemeChange={vi.fn()} />);
      });

      const form = container.querySelector('form')!;
      act(() => {
        submitForm(form);
      });

      expect(container.textContent).toContain('Please provide both email and password.');
      expect(mockSignIn).not.toHaveBeenCalled();
    });

    it('register: validates that both email and password are provided', () => {
      act(() => {
        root.render(<AuthPage initialMode="register" theme="light" onThemeChange={vi.fn()} />);
      });

      const form = container.querySelector('form')!;
      act(() => {
        submitForm(form);
      });

      expect(container.textContent).toContain('Please provide both email and password.');
      expect(mockSignUp).not.toHaveBeenCalled();
    });

    it('register: validates that password is at least 6 characters in length', () => {
      act(() => {
        root.render(<AuthPage initialMode="register" theme="light" onThemeChange={vi.fn()} />);
      });

      const inputs = container.querySelectorAll('input');
      const emailInput = inputs[0] as HTMLInputElement;
      const passInput = inputs[1] as HTMLInputElement;
      const confirmInput = inputs[2] as HTMLInputElement;

      act(() => {
        changeInput(emailInput, 'new@shelf.test');
        changeInput(passInput, '12345');
        changeInput(confirmInput, '12345');
      });

      const form = container.querySelector('form')!;
      act(() => {
        submitForm(form);
      });

      expect(container.textContent).toContain('Password must be at least 6 characters in length.');
      expect(mockSignUp).not.toHaveBeenCalled();
    });

    it('register: validates that password and confirmPassword match', () => {
      act(() => {
        root.render(<AuthPage initialMode="register" theme="light" onThemeChange={vi.fn()} />);
      });

      const inputs = container.querySelectorAll('input');
      const emailInput = inputs[0] as HTMLInputElement;
      const passInput = inputs[1] as HTMLInputElement;
      const confirmInput = inputs[2] as HTMLInputElement;

      act(() => {
        changeInput(emailInput, 'new@shelf.test');
        changeInput(passInput, 'password123');
        changeInput(confirmInput, 'differentpass');
      });

      const form = container.querySelector('form')!;
      act(() => {
        submitForm(form);
      });

      expect(container.textContent).toContain('Passwords do not match.');
      expect(mockSignUp).not.toHaveBeenCalled();
    });

    it('forgot-password: validates that email address is provided', () => {
      act(() => {
        root.render(<AuthPage initialMode="forgot-password" theme="light" onThemeChange={vi.fn()} />);
      });

      const form = container.querySelector('form')!;
      act(() => {
        submitForm(form);
      });

      expect(container.textContent).toContain('Please enter your account email address.');
      expect(mockResetPasswordForEmail).not.toHaveBeenCalled();
    });

    it('reset-password: validates password presence, length, and confirmation match', () => {
      mockSession = { user: { id: 'u-rec' } } as any;

      act(() => {
        root.render(<AuthPage initialMode="reset-password" theme="light" onThemeChange={vi.fn()} />);
      });

      const inputs = container.querySelectorAll('input');
      const passInput = inputs[0] as HTMLInputElement;
      const confirmInput = inputs[1] as HTMLInputElement;
      const form = container.querySelector('form')!;

      // 1. Empty password
      act(() => {
        submitForm(form);
      });
      expect(container.textContent).toContain('Please enter a new password.');

      // 2. Length < 6
      act(() => {
        changeInput(passInput, '123');
        changeInput(confirmInput, '123');
      });
      act(() => {
        submitForm(form);
      });
      expect(container.textContent).toContain('New password must be at least 6 characters in length.');

      // 3. Mismatch
      act(() => {
        changeInput(passInput, 'validPass1');
        changeInput(confirmInput, 'differentPass2');
      });
      act(() => {
        submitForm(form);
      });
      expect(container.textContent).toContain('Passwords do not match.');
      expect(mockUpdatePassword).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 3. Submission Behaviour & User Feedback
  // =========================================================================
  describe('3. Submission Behaviour & Feedback', () => {
    it('login: invokes signIn on valid input and displays error on failure', async () => {
      mockSignIn.mockResolvedValueOnce({
        error: { message: 'Invalid credentials provided' },
      });

      act(() => {
        root.render(<AuthPage initialMode="login" theme="light" onThemeChange={vi.fn()} />);
      });

      const inputs = container.querySelectorAll('input');
      const emailInput = inputs[0] as HTMLInputElement;
      const passInput = inputs[1] as HTMLInputElement;

      act(() => {
        changeInput(emailInput, 'reader@shelf.test');
        changeInput(passInput, 'secret123');
      });

      const form = container.querySelector('form')!;
      await act(async () => {
        submitForm(form);
      });

      expect(mockSignIn).toHaveBeenCalledWith('reader@shelf.test', 'secret123');
      expect(container.textContent).toContain('Invalid credentials provided');
    });

    it('register: transitions to confirmation-pending view on email verification requirement', async () => {
      mockSignUp.mockResolvedValueOnce({
        data: { user: { id: 'new-user', email: 'pending@shelf.test' }, session: null },
        error: null,
      });

      act(() => {
        root.render(<AuthPage initialMode="register" theme="light" onThemeChange={vi.fn()} />);
      });

      const inputs = container.querySelectorAll('input');
      act(() => {
        changeInput(inputs[0] as HTMLInputElement, 'pending@shelf.test');
        changeInput(inputs[1] as HTMLInputElement, 'validpass123');
        changeInput(inputs[2] as HTMLInputElement, 'validpass123');
      });

      const form = container.querySelector('form')!;
      await act(async () => {
        submitForm(form);
      });

      expect(mockSignUp).toHaveBeenCalledWith('pending@shelf.test', 'validpass123');
      expect(container.textContent).toContain('Check your inbox');
      expect(container.textContent).toContain('pending@shelf.test');
    });

    it('forgot-password: calls resetPasswordForEmail and displays success notification', async () => {
      act(() => {
        root.render(<AuthPage initialMode="forgot-password" theme="light" onThemeChange={vi.fn()} />);
      });

      const emailInput = container.querySelector('input') as HTMLInputElement;
      act(() => {
        changeInput(emailInput, 'recovery@shelf.test');
      });

      const form = container.querySelector('form')!;
      await act(async () => {
        submitForm(form);
      });

      expect(mockResetPasswordForEmail).toHaveBeenCalledWith('recovery@shelf.test');
      expect(container.textContent).toContain('a password reset link has been dispatched to your inbox');
    });

    it('google-auth: triggers signInWithGoogle when clicking Continue with Google', async () => {
      act(() => {
        root.render(<AuthPage initialMode="login" theme="light" onThemeChange={vi.fn()} />);
      });

      const googleBtn = Array.from(container.querySelectorAll('button')).find(
        (b) => b.textContent?.includes('Continue with Google')
      );
      expect(googleBtn).toBeDefined();

      await act(async () => {
        googleBtn?.click();
      });

      expect(mockSignInWithGoogle).toHaveBeenCalled();
    });

    it('login: shows pending loading state and disables submit button and inputs while request is in-flight', async () => {
      let resolveSignIn!: (val: any) => void;
      mockSignIn.mockReturnValue(
        new Promise((resolve) => {
          resolveSignIn = resolve;
        })
      );

      act(() => {
        root.render(<AuthPage initialMode="login" theme="light" onThemeChange={vi.fn()} />);
      });

      const inputs = container.querySelectorAll('input');
      const emailInput = inputs[0] as HTMLInputElement;
      const passInput = inputs[1] as HTMLInputElement;

      act(() => {
        changeInput(emailInput, 'reader@shelf.test');
        changeInput(passInput, 'secret123');
      });

      const form = container.querySelector('form')!;
      act(() => {
        submitForm(form);
      });

      const submitBtn = container.querySelector('button[type="submit"]');
      expect(submitBtn?.textContent).toContain('Signing In...');
      expect((submitBtn as any).disabled || submitBtn?.getAttribute('disabled')).toBeTruthy();
      expect((emailInput as any).disabled || emailInput.getAttribute('disabled')).toBeTruthy();
      expect((passInput as any).disabled || passInput.getAttribute('disabled')).toBeTruthy();

      await act(async () => {
        resolveSignIn({ error: null });
        await Promise.resolve();
      });

      expect(submitBtn?.textContent).toContain('Sign In');
    });

    it('register: shows pending loading state and disables submit button and inputs while request is in-flight', async () => {
      let resolveSignUp!: (val: any) => void;
      mockSignUp.mockReturnValue(
        new Promise((resolve) => {
          resolveSignUp = resolve;
        })
      );

      act(() => {
        root.render(<AuthPage initialMode="register" theme="light" onThemeChange={vi.fn()} />);
      });

      const inputs = container.querySelectorAll('input');
      const emailInput = inputs[0] as HTMLInputElement;
      const passInput = inputs[1] as HTMLInputElement;
      const confirmInput = inputs[2] as HTMLInputElement;

      act(() => {
        changeInput(emailInput, 'pending@shelf.test');
        changeInput(passInput, 'validpass123');
        changeInput(confirmInput, 'validpass123');
      });

      const form = container.querySelector('form')!;
      act(() => {
        submitForm(form);
      });

      const submitBtn = container.querySelector('button[type="submit"]');
      expect(submitBtn?.textContent).toContain('Creating Account...');
      expect((submitBtn as any).disabled || submitBtn?.getAttribute('disabled')).toBeTruthy();
      expect((emailInput as any).disabled || emailInput.getAttribute('disabled')).toBeTruthy();

      await act(async () => {
        resolveSignUp({ data: { user: { id: 'u1' }, session: null }, error: null });
        await Promise.resolve();
      });
    });

    it('forgot-password: shows pending loading state and disables button while dispatching link', async () => {
      let resolveReset!: (val: any) => void;
      mockResetPasswordForEmail.mockReturnValue(
        new Promise((resolve) => {
          resolveReset = resolve;
        })
      );

      act(() => {
        root.render(<AuthPage initialMode="forgot-password" theme="light" onThemeChange={vi.fn()} />);
      });

      const emailInput = container.querySelector('input') as HTMLInputElement;
      act(() => {
        changeInput(emailInput, 'recovery@shelf.test');
      });

      const form = container.querySelector('form')!;
      act(() => {
        submitForm(form);
      });

      const submitBtn = container.querySelector('button[type="submit"]');
      expect(submitBtn?.textContent).toContain('Dispatching Link...');
      expect((submitBtn as any).disabled || submitBtn?.getAttribute('disabled')).toBeTruthy();

      await act(async () => {
        resolveReset({ error: null });
        await Promise.resolve();
      });
    });

    it('reset-password: shows pending loading state and disables button while updating password', async () => {
      mockSession = { user: { id: 'u-rec' } } as any;

      let resolveUpdate!: (val: any) => void;
      mockUpdatePassword.mockReturnValue(
        new Promise((resolve) => {
          resolveUpdate = resolve;
        })
      );

      act(() => {
        root.render(<AuthPage initialMode="reset-password" theme="light" onThemeChange={vi.fn()} />);
      });

      const inputs = container.querySelectorAll('input');
      act(() => {
        changeInput(inputs[0] as HTMLInputElement, 'newPassword123');
        changeInput(inputs[1] as HTMLInputElement, 'newPassword123');
      });

      const form = container.querySelector('form')!;
      act(() => {
        submitForm(form);
      });

      const submitBtn = container.querySelector('button[type="submit"]');
      expect(submitBtn?.textContent).toContain('Updating Password...');
      expect((submitBtn as any).disabled || submitBtn?.getAttribute('disabled')).toBeTruthy();

      await act(async () => {
        resolveUpdate({ error: null });
        await Promise.resolve();
      });
    });

    it('login: prevents duplicate submissions while request is already pending', async () => {
      let resolveSignIn!: (val: any) => void;
      mockSignIn.mockReturnValue(
        new Promise((resolve) => {
          resolveSignIn = resolve;
        })
      );

      act(() => {
        root.render(<AuthPage initialMode="login" theme="light" onThemeChange={vi.fn()} />);
      });

      const inputs = container.querySelectorAll('input');
      act(() => {
        changeInput(inputs[0] as HTMLInputElement, 'reader@shelf.test');
        changeInput(inputs[1] as HTMLInputElement, 'secret123');
      });

      const form = container.querySelector('form')!;
      act(() => {
        submitForm(form);
      });
      expect(mockSignIn).toHaveBeenCalledTimes(1);

      // Second duplicate submit while first is still pending
      act(() => {
        submitForm(form);
      });
      expect(mockSignIn).toHaveBeenCalledTimes(1);

      await act(async () => {
        resolveSignIn({ error: null });
        await Promise.resolve();
      });
    });

    it('register: prevents duplicate submissions while request is already pending', async () => {
      let resolveSignUp!: (val: any) => void;
      mockSignUp.mockReturnValue(
        new Promise((resolve) => {
          resolveSignUp = resolve;
        })
      );

      act(() => {
        root.render(<AuthPage initialMode="register" theme="light" onThemeChange={vi.fn()} />);
      });

      const inputs = container.querySelectorAll('input');
      act(() => {
        changeInput(inputs[0] as HTMLInputElement, 'pending@shelf.test');
        changeInput(inputs[1] as HTMLInputElement, 'validpass123');
        changeInput(inputs[2] as HTMLInputElement, 'validpass123');
      });

      const form = container.querySelector('form')!;
      act(() => {
        submitForm(form);
      });
      expect(mockSignUp).toHaveBeenCalledTimes(1);

      // Second duplicate submit while first is still pending
      act(() => {
        submitForm(form);
      });
      expect(mockSignUp).toHaveBeenCalledTimes(1);

      await act(async () => {
        resolveSignUp({ data: { user: { id: 'u1' }, session: null }, error: null });
        await Promise.resolve();
      });
    });

    it('forgot-password: prevents duplicate submissions while request is already pending', async () => {
      let resolveReset!: (val: any) => void;
      mockResetPasswordForEmail.mockReturnValue(
        new Promise((resolve) => {
          resolveReset = resolve;
        })
      );

      act(() => {
        root.render(<AuthPage initialMode="forgot-password" theme="light" onThemeChange={vi.fn()} />);
      });

      const emailInput = container.querySelector('input') as HTMLInputElement;
      act(() => {
        changeInput(emailInput, 'recovery@shelf.test');
      });

      const form = container.querySelector('form')!;
      act(() => {
        submitForm(form);
      });
      expect(mockResetPasswordForEmail).toHaveBeenCalledTimes(1);

      // Duplicate submission
      act(() => {
        submitForm(form);
      });
      expect(mockResetPasswordForEmail).toHaveBeenCalledTimes(1);

      await act(async () => {
        resolveReset({ error: null });
        await Promise.resolve();
      });
    });

    it('google-auth: prevents duplicate calls while Google sign-in is in-flight', async () => {
      let resolveGoogle!: (val: any) => void;
      mockSignInWithGoogle.mockReturnValue(
        new Promise((resolve) => {
          resolveGoogle = resolve;
        })
      );

      act(() => {
        root.render(<AuthPage initialMode="login" theme="light" onThemeChange={vi.fn()} />);
      });

      const googleBtn = Array.from(container.querySelectorAll('button')).find(
        (b) => b.textContent?.includes('Continue with Google')
      );

      act(() => {
        googleBtn?.click();
      });
      expect(mockSignInWithGoogle).toHaveBeenCalledTimes(1);

      // Second click while in-flight
      act(() => {
        googleBtn?.click();
      });
      expect(mockSignInWithGoogle).toHaveBeenCalledTimes(1);

      await act(async () => {
        resolveGoogle({ error: null });
        await Promise.resolve();
      });
    });

    it('google-auth: displays loading state while connecting and displays error message on rejection', async () => {
      let resolveGoogle!: (val: any) => void;
      mockSignInWithGoogle.mockReturnValue(
        new Promise((resolve) => {
          resolveGoogle = resolve;
        })
      );

      act(() => {
        root.render(<AuthPage initialMode="login" theme="light" onThemeChange={vi.fn()} />);
      });

      const googleBtn = Array.from(container.querySelectorAll('button')).find(
        (b) => b.textContent?.includes('Continue with Google')
      );

      act(() => {
        googleBtn?.click();
      });

      expect(googleBtn?.textContent).toContain('Connecting to Google...');
      expect((googleBtn as any).disabled || googleBtn?.getAttribute('disabled')).toBeTruthy();

      await act(async () => {
        resolveGoogle({ error: { message: 'Google sign-in popup closed by user' } });
        await Promise.resolve();
      });

      expect(container.textContent).toContain('Google sign-in popup closed by user');
      expect(googleBtn?.textContent).toContain('Continue with Google');
    });

    // =========================================================================
    // Synchronous Ref Lock & Same-Tick Duplicate Submission Regressions
    // =========================================================================
    it('login: synchronously blocks same-tick duplicate submissions while request is pending', async () => {
      let resolveSignIn!: (val: any) => void;
      mockSignIn.mockReturnValue(
        new Promise((resolve) => {
          resolveSignIn = resolve;
        })
      );

      act(() => {
        root.render(<AuthPage initialMode="login" theme="light" onThemeChange={vi.fn()} />);
      });

      const inputs = container.querySelectorAll('input');
      act(() => {
        changeInput(inputs[0] as HTMLInputElement, 'reader@shelf.test');
        changeInput(inputs[1] as HTMLInputElement, 'secret123');
      });

      const form = container.querySelector('form')!;
      act(() => {
        submitForm(form);
        submitForm(form);
      });
      expect(mockSignIn).toHaveBeenCalledTimes(1);

      // Verify request remains pending after duplicate event
      const submitBtn = container.querySelector('button[type="submit"]');
      expect(submitBtn?.textContent).toContain('Signing In...');
      expect((submitBtn as any).disabled || submitBtn?.getAttribute('disabled')).toBeTruthy();

      await act(async () => {
        resolveSignIn({ error: null });
        await Promise.resolve();
      });

      expect(submitBtn?.textContent).toContain('Sign In');
    });

    it('register: synchronously blocks same-tick duplicate submissions while request is pending', async () => {
      let resolveSignUp!: (val: any) => void;
      mockSignUp.mockReturnValue(
        new Promise((resolve) => {
          resolveSignUp = resolve;
        })
      );

      act(() => {
        root.render(<AuthPage initialMode="register" theme="light" onThemeChange={vi.fn()} />);
      });

      const inputs = container.querySelectorAll('input');
      act(() => {
        changeInput(inputs[0] as HTMLInputElement, 'pending@shelf.test');
        changeInput(inputs[1] as HTMLInputElement, 'validpass123');
        changeInput(inputs[2] as HTMLInputElement, 'validpass123');
      });

      const form = container.querySelector('form')!;
      act(() => {
        submitForm(form);
        submitForm(form);
      });
      expect(mockSignUp).toHaveBeenCalledTimes(1);

      // Verify request remains pending after duplicate event
      const submitBtn = container.querySelector('button[type="submit"]');
      expect(submitBtn?.textContent).toContain('Creating Account...');
      expect((submitBtn as any).disabled || submitBtn?.getAttribute('disabled')).toBeTruthy();

      await act(async () => {
        resolveSignUp({ data: { user: { id: 'u1' }, session: null }, error: null });
        await Promise.resolve();
      });
    });

    it('forgot-password: synchronously blocks same-tick duplicate submissions while request is pending', async () => {
      let resolveReset!: (val: any) => void;
      mockResetPasswordForEmail.mockReturnValue(
        new Promise((resolve) => {
          resolveReset = resolve;
        })
      );

      act(() => {
        root.render(<AuthPage initialMode="forgot-password" theme="light" onThemeChange={vi.fn()} />);
      });

      const emailInput = container.querySelector('input') as HTMLInputElement;
      act(() => {
        changeInput(emailInput, 'recovery@shelf.test');
      });

      const form = container.querySelector('form')!;
      act(() => {
        submitForm(form);
        submitForm(form);
      });
      expect(mockResetPasswordForEmail).toHaveBeenCalledTimes(1);

      // Verify request remains pending after duplicate event
      const submitBtn = container.querySelector('button[type="submit"]');
      expect(submitBtn?.textContent).toContain('Dispatching Link...');
      expect((submitBtn as any).disabled || submitBtn?.getAttribute('disabled')).toBeTruthy();

      await act(async () => {
        resolveReset({ error: null });
        await Promise.resolve();
      });
    });

    it('reset-password: synchronously blocks same-tick duplicate submissions while request is pending', async () => {
      mockSession = { user: { id: 'u-rec' } } as any;

      let resolveUpdate!: (val: any) => void;
      mockUpdatePassword.mockReturnValue(
        new Promise((resolve) => {
          resolveUpdate = resolve;
        })
      );

      act(() => {
        root.render(<AuthPage initialMode="reset-password" theme="light" onThemeChange={vi.fn()} />);
      });

      const inputs = container.querySelectorAll('input');
      act(() => {
        changeInput(inputs[0] as HTMLInputElement, 'newPassword123');
        changeInput(inputs[1] as HTMLInputElement, 'newPassword123');
      });

      const form = container.querySelector('form')!;
      act(() => {
        submitForm(form);
        submitForm(form);
      });
      expect(mockUpdatePassword).toHaveBeenCalledTimes(1);

      // Verify request remains pending after duplicate event
      const submitBtn = container.querySelector('button[type="submit"]');
      expect(submitBtn?.textContent).toContain('Updating Password...');
      expect((submitBtn as any).disabled || submitBtn?.getAttribute('disabled')).toBeTruthy();

      await act(async () => {
        resolveUpdate({ error: null });
        await Promise.resolve();
      });
    });

    it('google-auth: synchronously blocks same-tick duplicate clicks while request is pending', async () => {
      let resolveGoogle!: (val: any) => void;
      mockSignInWithGoogle.mockReturnValue(
        new Promise((resolve) => {
          resolveGoogle = resolve;
        })
      );

      act(() => {
        root.render(<AuthPage initialMode="login" theme="light" onThemeChange={vi.fn()} />);
      });

      const googleBtn = Array.from(container.querySelectorAll('button')).find(
        (b) => b.textContent?.includes('Continue with Google')
      );

      act(() => {
        googleBtn?.click();
        googleBtn?.click();
      });
      expect(mockSignInWithGoogle).toHaveBeenCalledTimes(1);

      // Verify request remains pending after duplicate event
      expect(googleBtn?.textContent).toContain('Connecting to Google...');
      expect((googleBtn as any).disabled || googleBtn?.getAttribute('disabled')).toBeTruthy();

      await act(async () => {
        resolveGoogle({ error: null });
        await Promise.resolve();
      });

      expect(googleBtn?.textContent).toContain('Continue with Google');
    });

    it('lock release: releases lock after successful completion allowing subsequent legitimate submission', async () => {
      let resolveSignIn!: (val: any) => void;
      mockSignIn.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveSignIn = resolve;
          })
      );

      act(() => {
        root.render(<AuthPage initialMode="login" theme="light" onThemeChange={vi.fn()} />);
      });

      const inputs = container.querySelectorAll('input');
      act(() => {
        changeInput(inputs[0] as HTMLInputElement, 'reader@shelf.test');
        changeInput(inputs[1] as HTMLInputElement, 'secret123');
      });

      const form = container.querySelector('form')!;
      act(() => {
        submitForm(form);
      });
      expect(mockSignIn).toHaveBeenCalledTimes(1);

      // Request is pending
      const submitBtn = container.querySelector('button[type="submit"]');
      expect(submitBtn?.textContent).toContain('Signing In...');

      // Complete successfully
      await act(async () => {
        resolveSignIn({ error: null });
        await Promise.resolve();
      });

      expect(submitBtn?.textContent).toContain('Sign In');

      // Subsequent legitimate submission works
      mockSignIn.mockResolvedValueOnce({ error: null });
      await act(async () => {
        submitForm(form);
        await Promise.resolve();
      });
      expect(mockSignIn).toHaveBeenCalledTimes(2);
    });

    it('lock release: releases lock after returned service error allowing subsequent submission', async () => {
      let resolveSignIn!: (val: any) => void;
      mockSignIn.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveSignIn = resolve;
          })
      );

      act(() => {
        root.render(<AuthPage initialMode="login" theme="light" onThemeChange={vi.fn()} />);
      });

      const inputs = container.querySelectorAll('input');
      act(() => {
        changeInput(inputs[0] as HTMLInputElement, 'reader@shelf.test');
        changeInput(inputs[1] as HTMLInputElement, 'secret123');
      });

      const form = container.querySelector('form')!;
      act(() => {
        submitForm(form);
      });
      expect(mockSignIn).toHaveBeenCalledTimes(1);

      // Resolve with service error
      await act(async () => {
        resolveSignIn({ error: { message: 'Invalid credentials provided.' } });
        await Promise.resolve();
      });

      expect(container.textContent).toContain('Invalid credentials provided.');

      // Subsequent legitimate submission works after error
      mockSignIn.mockResolvedValueOnce({ error: null });
      await act(async () => {
        submitForm(form);
        await Promise.resolve();
      });
      expect(mockSignIn).toHaveBeenCalledTimes(2);
    });

    it('lock release: releases lock after thrown exception or rejected promise allowing subsequent submission', async () => {
      let rejectSignIn!: (err: any) => void;
      mockSignIn.mockImplementation(
        () =>
          new Promise((_, reject) => {
            rejectSignIn = reject;
          })
      );

      act(() => {
        root.render(<AuthPage initialMode="login" theme="light" onThemeChange={vi.fn()} />);
      });

      const inputs = container.querySelectorAll('input');
      act(() => {
        changeInput(inputs[0] as HTMLInputElement, 'reader@shelf.test');
        changeInput(inputs[1] as HTMLInputElement, 'secret123');
      });

      const form = container.querySelector('form')!;
      act(() => {
        submitForm(form);
      });
      expect(mockSignIn).toHaveBeenCalledTimes(1);

      // Reject promise with thrown error
      await act(async () => {
        rejectSignIn(new Error('Network connection timeout.'));
        await Promise.resolve();
      });

      expect(container.textContent).toContain('Network connection timeout.');

      // Subsequent submission works after exception
      mockSignIn.mockResolvedValueOnce({ error: null });
      await act(async () => {
        submitForm(form);
        await Promise.resolve();
      });
      expect(mockSignIn).toHaveBeenCalledTimes(2);
    });

    it('cross-handler lock: synchronously blocks cross-handler duplicate submissions (form and Google auth) in same tick', async () => {
      let resolveSignIn!: (val: any) => void;
      mockSignIn.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveSignIn = resolve;
          })
      );

      act(() => {
        root.render(<AuthPage initialMode="login" theme="light" onThemeChange={vi.fn()} />);
      });

      const inputs = container.querySelectorAll('input');
      act(() => {
        changeInput(inputs[0] as HTMLInputElement, 'reader@shelf.test');
        changeInput(inputs[1] as HTMLInputElement, 'secret123');
      });

      const form = container.querySelector('form')!;
      const googleBtn = Array.from(container.querySelectorAll('button')).find(
        (b) => b.textContent?.includes('Continue with Google')
      );

      // Dispatch form submit and google click synchronously in the exact same tick
      act(() => {
        submitForm(form);
        googleBtn?.click();
      });

      expect(mockSignIn).toHaveBeenCalledTimes(1);
      expect(mockSignInWithGoogle).not.toHaveBeenCalled();

      await act(async () => {
        resolveSignIn({ error: null });
        await Promise.resolve();
      });
    });

    it('cancel recovery: signs out, clears recovery state, and switches to login', async () => {
      mockSession = {
        access_token: 'fake-token',
        refresh_token: 'fake-refresh',
        expires_in: 3600,
        token_type: 'bearer',
        user: { id: 'u-rec', email: 'test@example.com' } as any,
      } as Session;

      act(() => {
        root.render(<AuthPage initialMode="reset-password" theme="light" onThemeChange={vi.fn()} />);
      });

      const cancelBtn = Array.from(container.querySelectorAll('button')).find(
        (b) => b.textContent?.includes('Cancel and Return to Sign In')
      );
      expect(cancelBtn).toBeDefined();

      await act(async () => {
        cancelBtn?.click();
      });

      expect(mockSignOut).toHaveBeenCalled();
      expect(mockClearPasswordRecovery).toHaveBeenCalled();
      expect(container.textContent).toContain('Sign in to');
    });
  });
});

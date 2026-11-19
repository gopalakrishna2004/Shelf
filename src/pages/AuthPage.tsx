import React, { useState, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Brand } from '../components/layout/Brand';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { ThemeToggle } from '../components/ui/ThemeToggle';
import type { Theme } from '../types';
import {
  Mail,
  Lock,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Loader2,
  KeyRound
} from 'lucide-react';

export type AuthMode = 'login' | 'register' | 'forgot-password' | 'reset-password' | 'confirmation-pending';

export interface AuthPageProps {
  initialMode?: AuthMode;
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
}

const GoogleIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
    />
  </svg>
);

export const AuthPage: React.FC<AuthPageProps> = ({
  initialMode = 'login',
  theme,
  onThemeChange,
}) => {
  const {
    session,
    signIn,
    signUp,
    signInWithGoogle,
    resetPasswordForEmail,
    updatePassword,
    clearPasswordRecovery,
    recoveryError,
    oauthError,
    clearOAuthError,
    signOut,
  } = useAuth();

  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const [isCancellingRecovery, setIsCancellingRecovery] = useState(false);
  const [pendingEmail, setPendingEmail] = useState<string>('');
  const isSubmittingRef = useRef(false);

  React.useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  const resetFormState = () => {
    setError(null);
    setSuccessMessage(null);
    setIsSubmitting(false);
    setIsGoogleSubmitting(false);
  };

  const switchMode = (newMode: AuthMode) => {
    resetFormState();
    clearOAuthError();
    setPassword('');
    setConfirmPassword('');
    if (newMode !== 'confirmation-pending') {
      clearPasswordRecovery();
    }
    setMode(newMode);
  };

  const handleGoogleSignIn = async () => {
    if (isSubmittingRef.current || isGoogleSubmitting || isSubmitting) return;
    isSubmittingRef.current = true;
    resetFormState();
    clearOAuthError();
    setIsGoogleSubmitting(true);
    try {
      const { error: googleError } = await signInWithGoogle();
      if (googleError) {
        setError(googleError.message);
      }
    } catch (err: any) {
      setError(err?.message || 'An unexpected error occurred during Google sign-in.');
    } finally {
      isSubmittingRef.current = false;
      setIsGoogleSubmitting(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingRef.current || isSubmitting || isGoogleSubmitting) return;
    isSubmittingRef.current = true;
    try {
      resetFormState();
      if (!email || !password) {
        setError('Please provide both email and password.');
        return;
      }
      setIsSubmitting(true);
      const { error: loginError } = await signIn(email, password);
      if (loginError) {
        setError(loginError.message);
      }
    } catch (err: any) {
      setError(err?.message || 'An unexpected error occurred during sign in.');
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingRef.current || isSubmitting || isGoogleSubmitting) return;
    isSubmittingRef.current = true;
    try {
      resetFormState();
      if (!email || !password) {
        setError('Please provide both email and password.');
        return;
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters in length.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
      setIsSubmitting(true);
      const { data, error: registerError } = await signUp(email, password);
      if (registerError) {
        setError(registerError.message);
      } else if (data?.user && !data.session) {
        setPendingEmail(email);
        setMode('confirmation-pending');
      }
    } catch (err: any) {
      setError(err?.message || 'An unexpected error occurred during registration.');
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingRef.current || isSubmitting || isGoogleSubmitting) return;
    isSubmittingRef.current = true;
    try {
      resetFormState();
      if (!email) {
        setError('Please enter your account email address.');
        return;
      }
      setIsSubmitting(true);
      const { error: resetError } = await resetPasswordForEmail(email);
      if (resetError) {
        setError(resetError.message);
      } else {
        setSuccessMessage(`If an account exists for ${email}, a password reset link has been dispatched to your inbox.`);
      }
    } catch (err: any) {
      setError(err?.message || 'An unexpected error occurred while resetting password.');
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingRef.current || isSubmitting || isGoogleSubmitting) return;
    isSubmittingRef.current = true;
    try {
      resetFormState();
      if (!session) {
        setError('Password recovery session has expired. Please request a fresh reset link.');
        return;
      }
      if (!password) {
        setError('Please enter a new password.');
        return;
      }
      if (password.length < 6) {
        setError('New password must be at least 6 characters in length.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
      setIsSubmitting(true);
      const { error: updateError } = await updatePassword(password);
      if (updateError) {
        setError(updateError.message);
      } else {
        setSuccessMessage('Your password has been successfully updated. Redirecting to your Shelf...');
        setTimeout(() => {
          clearPasswordRecovery();
        }, 1500);
      }
    } catch (err: any) {
      setError(err?.message || 'An unexpected error occurred while updating password.');
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleCancelRecovery = async () => {
    if (isSubmittingRef.current || isCancellingRecovery || isSubmitting) return;
    isSubmittingRef.current = true;
    setIsCancellingRecovery(true);
    setError(null);
    try {
      // 1. Destroy temporary recovery session first to guarantee protected routes cannot be accessed
      await signOut();
    } catch (err) {
      console.error('[Shelf Auth] Error signing out during recovery cancellation:', err);
    } finally {
      // 2. Clear recovery state and switch view only after session destruction completes
      clearPasswordRecovery();
      switchMode('login');
      setIsCancellingRecovery(false);
      isSubmittingRef.current = false;
    }
  };

  return (
    <div className="min-h-screen bg-shelf-ivory text-shelf-dark dark:bg-shelf-dark dark:text-shelf-ivory flex flex-col justify-between p-6 sm:p-10 transition-colors duration-200">
      {/* Top Bar: Brand and Theme Toggle */}
      <header className="flex items-center justify-between max-w-5xl w-full mx-auto">
        <Brand showTagline={false} />
        <div className="flex items-center gap-3">
          <Badge variant="accent">
            Desktop App
          </Badge>
          <ThemeToggle theme={theme} onThemeChange={onThemeChange} variant="compact" />
        </div>
      </header>

      {/* Main Form Canvas */}
      <main className="flex-1 flex items-center justify-center py-10">
        <div className="w-full max-w-md bg-white dark:bg-shelf-surfaceDark border border-shelf-borderLight/80 dark:border-shelf-borderDark/80 rounded-[26px] p-8 sm:p-10 shadow-[0_16px_50px_rgba(36,35,33,0.07)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.5)] transition-all">
          {/* Header by Mode */}
          {mode === 'login' && (
            <div className="mb-6 space-y-1.5 text-center">
              <span className="text-[11px] font-mono uppercase tracking-wider text-shelf-terracotta font-semibold">
                Welcome Back
              </span>
              <h1 className="font-editorial text-3xl sm:text-4xl font-medium tracking-tight text-shelf-dark dark:text-shelf-ivory">
                Sign in to <span className="text-shelf-terracotta italic font-serif">Shelf</span>
              </h1>
              <p className="text-xs text-shelf-muted dark:text-shelf-mutedDark">
                Access your curated links, collections, and reading repository.
              </p>
            </div>
          )}

          {mode === 'register' && (
            <div className="mb-6 space-y-1.5 text-center">
              <span className="text-[11px] font-mono uppercase tracking-wider text-shelf-terracotta font-semibold">
                Begin Your Library
              </span>
              <h1 className="font-editorial text-3xl sm:text-4xl font-medium tracking-tight text-shelf-dark dark:text-shelf-ivory">
                Create an <span className="text-shelf-terracotta italic font-serif">account</span>
              </h1>
              <p className="text-xs text-shelf-muted dark:text-shelf-mutedDark">
                Start keeping everything worth remembering on your personal shelf.
              </p>
            </div>
          )}

          {mode === 'forgot-password' && (
            <div className="mb-6 space-y-1.5 text-center">
              <span className="text-[11px] font-mono uppercase tracking-wider text-shelf-terracotta font-semibold">
                Account Recovery
              </span>
              <h1 className="font-editorial text-3xl sm:text-4xl font-medium tracking-tight text-shelf-dark dark:text-shelf-ivory">
                Reset <span className="text-shelf-terracotta italic font-serif">password</span>
              </h1>
              <p className="text-xs text-shelf-muted dark:text-shelf-mutedDark">
                Enter your registered email address and we'll dispatch recovery instructions.
              </p>
            </div>
          )}

          {mode === 'reset-password' && (
            <div className="mb-6 space-y-1.5 text-center">
              <span className="text-[11px] font-mono uppercase tracking-wider text-shelf-terracotta font-semibold">
                Security Recovery
              </span>
              <h1 className="font-editorial text-3xl sm:text-4xl font-medium tracking-tight text-shelf-dark dark:text-shelf-ivory">
                Set new password
              </h1>
              <p className="text-xs text-shelf-muted dark:text-shelf-mutedDark">
                Enter your new password below to regain full access to Shelf.
              </p>
            </div>
          )}

          {mode === 'confirmation-pending' && (
            <div className="text-center py-4 space-y-4">
              <div className="w-14 h-14 mx-auto rounded-[18px] bg-shelf-terracottaMuted text-shelf-terracotta flex items-center justify-center shadow-xs">
                <Mail className="w-7 h-7 stroke-[1.8]" />
              </div>
              <div className="space-y-1.5">
                <h2 className="font-editorial text-2xl font-medium tracking-tight text-shelf-dark dark:text-shelf-ivory">
                  Check your inbox
                </h2>
                <p className="text-xs text-shelf-muted dark:text-shelf-mutedDark leading-relaxed max-w-sm mx-auto">
                  We've sent a verification email to{' '}
                  <span className="font-medium text-shelf-dark dark:text-shelf-ivory">
                    {pendingEmail}
                  </span>
                  . Click the link inside to activate your Shelf account.
                </p>
              </div>

              <div className="pt-4 border-t border-shelf-borderLight/60 dark:border-shelf-borderDark/60">
                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => switchMode('login')}
                  className="w-full"
                >
                  Return to Sign In
                </Button>
              </div>
            </div>
          )}

          {/* Feedback Banners */}
          {oauthError && (
            <div className="mb-5 p-3.5 rounded-[14px] bg-shelf-terracottaMuted border border-shelf-terracotta/25 text-shelf-terracotta text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-shelf-terracotta" />
              <div className="space-y-0.5">
                <span className="font-medium block">Google Sign-In</span>
                <span className="leading-relaxed opacity-90">{oauthError}</span>
              </div>
            </div>
          )}

          {recoveryError && (
            <div className="mb-5 p-3.5 rounded-[14px] bg-shelf-terracottaMuted border border-shelf-terracotta/25 text-shelf-terracotta text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-shelf-terracotta" />
              <div className="space-y-0.5">
                <span className="font-medium block">Recovery Link Issue</span>
                <span className="leading-relaxed opacity-90">{recoveryError}</span>
              </div>
            </div>
          )}

          {error && (
            <div className="mb-5 p-3.5 rounded-[14px] bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          {successMessage && (
            <div className="mb-5 p-3.5 rounded-[14px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{successMessage}</span>
            </div>
          )}

          {/* Form: LOGIN */}
          {mode === 'login' && (
            <div className="space-y-5">
              {/* Google Sign-In */}
              <div>
                <button
                  type="button"
                  disabled={isSubmitting || isGoogleSubmitting}
                  onClick={handleGoogleSignIn}
                  className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-[14px] border border-shelf-borderLight dark:border-shelf-borderDark bg-white dark:bg-shelf-surfaceDark hover:bg-shelf-surfaceSubtle dark:hover:bg-white/[0.04] transition-all duration-150 shadow-[0_2px_6px_rgba(0,0,0,0.03)] text-xs sm:text-sm font-medium text-shelf-dark dark:text-shelf-ivory focus-ring"
                >
                  {isGoogleSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-shelf-terracotta" />
                      <span>Connecting to Google...</span>
                    </>
                  ) : (
                    <>
                      <GoogleIcon className="w-4 h-4 shrink-0" />
                      <span>Continue with Google</span>
                    </>
                  )}
                </button>

                <div className="relative flex items-center justify-center mt-5">
                  <div className="border-t border-shelf-borderLight/60 dark:border-shelf-borderDark/60 w-full" />
                  <span className="bg-white dark:bg-shelf-surfaceDark px-3 text-[10px] font-mono text-shelf-muted dark:text-shelf-mutedDark uppercase tracking-wider relative shrink-0">
                    or continue with email
                  </span>
                </div>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-shelf-dark dark:text-shelf-ivory mb-1.5">
                    Email Address
                  </label>
                  <Input
                    icon={<Mail className="w-4 h-4" />}
                    type="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                    disabled={isSubmitting || isGoogleSubmitting}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-medium text-shelf-dark dark:text-shelf-ivory">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => switchMode('forgot-password')}
                      className="text-xs text-shelf-terracotta hover:underline font-medium"
                      tabIndex={-1}
                    >
                      Forgot password?
                    </button>
                  </div>
                  <Input
                    icon={<Lock className="w-4 h-4" />}
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={isSubmitting || isGoogleSubmitting}
                  />
                </div>

                <div className="pt-2">
                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    disabled={isSubmitting || isGoogleSubmitting}
                    className="w-full flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Signing In...</span>
                      </>
                    ) : (
                      <>
                        <span>Sign In</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </Button>
                </div>

                <div className="pt-4 border-t border-shelf-borderLight/60 dark:border-shelf-borderDark/60 text-center">
                  <p className="text-xs text-shelf-muted dark:text-shelf-mutedDark">
                    Don't have an account yet?{' '}
                    <button
                      type="button"
                      onClick={() => switchMode('register')}
                      className="text-shelf-terracotta hover:text-shelf-terracottaHover font-semibold hover:underline ml-1"
                    >
                      Create an account
                    </button>
                  </p>
                </div>
              </form>
            </div>
          )}

          {/* Form: REGISTER */}
          {mode === 'register' && (
            <div className="space-y-5">
              {/* Google Sign-In */}
              <div>
                <button
                  type="button"
                  disabled={isSubmitting || isGoogleSubmitting}
                  onClick={handleGoogleSignIn}
                  className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-[14px] border border-shelf-borderLight dark:border-shelf-borderDark bg-white dark:bg-shelf-surfaceDark hover:bg-shelf-surfaceSubtle dark:hover:bg-white/[0.04] transition-all duration-150 shadow-[0_2px_6px_rgba(0,0,0,0.03)] text-xs sm:text-sm font-medium text-shelf-dark dark:text-shelf-ivory focus-ring"
                >
                  {isGoogleSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-shelf-terracotta" />
                      <span>Connecting to Google...</span>
                    </>
                  ) : (
                    <>
                      <GoogleIcon className="w-4 h-4 shrink-0" />
                      <span>Continue with Google</span>
                    </>
                  )}
                </button>

                <div className="relative flex items-center justify-center mt-5">
                  <div className="border-t border-shelf-borderLight/60 dark:border-shelf-borderDark/60 w-full" />
                  <span className="bg-white dark:bg-shelf-surfaceDark px-3 text-[10px] font-mono text-shelf-muted dark:text-shelf-mutedDark uppercase tracking-wider relative shrink-0">
                    or continue with email
                  </span>
                </div>
              </div>

              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-shelf-dark dark:text-shelf-ivory mb-1.5">
                    Email Address
                  </label>
                  <Input
                    icon={<Mail className="w-4 h-4" />}
                    type="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                    disabled={isSubmitting || isGoogleSubmitting}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-shelf-dark dark:text-shelf-ivory mb-1.5">
                    Password
                  </label>
                  <Input
                    icon={<Lock className="w-4 h-4" />}
                    type="password"
                    placeholder="Minimum 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={isSubmitting || isGoogleSubmitting}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-shelf-dark dark:text-shelf-ivory mb-1.5">
                    Confirm Password
                  </label>
                  <Input
                    icon={<Lock className="w-4 h-4" />}
                    type="password"
                    placeholder="Re-enter password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    disabled={isSubmitting || isGoogleSubmitting}
                  />
                </div>

                <div className="pt-2">
                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    disabled={isSubmitting || isGoogleSubmitting}
                    className="w-full flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Creating Account...</span>
                      </>
                    ) : (
                      <>
                        <span>Create Account</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </Button>
                </div>

                <div className="pt-4 border-t border-shelf-borderLight/60 dark:border-shelf-borderDark/60 text-center">
                  <p className="text-xs text-shelf-muted dark:text-shelf-mutedDark">
                    Already have an account?{' '}
                    <button
                      type="button"
                      onClick={() => switchMode('login')}
                      className="text-shelf-terracotta hover:text-shelf-terracottaHover font-semibold hover:underline ml-1"
                    >
                      Sign in
                    </button>
                  </p>
                </div>
              </form>
            </div>
          )}

          {/* Form: FORGOT PASSWORD */}
          {mode === 'forgot-password' && (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-shelf-dark dark:text-shelf-ivory mb-1.5">
                  Account Email
                </label>
                <Input
                  icon={<Mail className="w-4 h-4" />}
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                  disabled={isSubmitting}
                />
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  disabled={isSubmitting}
                  className="w-full flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Dispatching Link...</span>
                    </>
                  ) : (
                    <>
                      <span>Send Reset Instructions</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </Button>
              </div>

              <div className="pt-4 border-t border-shelf-borderLight/60 dark:border-shelf-borderDark/60 text-center">
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className="text-xs text-shelf-muted dark:text-shelf-mutedDark hover:text-shelf-dark dark:hover:text-shelf-ivory font-medium hover:underline"
                >
                  ← Back to Sign In
                </button>
              </div>
            </form>
          )}

          {/* Form: RESET PASSWORD */}
          {mode === 'reset-password' && (
            <>
              {!session ? (
                <div className="space-y-4">
                  <div className="p-4 rounded-[16px] border border-shelf-terracotta/25 bg-shelf-terracottaMuted text-shelf-dark dark:text-shelf-ivory flex items-start gap-3 text-xs">
                    <AlertCircle className="w-4 h-4 text-shelf-terracotta shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="font-medium text-shelf-terracotta">Recovery Session Required</p>
                      <p className="text-shelf-muted dark:text-shelf-mutedDark leading-relaxed">
                        To set a new password, you must click the recovery link sent to your registered email. If the link expired, please request a fresh one below.
                      </p>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="primary"
                    size="md"
                    onClick={() => switchMode('forgot-password')}
                    className="w-full flex items-center justify-center gap-2"
                  >
                    <span>Request New Reset Link</span>
                    <ArrowRight className="w-4 h-4" />
                  </Button>

                  <div className="pt-3 border-t border-shelf-borderLight/60 dark:border-shelf-borderDark/60 text-center">
                    <button
                      type="button"
                      onClick={() => switchMode('login')}
                      className="text-xs text-shelf-muted dark:text-shelf-mutedDark hover:text-shelf-dark dark:hover:text-shelf-ivory font-medium hover:underline"
                    >
                      ← Back to Sign In
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleUpdatePassword} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-shelf-dark dark:text-shelf-ivory mb-1.5">
                      New Password
                    </label>
                    <Input
                      icon={<KeyRound className="w-4 h-4" />}
                      type="password"
                      placeholder="Minimum 6 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoFocus
                      disabled={isSubmitting}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-shelf-dark dark:text-shelf-ivory mb-1.5">
                      Confirm New Password
                    </label>
                    <Input
                      icon={<KeyRound className="w-4 h-4" />}
                      type="password"
                      placeholder="Re-enter new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      disabled={isSubmitting}
                    />
                  </div>

                  <div className="pt-2">
                    <Button
                      type="submit"
                      variant="primary"
                      size="md"
                      disabled={isSubmitting}
                      className="w-full flex items-center justify-center gap-2"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Updating Password...</span>
                        </>
                      ) : (
                        <>
                          <span>Update Password</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </Button>
                  </div>

                  <div className="pt-4 border-t border-shelf-borderLight/60 dark:border-shelf-borderDark/60 text-center">
                    <button
                      type="button"
                      disabled={isCancellingRecovery || isSubmitting}
                      onClick={handleCancelRecovery}
                      className="text-xs text-shelf-muted dark:text-shelf-mutedDark hover:text-shelf-dark dark:hover:text-shelf-ivory font-medium hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isCancellingRecovery ? 'Canceling recovery...' : 'Cancel and Return to Sign In'}
                    </button>
                  </div>
                </form>
              )}
            </>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center text-xs text-shelf-muted dark:text-shelf-mutedDark max-w-5xl w-full mx-auto">
        <span>Shelf — Everything worth keeping.</span>
      </footer>
    </div>
  );
};

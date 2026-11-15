'use client';

import React, { useState } from 'react';
import { Eye, EyeOff, LogIn, UserPlus, X } from 'lucide-react';
import type { AvatarId } from '@/lib/game/types';
import { passwordSchema, usernameSchema, type AccountSession } from '@/lib/online/contracts';
import { accountAuth } from '@/lib/services/online-game';
import { TurnstileChallenge } from './TurnstileChallenge';

export type AuthModalTab = 'login' | 'register';

interface AuthModalProps {
  initialTab: AuthModalTab;
  defaultAvatar: AvatarId;
  defaultPublicLeaderboard: boolean;
  onSuccess: (account: AccountSession) => void;
  onClose: () => void;
}

export function AuthModal({
  initialTab,
  defaultAvatar,
  defaultPublicLeaderboard,
  onSuccess,
  onClose,
}: AuthModalProps) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || '';
  const [tab, setTab] = useState<AuthModalTab>(initialTab);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [publicLeaderboard, setPublicLeaderboard] = useState(defaultPublicLeaderboard);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaKey, setCaptchaKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const switchTab = (next: AuthModalTab) => {
    setTab(next);
    setError(null);
    setCaptchaToken(null);
    setCaptchaKey((k) => k + 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError(null);

    const parsedUser = usernameSchema.safeParse(username);
    if (!parsedUser.success) {
      setError(parsedUser.error.issues[0]?.message ?? 'Enter a valid username.');
      return;
    }

    const parsedPass = passwordSchema.safeParse(password);
    if (!parsedPass.success) {
      setError(parsedPass.error.issues[0]?.message ?? 'Enter a valid password.');
      return;
    }

    if (siteKey && !captchaToken) {
      setError('Complete the security check first.');
      return;
    }

    const token = captchaToken ?? undefined;
    setCaptchaToken(null);
    setBusy(true);
    try {
      const account =
        tab === 'register'
          ? await accountAuth.register({
              username: parsedUser.data,
              password: parsedPass.data,
              avatarId: defaultAvatar,
              publicLeaderboard,
              captchaToken: token,
            })
          : await accountAuth.login({
              username: parsedUser.data,
              password: parsedPass.data,
              captchaToken: token,
            });
      onSuccess(account);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again.');
      if (siteKey) {
        setCaptchaKey((k) => k + 1);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={tab === 'register' ? 'Create Account' : 'Log In'}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0B0E15]/85"
    >
      <div className="w-full max-w-md rounded-3xl bg-[#151B28] border border-[#65737C]/40 p-5 sm:p-6 shadow-[0_28px_80px_rgba(0,0,0,0.72)]">
        <div className="flex items-center justify-between gap-4 pb-4 border-b border-[#65737C]/25">
          <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-[#10141D] border border-[#65737C]/30">
            <button
              type="button"
              onClick={() => switchTab('login')}
              className={[
                'inline-flex items-center gap-1.5 min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap',
                tab === 'login'
                  ? 'bg-[#43DDE6] text-[#10141D]'
                  : 'text-[#CBD5E1] hover:text-[#F4F4F0]',
              ].join(' ')}
            >
              <LogIn className="w-4 h-4" />
              Log In
            </button>
            <button
              type="button"
              onClick={() => switchTab('register')}
              className={[
                'inline-flex items-center gap-1.5 min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap',
                tab === 'register'
                  ? 'bg-[#43DDE6] text-[#10141D]'
                  : 'text-[#CBD5E1] hover:text-[#F4F4F0]',
              ].join(' ')}
            >
              <UserPlus className="w-4 h-4" />
              Create Account
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close account dialog"
            className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center p-2 rounded-xl text-[#94A3B8] hover:text-[#F4F4F0] hover:bg-[#1E2638] active:scale-95 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#43DDE6]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="mt-3 text-xs sm:text-sm text-[#94A3B8]">
          {tab === 'register'
            ? 'Username + password only — no email or code needed. Any online guest progress in this browser carries over.'
            : 'Sign in with your username and password to restore your progress and leaderboard status.'}
        </p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
          <div>
            <label htmlFor="auth-username" className="block text-xs sm:text-sm font-medium text-[#CBD5E1] mb-1.5">
              Username
            </label>
            <input
              id="auth-username"
              type="text"
              maxLength={18}
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. Alex_99"
              className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[#10141D] border border-[#65737C]/40 text-sm sm:text-[15px] text-[#F4F4F0] placeholder:text-[#65737C] focus-visible:outline-none focus-visible:border-[#43DDE6] focus-visible:ring-2 focus-visible:ring-[#43DDE6]/50"
            />
            {tab === 'register' && (
              <p className="mt-1 text-xs text-[#94A3B8]">
                3–18 characters using letters, numbers, _, ., or -.
              </p>
            )}
          </div>

          <div>
            <label htmlFor="auth-password" className="block text-xs sm:text-sm font-medium text-[#CBD5E1] mb-1.5">
              Password
            </label>
            <div className="relative">
              <input
                id="auth-password"
                type={showPassword ? 'text' : 'password'}
                maxLength={72}
                autoComplete={tab === 'register' ? 'new-password' : 'current-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="w-full min-h-[44px] pl-3.5 pr-11 py-2 rounded-xl bg-[#10141D] border border-[#65737C]/40 text-sm sm:text-[15px] text-[#F4F4F0] placeholder:text-[#65737C] focus-visible:outline-none focus-visible:border-[#43DDE6] focus-visible:ring-2 focus-visible:ring-[#43DDE6]/50"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 min-w-[36px] min-h-[36px] inline-flex items-center justify-center rounded-lg text-[#94A3B8] hover:text-[#F4F4F0] cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {tab === 'register' && (
              <p className="mt-1 text-xs text-[#94A3B8]">
                Any 8+ characters work — no special symbols needed.
              </p>
            )}
          </div>

          {tab === 'register' && (
            <label className="flex items-center gap-2 min-h-[40px] text-xs sm:text-sm text-[#CBD5E1] cursor-pointer">
              <input
                type="checkbox"
                className="accent-[#43DDE6]"
                checked={publicLeaderboard}
                onChange={(e) => setPublicLeaderboard(e.target.checked)}
              />
              Show my username and avatar on the public leaderboard
            </label>
          )}

          {siteKey && (
            <TurnstileChallenge
              key={`${tab}-${captchaKey}`}
              siteKey={siteKey}
              onToken={setCaptchaToken}
            />
          )}

          {error && (
            <p role="alert" className="text-sm text-[#FF795E]">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full inline-flex items-center justify-center gap-2 min-h-[46px] px-5 py-2.5 rounded-xl font-semibold text-sm sm:text-base bg-[#43DDE6] text-[#10141D] hover:bg-[#62e6ed] active:scale-[0.98] disabled:opacity-50 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F4F4F0]"
          >
            {busy
              ? tab === 'register'
                ? 'Creating Account...'
                : 'Logging In...'
              : tab === 'register'
                ? 'Create Account'
                : 'Log In'}
          </button>
        </form>
      </div>
    </div>
  );
}

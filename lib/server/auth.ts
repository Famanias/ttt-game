import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import type { AccountSession } from '../online/contracts';
import { adminSupabase } from '../supabase/admin';
import { serverSupabase } from '../supabase/server';

export function accountEmail(username: string): string {
  const normalized = username.trim().toLowerCase();
  const hex = Buffer.from(normalized, 'utf8').toString('hex');
  return `u_${hex}@users.turntake.example`;
}

export function clientRateLimitKey(request: Request, scope: string, subject = ''): string {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const realIp = request.headers.get('x-real-ip')?.trim();
  const ip = forwarded || realIp || 'unknown';
  return createHash('sha256').update(`${scope}:${ip}:${subject}`).digest('hex');
}

export async function enforceAuthRateLimit(
  admin: NonNullable<ReturnType<typeof adminSupabase>>,
  key: string,
  limit: number,
  windowSeconds: number
): Promise<boolean> {
  const { data, error } = await admin.rpc('auth_check_rate_limit', {
    p_key: key,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) return false;
  return Boolean(data);
}

export function ephemeralAuthClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function isCaptchaError(message?: string | null): boolean {
  return /captcha/i.test(message ?? '');
}

export async function getInitialAccount(): Promise<AccountSession | null> {
  const client = await serverSupabase();
  const admin = adminSupabase();
  if (!client || !admin) return null;

  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user || user.is_anonymous) {
    return { registered: false };
  }

  const { data, error: sessionError } = await admin.rpc('auth_account_session', {
    p_user_id: user.id,
  });
  if (sessionError || !data || !data.registered) {
    return { registered: false };
  }
  return data as AccountSession;
}

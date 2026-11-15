import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authSchemas } from '@/lib/online/contracts';
import { failure, readBody } from '@/lib/server/api';
import {
  accountEmail,
  clientRateLimitKey,
  enforceAuthRateLimit,
  isCaptchaError,
} from '@/lib/server/auth';
import { adminSupabase } from '@/lib/supabase/admin';
import { serverSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const client = await serverSupabase();
    const admin = adminSupabase();
    if (!client || !admin) return failure('ONLINE_NOT_CONFIGURED', 503);

    const body = authSchemas.login.parse(await readBody(request));
    const normalized = body.username.trim().toLowerCase();

    const ipAllowed = await enforceAuthRateLimit(
      admin,
      clientRateLimitKey(request, 'login-ip'),
      12,
      300
    );
    const userAllowed = await enforceAuthRateLimit(
      admin,
      clientRateLimitKey(request, 'login-user', normalized),
      10,
      300
    );
    if (!ipAllowed || !userAllowed) return failure('RATE_LIMITED', 429);

    const { data, error } = await client.auth.signInWithPassword({
      email: accountEmail(body.username),
      password: body.password,
      ...(body.captchaToken ? { options: { captchaToken: body.captchaToken } } : {}),
    });

    if (error || !data.user) {
      if (isCaptchaError(error?.message)) return failure('CAPTCHA_REQUIRED', 400);
      return failure('INVALID_CREDENTIALS', 401);
    }

    const { data: account, error: sessionError } = await admin.rpc(
      'auth_account_session',
      { p_user_id: data.user.id }
    );

    if (sessionError || !account?.registered) {
      await client.auth.signOut().catch(() => {});
      return failure('INVALID_CREDENTIALS', 401);
    }

    return NextResponse.json(
      { account },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (error) {
    if (error instanceof z.ZodError) return failure('INVALID_INPUT');
    return failure(
      error instanceof Error &&
        ['INVALID_ORIGIN', 'PAYLOAD_TOO_LARGE', 'INVALID_INPUT'].includes(error.message)
        ? error.message
        : 'INVALID_INPUT'
    );
  }
}

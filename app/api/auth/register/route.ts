import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authSchemas } from '@/lib/online/contracts';
import { failure, readBody } from '@/lib/server/api';
import {
  accountEmail,
  clientRateLimitKey,
  enforceAuthRateLimit,
  ephemeralAuthClient,
  isCaptchaError,
} from '@/lib/server/auth';
import { adminSupabase } from '@/lib/supabase/admin';
import { serverSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const client = await serverSupabase();
    const admin = adminSupabase();
    const anon = ephemeralAuthClient();
    if (!client || !admin || !anon) {
      return failure('ONLINE_NOT_CONFIGURED', 503);
    }

    const body = authSchemas.register.parse(await readBody(request));
    const allowed = await enforceAuthRateLimit(
      admin,
      clientRateLimitKey(request, 'register'),
      8,
      600
    );
    if (!allowed) return failure('RATE_LIMITED', 429);

    const { data: { user: currentUser } } = await client.auth.getUser();
    if (currentUser && !currentUser.is_anonymous) {
      const { data: existingSession } = await admin.rpc('auth_account_session', {
        p_user_id: currentUser.id,
      });
      if (existingSession?.registered) {
        return failure('ALREADY_SIGNED_IN', 400);
      }
    }

    const { data: available, error: availError } = await admin.rpc(
      'auth_username_available',
      { p_username: body.username }
    );
    if (availError) return failure('SERVER_ERROR', 500);
    if (!available) return failure('USERNAME_TAKEN', 409);

    const guestUserId = currentUser?.is_anonymous ? currentUser.id : null;
    const { data: signUpData, error: signUpError } = await anon.auth.signUp({
      email: accountEmail(body.username),
      password: body.password,
      options: {
        ...(body.captchaToken ? { captchaToken: body.captchaToken } : {}),
        data: { username: body.username },
      },
    });

    if (signUpError) {
      if (isCaptchaError(signUpError.message)) return failure('CAPTCHA_REQUIRED', 400);
      if (/already|exists|registered/i.test(signUpError.message)) {
        return failure('USERNAME_TAKEN', 409);
      }
      if (/password/i.test(signUpError.message)) return failure('INVALID_INPUT', 400);
      return failure('REGISTER_FAILED', 400);
    }

    if (!signUpData.user || !signUpData.session) {
      return failure('USERNAME_TAKEN', 409);
    }

    const { data: account, error: completeError } = await admin.rpc(
      'auth_complete_registration',
      {
        p_user_id: signUpData.user.id,
        p_username: body.username,
        p_avatar_id: body.avatarId,
        p_public_leaderboard: body.publicLeaderboard,
        p_guest_user_id: guestUserId,
      }
    );

    if (completeError || !account?.registered) {
      await admin.auth.admin.deleteUser(signUpData.user.id).catch(() => {});
      if (/USERNAME_TAKEN/.test(completeError?.message ?? '')) {
        return failure('USERNAME_TAKEN', 409);
      }
      return failure('SERVER_ERROR', 500);
    }

    const { error: sessionError } = await client.auth.setSession({
      access_token: signUpData.session.access_token,
      refresh_token: signUpData.session.refresh_token,
    });
    if (sessionError) {
      return failure('SERVER_ERROR', 500);
    }

    if (guestUserId) {
      await admin.auth.admin.deleteUser(guestUserId).catch(() => {});
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

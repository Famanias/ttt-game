import test, { afterEach, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import { mock } from 'bun:test';

type AuthStub = {
  getUser: () => Promise<{ data: { user: { id: string } | null }; error: null }>;
  signInAnonymously: (params?: { options?: { captchaToken?: string } }) => Promise<{
    data: { user: { id: string } | null };
    error: { message: string } | null;
  }>;
};

let authStub: AuthStub = {
  getUser: async () => ({ data: { user: null }, error: null }),
  signInAnonymously: async () => ({ data: { user: { id: 'anon-1' } }, error: null }),
};

const realSsr = { ...(await import('@supabase/ssr')) };

mock.module('@supabase/ssr', () => ({
  ...realSsr,
  createBrowserClient: () => ({
    auth: {
      getUser: () => authStub.getUser(),
      signInAnonymously: (params?: { options?: { captchaToken?: string } }) => authStub.signInAnonymously(params),
    },
  }),
}));

const { ensureGuest, onlineGame, GameError } = await import('../lib/services/online-game');

describe('guest auth with Turnstile CAPTCHA', () => {
  const prevUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const prevKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const prevSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const prevFetch = globalThis.fetch;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test';
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = '1x00000000000000000000AA';
  });

  afterEach(() => {
    globalThis.fetch = prevFetch;
    if (prevUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = prevUrl;
    if (prevKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = prevKey;
    if (prevSiteKey === undefined) delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    else process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = prevSiteKey;
  });

  test('existing_guest_skips_captcha', async () => {
    let signInCalls = 0;
    authStub = {
      getUser: async () => ({ data: { user: { id: '11111111-1111-4111-8111-111111111111' } }, error: null }),
      signInAnonymously: async () => {
        signInCalls++;
        return { data: { user: { id: 'unexpected' } }, error: null };
      },
    };

    const userId = await ensureGuest();
    assert.equal(userId, '11111111-1111-4111-8111-111111111111');
    assert.equal(signInCalls, 0);
  });

  test('new_guest_requires_challenge', async () => {
    let signInCalls = 0;
    let fetchCalls = 0;
    globalThis.fetch = (async () => {
      fetchCalls++;
      return new Response('{}', { status: 200 });
    }) as unknown as typeof fetch;
    authStub = {
      getUser: async () => ({ data: { user: null }, error: null }),
      signInAnonymously: async () => {
        signInCalls++;
        return { data: { user: { id: 'unexpected' } }, error: null };
      },
    };

    await assert.rejects(
      () => ensureGuest(),
      (err: unknown) => err instanceof GameError && err.code === 'CAPTCHA_REQUIRED'
    );
    await assert.rejects(
      () => onlineGame.profile({ name: 'Ada', avatarId: 'orb-bot', publicLeaderboard: false }),
      (err: unknown) => err instanceof GameError && err.code === 'CAPTCHA_REQUIRED'
    );
    assert.equal(signInCalls, 0);
    assert.equal(fetchCalls, 0);
  });

  test('new_guest_passes_token_to_auth', async () => {
    const receivedParams: Array<{ options?: { captchaToken?: string } } | undefined> = [];
    const fetchCalls: Array<{ url: string; method?: string }> = [];
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      fetchCalls.push({ url: String(input), method: init?.method });
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }) as unknown as typeof fetch;

    authStub = {
      getUser: async () => ({ data: { user: null }, error: null }),
      signInAnonymously: async (params) => {
        receivedParams.push(params);
        return { data: { user: { id: '22222222-2222-4222-8222-222222222222' } }, error: null };
      },
    };

    const userId = await ensureGuest('test-token');
    assert.equal(userId, '22222222-2222-4222-8222-222222222222');
    assert.deepEqual(receivedParams[0], { options: { captchaToken: 'test-token' } });

    await onlineGame.profile({ name: 'Ada', avatarId: 'orb-bot', publicLeaderboard: false }, 'test-token');
    assert.deepEqual(receivedParams[1], { options: { captchaToken: 'test-token' } });
    assert.deepEqual(fetchCalls, [{ url: '/api/profile', method: 'PUT' }]);
  });

  test('unconfigured site key permits anonymous guest auth without challenge token', async () => {
    delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    const receivedParams: Array<{ options?: { captchaToken?: string } } | undefined> = [];
    authStub = {
      getUser: async () => ({ data: { user: null }, error: null }),
      signInAnonymously: async (params) => {
        receivedParams.push(params);
        return { data: { user: { id: '33333333-3333-4333-8333-333333333333' } }, error: null };
      },
    };

    const userId = await ensureGuest();
    assert.equal(userId, '33333333-3333-4333-8333-333333333333');
    assert.equal(receivedParams.length, 1);
  });
});

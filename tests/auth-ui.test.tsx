import test, { afterEach, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import { mock } from 'bun:test';
import React, { act } from 'react';
import type { Root } from 'react-dom/client';
import { Window } from 'happy-dom';
import { MotionGlobalConfig } from 'motion/react';

type RenderOpts = {
  callback?: (token: string) => void;
};

let signOutCalls = 0;

const realSsr = { ...(await import('@supabase/ssr')) };

mock.module('@supabase/ssr', () => ({
  ...realSsr,
  createBrowserClient: () => ({
    auth: {
      getUser: async () => ({ data: { user: null }, error: null }),
      getSession: async () => ({ data: { session: null }, error: null }),
      signOut: async () => {
        signOutCalls++;
        return { error: null };
      },
      signInAnonymously: async () => ({ data: { user: { id: 'anon-1' } }, error: null }),
    },
  }),
}));

// Initialize react-dom with a temporary DOM so input-event support is detected
// even when auth-ui.test.tsx loads first alphabetically without global DOM.
const needsBootstrapDom = typeof globalThis.document === 'undefined';
const bootstrapWin = needsBootstrapDom ? new Window() : null;
const bootstrapKeys = ['window', 'document', 'navigator', 'HTMLElement', 'HTMLInputElement', 'Node'] as const;
const prevBootstrap = new Map<string, PropertyDescriptor | undefined>();
if (bootstrapWin) {
  for (const key of bootstrapKeys) {
    prevBootstrap.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, {
      configurable: true,
      writable: true,
      value: (bootstrapWin as unknown as Record<string, unknown>)[key],
    });
  }
}
const { createRoot } = await import('react-dom/client');
const { TurnTakeApp } = await import('../components/TurnTakeApp');
if (bootstrapWin) {
  bootstrapWin.close();
  for (const key of bootstrapKeys) {
    const prev = prevBootstrap.get(key);
    if (prev) Object.defineProperty(globalThis, key, prev);
    else delete (globalThis as Record<string, unknown>)[key];
  }
}

function findButton(container: HTMLElement, label: string): HTMLButtonElement | undefined {
  return Array.from(container.querySelectorAll('button')).find((b) =>
    b.textContent?.includes(label)
  );
}

describe('optional account login, registration and progress UI', () => {
  const prevUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const prevKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const prevSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const prevFetch = globalThis.fetch;
  const prevAct = (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT;
  const prevSkip = MotionGlobalConfig.skipAnimations;

  const savedGlobals = new Map<string, PropertyDescriptor | undefined>();
  const globalKeys = [
    'window',
    'document',
    'HTMLElement',
    'HTMLScriptElement',
    'HTMLInputElement',
    'Element',
    'Node',
    'Event',
    'navigator',
    'localStorage',
    'getComputedStyle',
    'matchMedia',
    'requestAnimationFrame',
    'cancelAnimationFrame',
  ] as const;

  let win: Window;
  let root: Root | null = null;
  let container: HTMLDivElement;
  let renderCalls: Array<{ id: string; opts: RenderOpts }> = [];

  beforeEach(() => {
    signOutCalls = 0;
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test';
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = '1x00000000000000000000AA';
    (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
    MotionGlobalConfig.skipAnimations = true;

    const bindKeys = new Set(['getComputedStyle', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame']);
    win = new Window({ url: 'http://localhost:3102/' });
    for (const key of globalKeys) {
      savedGlobals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
      const val = (win as unknown as Record<string, unknown>)[key];
      Object.defineProperty(globalThis, key, {
        configurable: true,
        writable: true,
        value: bindKeys.has(key) && typeof val === 'function' ? val.bind(win) : val,
      });
    }
    const reducedMedia = ((query: string) => ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as typeof window.matchMedia;
    Object.defineProperty(win, 'matchMedia', { configurable: true, writable: true, value: reducedMedia });
    Object.defineProperty(globalThis, 'matchMedia', { configurable: true, writable: true, value: reducedMedia });

    renderCalls = [];
    const turnstileApi = {
      render: (_el: HTMLElement, opts: RenderOpts) => {
        const id = `auth-widget-${renderCalls.length + 1}`;
        renderCalls.push({ id, opts });
        return id;
      },
      reset: () => {},
      remove: () => {},
    };
    const origAppend = win.document.head.appendChild.bind(win.document.head);
    win.document.head.appendChild = ((node: Parameters<typeof origAppend>[0]) => {
      if (node instanceof win.HTMLScriptElement && String(node.src ?? '').includes('challenges.cloudflare.com/turnstile')) {
        const scriptEl = node as unknown as HTMLScriptElement & {
          src: string;
          removeAttribute: (name: string) => void;
          dispatchEvent: (evt: unknown) => boolean;
        };
        const src = scriptEl.src;
        scriptEl.removeAttribute('src');
        const result = origAppend(node);
        Object.defineProperty(scriptEl, 'src', { configurable: true, enumerable: true, value: src });
        queueMicrotask(() => {
          (win as unknown as Record<string, unknown>).turnstile = turnstileApi;
          scriptEl.dispatchEvent(new win.Event('load'));
        });
        return result;
      }
      return origAppend(node);
    }) as typeof win.document.head.appendChild;

    container = win.document.createElement('div') as unknown as HTMLDivElement;
    win.document.body.appendChild(container as unknown as Parameters<typeof win.document.body.appendChild>[0]);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root?.unmount();
    });
    root = null;
    await win.happyDOM.cancelAsync();
    win.close();
    globalThis.fetch = prevFetch;
    if (prevUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = prevUrl;
    if (prevKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = prevKey;
    if (prevSiteKey === undefined) delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    else process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = prevSiteKey;
    (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = prevAct;
    MotionGlobalConfig.skipAnimations = prevSkip;

    for (const key of globalKeys) {
      const prev = savedGlobals.get(key);
      if (prev) Object.defineProperty(globalThis, key, prev);
      else delete (globalThis as Record<string, unknown>)[key];
    }
  });

  function setInputValue(input: HTMLInputElement, value: string) {
    const setter = Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, 'value')?.set;
    setter?.call(input, value);
    input.dispatchEvent(new win.Event('input', { bubbles: true }) as unknown as Event);
    input.dispatchEvent(new win.Event('change', { bubbles: true }) as unknown as Event);
  }

  test('guest sees leaderboard account gate, can register with 12345678, view progress and log out', async () => {
    const calls: Array<{ url: string; body?: Record<string, unknown> }> = [];
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ url, body });

      const registeredAccount = {
        registered: true,
        username: 'Alex_99',
        avatarId: 'orb-bot',
        publicLeaderboard: true,
        stats: {
          classicWins: 2,
          classicLosses: 1,
          classicDraws: 0,
          clashWins: 1,
          clashLosses: 0,
          clashDraws: 0,
          roundsWon: 4,
          roundsPlayed: 6,
          longestStreak: 2,
        },
      };

      if (url === '/api/auth/register') {
        return new Response(
          JSON.stringify({ account: registeredAccount }),
          { status: 200 }
        );
      }
      if (url === '/api/history') {
        return new Response(
          JSON.stringify({
            matches: [
              {
                id: 'm1',
                mode: 'classic',
                winner: 'X',
                myMark: 'X',
                opponentName: 'Rival_1',
                finishedAt: '2026-11-15T01:00:00Z',
                board: ['X', 'X', 'X', null, 'O', 'O', null, null, null],
              },
            ],
          }),
          { status: 200 }
        );
      }
      if (url === '/api/auth/session') {
        return new Response(JSON.stringify(registeredAccount), { status: 200 });
      }
      if (url === '/api/auth/logout') {
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }
      return new Response('{}', { status: 200 });
    }) as unknown as typeof fetch;

    await act(async () => {
      root!.render(React.createElement(TurnTakeApp));
    });

    assert.match(container.textContent ?? '', /Create an account to save progress and join public rankings/);

    await act(async () => {
      findButton(container, 'Register')?.click();
      await new Promise((r) => setTimeout(r, 20));
    });

    const dialog = container.querySelector('[role="dialog"]') as HTMLElement;
    assert.ok(dialog);
    assert.equal(renderCalls.length, 1);

    const usernameInput = dialog.querySelector('#auth-username') as HTMLInputElement;
    const passwordInput = dialog.querySelector('#auth-password') as HTMLInputElement;
    const leaderboardBox = dialog.querySelector('input[type="checkbox"]') as HTMLInputElement;

    await act(async () => {
      setInputValue(usernameInput, 'Alex_99');
      setInputValue(passwordInput, '12345678');
      leaderboardBox.click();
      renderCalls[0].opts.callback?.('reg-captcha-token');
      await new Promise((r) => setTimeout(r, 15));
    });

    await act(async () => {
      (dialog.querySelector('button[type="submit"]') as HTMLButtonElement | null)?.click();
      await new Promise((r) => setTimeout(r, 20));
    });

    const registerCall = calls.find((c) => c.url === '/api/auth/register');
    assert.ok(registerCall);
    assert.equal(registerCall.body?.username, 'Alex_99');
    assert.equal(registerCall.body?.password, '12345678');
    assert.equal(registerCall.body?.publicLeaderboard, true);
    assert.equal(registerCall.body?.captchaToken, 'reg-captcha-token');

    // Now signed in: username button + Log Out visible, leaderboard opt-in unlocked, Player Name locked.
    const nameInput = container.querySelector('#player-name-input') as HTMLInputElement;
    assert.equal(nameInput.readOnly, true);
    assert.equal(nameInput.value, 'Alex_99');

    await act(async () => {
      findButton(container, 'Alex_99')?.click();
      await new Promise((r) => setTimeout(r, 20));
    });
    assert.match(container.textContent ?? '', /2-1-0/);
    assert.match(container.textContent ?? '', /Rival_1/);

    await act(async () => {
      findButton(container, 'Close progress')?.click();
      await new Promise((r) => setTimeout(r, 15));
    });
    await act(async () => {
      findButton(container, 'Log Out')?.click();
      await new Promise((r) => setTimeout(r, 20));
    });

    assert.equal(signOutCalls, 1);
    assert.ok(findButton(container, 'Log In'));
    assert.match(container.textContent ?? '', /Create an account to save progress/);
  });

  test('login shows generic invalid credentials error cleanly', async () => {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ error: { code: 'INVALID_CREDENTIALS' } }), { status: 401 })) as unknown as typeof fetch;

    await act(async () => {
      root!.render(React.createElement(TurnTakeApp));
    });

    await act(async () => {
      findButton(container, 'Log In')?.click();
      await new Promise((r) => setTimeout(r, 20));
    });

    const dialog = container.querySelector('[role="dialog"]') as HTMLElement;
    await act(async () => {
      setInputValue(dialog.querySelector('#auth-username') as HTMLInputElement, 'MissingUser');
      setInputValue(dialog.querySelector('#auth-password') as HTMLInputElement, '12345678');
      renderCalls[0].opts.callback?.('login-token');
      await new Promise((r) => setTimeout(r, 15));
    });
    await act(async () => {
      (dialog.querySelector('button[type="submit"]') as HTMLButtonElement | null)?.click();
      await new Promise((r) => setTimeout(r, 20));
    });

    assert.match(dialog.textContent ?? '', /Invalid username or password/);
  });
});

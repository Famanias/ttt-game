import test, { afterEach, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import { mock } from 'bun:test';
import { Window } from 'happy-dom';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MotionGlobalConfig } from 'motion/react';

type RenderOpts = {
  sitekey: string;
  theme?: string;
  callback?: (token: string) => void;
  'expired-callback'?: () => void;
  'error-callback'?: (code?: string) => void;
  'timeout-callback'?: () => void;
};

type AuthStub = {
  getUser: () => Promise<{ data: { user: { id: string } | null }; error: null }>;
  signInAnonymously: (params?: { options?: { captchaToken?: string } }) => Promise<{
    data: { user: { id: string } | null };
    error: { message: string } | null;
  }>;
};

let authStub: AuthStub = {
  getUser: async () => ({ data: { user: null }, error: null }),
  signInAnonymously: async () => ({ data: { user: { id: 'guest-ui-1' } }, error: null }),
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

const { TurnTakeApp } = await import('../components/TurnTakeApp');
const { TurnstileChallenge } = await import('../components/TurnstileChallenge');

function clickButton(container: HTMLElement, label: string | RegExp): HTMLButtonElement {
  const btn = Array.from(container.querySelectorAll('button')).find((b) => {
    const text = (b.textContent ?? '').trim();
    return typeof label === 'string' ? text.includes(label) : label.test(text);
  });
  assert.ok(btn, `Expected button matching ${String(label)}`);
  btn.click();
  return btn;
}

describe('Turnstile CAPTCHA UI behavior', () => {
  const prevUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const prevKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const prevSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const prevFetch = globalThis.fetch;
  const prevAct = (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT;
  const prevSkipAnimations = MotionGlobalConfig.skipAnimations;

  const savedGlobals = new Map<string, PropertyDescriptor | undefined>();
  const globalKeys = [
    'window',
    'document',
    'HTMLElement',
    'HTMLScriptElement',
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
  let scriptMode: 'load' | 'error' = 'load';
  let injectedScripts: HTMLScriptElement[] = [];
  let renderCalls: Array<{ id: string; opts: RenderOpts }> = [];
  let removedIds: string[] = [];

  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test';
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = '1x00000000000000000000AA';
    (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
    MotionGlobalConfig.skipAnimations = true;

    const bindKeys = new Set(['getComputedStyle', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame']);
    win = new Window({ url: 'http://localhost:3101/' });
    for (const key of globalKeys) {
      savedGlobals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
      const val = (win as unknown as Record<string, unknown>)[key];
      Object.defineProperty(globalThis, key, {
        configurable: true,
        writable: true,
        value: bindKeys.has(key) && typeof val === 'function' ? val.bind(win) : val,
      });
    }
    // Keep LobbyScreen animations instantaneous in Happy DOM and prevent post-teardown GSAP ticks.
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

    scriptMode = 'load';
    injectedScripts = [];
    renderCalls = [];
    removedIds = [];

    const turnstileApi = {
      render: (_el: HTMLElement, opts: RenderOpts) => {
        const id = `widget-${renderCalls.length + 1}`;
        renderCalls.push({ id, opts });
        return id;
      },
      reset: () => {},
      remove: (id: string) => {
        removedIds.push(id);
      },
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
        injectedScripts.push(scriptEl);
        queueMicrotask(() => {
          if (scriptMode === 'load') {
            (win as unknown as Record<string, unknown>).turnstile = turnstileApi;
            scriptEl.dispatchEvent(new win.Event('load'));
          } else {
            delete (win as unknown as Record<string, unknown>).turnstile;
            scriptEl.dispatchEvent(new win.Event('error'));
          }
        });
        return result;
      }
      return origAppend(node);
    }) as typeof win.document.head.appendChild;

    container = win.document.createElement('div') as unknown as HTMLDivElement;
    win.document.body.appendChild(
      container as unknown as Parameters<typeof win.document.body.appendChild>[0]
    );
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
    MotionGlobalConfig.skipAnimations = prevSkipAnimations;

    for (const key of globalKeys) {
      const prev = savedGlobals.get(key);
      if (prev) Object.defineProperty(globalThis, key, prev);
      else delete (globalThis as Record<string, unknown>)[key];
    }
  });

  test('failed_challenge_creates_no_room', async () => {
    const fetchedUrls: string[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      fetchedUrls.push(String(input));
      return new Response('{}', { status: 200 });
    }) as unknown as typeof fetch;

    authStub = {
      getUser: async () => ({ data: { user: null }, error: null }),
      signInAnonymously: async () => ({ data: { user: null }, error: { message: 'captcha verification failed' } }),
    };

    await act(async () => {
      root!.render(React.createElement(TurnTakeApp));
    });

    // No Turnstile script should be injected before requesting an online guest session.
    assert.equal(injectedScripts.length, 0);

    await act(async () => {
      clickButton(container, 'Classic Room');
      await new Promise((r) => setTimeout(r, 15));
    });

    assert.equal(injectedScripts.length, 1);
    assert.equal(renderCalls.length, 1);
    assert.equal(fetchedUrls.length, 0);

    // Provider error keeps room request unsent and renders a retryable error.
    await act(async () => {
      renderCalls[0].opts['error-callback']?.('300010');
    });
    assert.equal(fetchedUrls.length, 0);
    assert.match(container.textContent ?? '', /retry|failed|verification/i);

    // Auth rejection after a solved token also sends zero /api/rooms calls and displays retryable error.
    await act(async () => {
      renderCalls[0].opts.callback?.('rejected-token');
      await new Promise((r) => setTimeout(r, 15));
    });
    assert.equal(fetchedUrls.filter((u) => u.includes('/api/rooms')).length, 0);
    assert.match(container.textContent ?? '', /captcha verification failed/i);
  });

  test('expired_challenge_clears_token', async () => {
    const tokens: Array<string | null> = [];
    const submittedTokens: Array<string | undefined> = [];
    globalThis.fetch = (async () => new Response(JSON.stringify({ ok: true }), { status: 200 })) as unknown as typeof fetch;

    authStub = {
      getUser: async () => ({ data: { user: null }, error: null }),
      signInAnonymously: async (params) => {
        submittedTokens.push(params?.options?.captchaToken);
        return { data: { user: { id: 'anon-2' } }, error: null };
      },
    };

    await act(async () => {
      root!.render(
        React.createElement(TurnstileChallenge, {
          siteKey: '1x00000000000000000000AA',
          onToken: (t: string | null) => tokens.push(t),
        })
      );
      await new Promise((r) => setTimeout(r, 15));
    });

    await act(async () => {
      renderCalls[0].opts.callback?.('expiring-token');
      renderCalls[0].opts['expired-callback']?.();
    });

    assert.deepEqual(tokens, ['expiring-token', null]);

    // Also verify expired tokens cannot be reused when retrying a create/join intent.
    let rejectFirst = true;
    authStub = {
      getUser: async () => ({ data: { user: null }, error: null }),
      signInAnonymously: async (params) => {
        submittedTokens.push(params?.options?.captchaToken);
        if (rejectFirst) {
          rejectFirst = false;
          return { data: { user: null }, error: { message: 'temporary auth error' } };
        }
        return { data: { user: { id: 'anon-2' } }, error: null };
      },
    };

    await act(async () => {
      root!.render(React.createElement(TurnTakeApp));
    });
    await act(async () => {
      clickButton(container, 'Classic Room');
      await new Promise((r) => setTimeout(r, 15));
    });
    let latest = renderCalls[renderCalls.length - 1];
    await act(async () => {
      latest.opts.callback?.('first-failed-token');
      await new Promise((r) => setTimeout(r, 15));
    });
    // Now user solves widget ('stale-before-expiry'), then expiry fires before clicking Classic Room again.
    latest = renderCalls[renderCalls.length - 1];
    await act(async () => {
      latest.opts.callback?.('stale-before-expiry');
      latest.opts['expired-callback']?.();
    });
    await act(async () => {
      clickButton(container, 'Classic Room');
      await new Promise((r) => setTimeout(r, 15));
    });
    assert.equal(submittedTokens.includes('stale-before-expiry'), false);
    assert.equal(submittedTokens.includes(undefined), false);
  });

  test('challenge_unmount_removes_widget', async () => {
    let signInCalls = 0;
    globalThis.fetch = (async () => new Response('{}', { status: 200 })) as unknown as typeof fetch;
    authStub = {
      getUser: async () => ({ data: { user: null }, error: null }),
      signInAnonymously: async () => {
        signInCalls++;
        return { data: { user: { id: 'anon-late' } }, error: null };
      },
    };

    await act(async () => {
      root!.render(React.createElement(TurnTakeApp));
    });

    await act(async () => {
      clickButton(container, 'Classic Room');
      await new Promise((r) => setTimeout(r, 15));
    });

    assert.equal(renderCalls.length, 1);
    const { id, opts } = renderCalls[0];

    // Launching local Classic unmounts LobbyScreen + TurnstileChallenge.
    await act(async () => {
      clickButton(container, 'Play Classic');
      await new Promise((r) => setTimeout(r, 30));
    });

    assert.equal(removedIds.includes(id), true);

    // Late widget callback after unmount must not resume the canceled online room intent.
    await act(async () => {
      opts.callback?.('late-token');
      await new Promise((r) => setTimeout(r, 15));
    });
    assert.equal(signInCalls, 0);
  });

  test('captcha_does_not_block_local_play', async () => {
    scriptMode = 'error';
    let guestCalls = 0;
    authStub = {
      getUser: async () => {
        guestCalls++;
        return { data: { user: null }, error: null };
      },
      signInAnonymously: async () => {
        guestCalls++;
        return { data: { user: { id: 'unexpected' } }, error: null };
      },
    };

    await act(async () => {
      root!.render(React.createElement(TurnTakeApp));
    });

    await act(async () => {
      clickButton(container, 'Classic Room');
      await new Promise((r) => setTimeout(r, 15));
    });

    assert.equal(renderCalls.length, 0);
    assert.match(container.textContent ?? '', /failed|retry|offline/i);

    await act(async () => {
      clickButton(container, 'Play Classic');
      await new Promise((r) => setTimeout(r, 30));
    });
    assert.ok(container.querySelector('[data-testid="board-cell-0"]'), 'Local Classic board should render cleanly');

    await act(async () => {
      clickButton(container, 'Lobby');
      await new Promise((r) => setTimeout(r, 30));
    });
    await act(async () => {
      clickButton(container, 'Local 2P');
      clickButton(container, 'Play Clash');
      await new Promise((r) => setTimeout(r, 30));
    });
    assert.ok(container.querySelector('[role="dialog"]'), 'Local Clash minigame should launch without CAPTCHA');
    assert.equal(guestCalls, 1);
  });
});

'use client';

import React, { useEffect, useRef, useState } from 'react';

interface TurnstileRenderOptions {
  sitekey: string;
  theme?: 'dark' | 'light' | 'auto';
  callback?: (token: string) => void;
  'expired-callback'?: () => void;
  'error-callback'?: (code?: string) => void;
  'timeout-callback'?: () => void;
}

interface TurnstileApi {
  render: (container: HTMLElement, options: TurnstileRenderOptions) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId?: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const TURNSTILE_SCRIPT_SRC =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

function loadTurnstileScript(): Promise<TurnstileApi> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Security check requires a browser window.'));
  }
  if (window.turnstile) {
    return Promise.resolve(window.turnstile);
  }

  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-turnstile-script="true"]'
    );
    const script = existing ?? document.createElement('script');

    const cleanup = () => {
      script.removeEventListener('load', onLoad);
      script.removeEventListener('error', onError);
    };

    const onLoad = () => {
      cleanup();
      if (window.turnstile) {
        resolve(window.turnstile);
        return;
      }
      reject(new Error('Security verification script did not initialize.'));
    };

    const onError = () => {
      cleanup();
      script.remove();
      reject(new Error('Unable to load security check.'));
    };

    script.addEventListener('load', onLoad, { once: true });
    script.addEventListener('error', onError, { once: true });

    if (!existing) {
      script.src = TURNSTILE_SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      script.setAttribute('data-turnstile-script', 'true');
      document.head.appendChild(script);
    }
  });
}

export function TurnstileChallenge({
  siteKey,
  onToken,
}: {
  siteKey: string;
  onToken: (token: string | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const onTokenRef = useRef(onToken);
  useEffect(() => {
    onTokenRef.current = onToken;
  }, [onToken]);

  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let disposed = false;

    void loadTurnstileScript()
      .then((api) => {
        if (disposed || !containerRef.current) return;
        const id = api.render(containerRef.current, {
          sitekey: siteKey,
          theme: 'dark',
          callback: (token: string) => {
            if (disposed) return;
            setStatusMessage(null);
            onTokenRef.current(token);
          },
          'expired-callback': () => {
            if (disposed) return;
            setStatusMessage('Verification expired. Complete the security check again to continue.');
            onTokenRef.current(null);
          },
          'error-callback': () => {
            if (disposed) return;
            setStatusMessage(
              'Security verification failed. Retry verification or play Local 2P / Bot offline.'
            );
            onTokenRef.current(null);
          },
          'timeout-callback': () => {
            if (disposed) return;
            setStatusMessage(
              'Security verification timed out. Retry verification to continue.'
            );
            onTokenRef.current(null);
          },
        });
        widgetIdRef.current = id;
      })
      .catch(() => {
        if (disposed) return;
        setStatusMessage(
          'Security verification failed to load. Retry verification or play Local 2P / Bot offline.'
        );
        onTokenRef.current(null);
      });

    return () => {
      disposed = true;
      const id = widgetIdRef.current;
      widgetIdRef.current = null;
      if (id && typeof window !== 'undefined') {
        window.turnstile?.remove(id);
      }
    };
  }, [siteKey, attempt]);

  const handleRetry = () => {
    setStatusMessage(null);
    onTokenRef.current(null);
    if (widgetIdRef.current && window.turnstile) {
      window.turnstile.reset(widgetIdRef.current);
      return;
    }
    setAttempt((prev) => prev + 1);
  };

  return (
    <div className="rounded-xl bg-[#10141D] border border-[#65737C]/40 p-3 space-y-2">
      <p className="text-xs text-[#CBD5E1]">
        Verify you&apos;re human to create or join an online room
      </p>
      <div ref={containerRef} className="min-h-[65px] flex items-center justify-center" />
      {statusMessage && (
        <div role="alert" className="flex items-center justify-between gap-2 text-xs text-[#FF795E]">
          <span>{statusMessage}</span>
          <button
            type="button"
            onClick={handleRetry}
            className="shrink-0 underline font-medium text-[#43DDE6] hover:text-[#6fe9ef] cursor-pointer"
          >
            Retry verification
          </button>
        </div>
      )}
    </div>
  );
}

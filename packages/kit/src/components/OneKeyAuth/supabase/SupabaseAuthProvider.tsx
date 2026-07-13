import type { PropsWithChildren } from 'react';
import { useEffect, useMemo, useState } from 'react';

import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { SupabaseAuthContext } from './SupabaseAuthContext';

import type { Session } from '@supabase/supabase-js';

const WEB_SUPABASE_AUTH_START_DELAY_MS = 6000;

const waitForSupabaseAuthStart = () => {
  if (!platformEnv.isWeb || typeof globalThis.addEventListener !== 'function') {
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    function cleanup() {
      if (timer) {
        clearTimeout(timer);
        timer = undefined;
      }
      globalThis.removeEventListener('pointerdown', onInteraction);
      globalThis.removeEventListener('keydown', onInteraction);
      globalThis.removeEventListener('touchstart', onInteraction);
    }

    function done() {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      resolve();
    }

    function onInteraction() {
      done();
    }

    timer = setTimeout(done, WEB_SUPABASE_AUTH_START_DELAY_MS);
    globalThis.addEventListener('pointerdown', onInteraction, {
      once: true,
      passive: true,
    });
    globalThis.addEventListener('keydown', onInteraction, { once: true });
    globalThis.addEventListener('touchstart', onInteraction, {
      once: true,
      passive: true,
    });
  });
};

function logSupabaseAuthProvider(message: string) {
  if (
    platformEnv.isNativeMainThread &&
    platformEnv.enableNativeBackgroundThread
  ) {
    defaultLogger.app.appUpdate.log(`[SupabaseAuthProvider] ${message}`);
  }
}

export default function SupabaseAuthProvider({ children }: PropsWithChildren) {
  const [authSession, setSession] = useState<Session | undefined | null>();
  // const [profile, setProfile] = useState<any>();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  logSupabaseAuthProvider(`render isLoading=${isLoading}`);

  // TODO move to OneKeyAuthGlobalEffects
  // Fetch the session once, and subscribe to auth state changes
  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    const fetchSession = async () => {
      try {
        await waitForSupabaseAuthStart();
        if (cancelled) {
          return;
        }
        const { getSupabaseClient } =
          await import('@onekeyhq/shared/src/utils/supabaseClientUtils');
        if (cancelled) {
          return;
        }
        const supabaseClient = getSupabaseClient().client;
        logSupabaseAuthProvider('fetchSession start');
        setIsLoading(true);
        const {
          data: { session },
          error,
        } = await supabaseClient.auth.getSession();
        if (error) {
          console.error('Error fetching session:', error);
        }
        if (cancelled) {
          return;
        }
        setSession(session);
        const {
          data: { subscription },
        } = supabaseClient.auth.onAuthStateChange((_event, nextSession) => {
          setSession(nextSession);
        });
        unsubscribe = () => subscription.unsubscribe();
      } finally {
        logSupabaseAuthProvider('fetchSession done');
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };
    void fetchSession();

    // Cleanup subscription on unmount
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  // Fetch the profile when the session changes
  // TODO profile fetch ERROR
  /*
  // https://xxxx.supabase.co/rest/v1/profiles?select=*&id=eq.0c2b6a65-d588-4549-994a-f009745f9e32
    {
      "code": "PGRST205",
      "details": null,
      "hint": null,
      "message": "Could not find the table 'public.profiles' in the schema cache"
    }
  */
  return (
    <SupabaseAuthContext.Provider
      value={useMemo(
        () => ({
          session: authSession,
          isLoading,
          // profile,
          isLoggedIn: !!authSession,
        }),
        [authSession, isLoading],
      )}
    >
      {children}
    </SupabaseAuthContext.Provider>
  );
}

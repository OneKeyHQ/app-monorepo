import type { PropsWithChildren } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePrimePersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/prime';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  getKeylessSupabaseAuthSessionKey,
  getSupabaseAuthSessionKey,
} from '@onekeyhq/shared/src/storage/SupabaseStorage/consts';
import { EPrimeAuthSessionSource } from '@onekeyhq/shared/types/prime/primeTypes';

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

    // Single settle function used as both the timer callback and the
    // interaction listener (self-references avoid the previous
    // cleanup/onInteraction use-before-define cycle; behavior unchanged).
    function done() {
      if (settled) {
        return;
      }
      settled = true;
      if (timer) {
        clearTimeout(timer);
        timer = undefined;
      }
      globalThis.removeEventListener('pointerdown', done);
      globalThis.removeEventListener('keydown', done);
      globalThis.removeEventListener('touchstart', done);
      resolve();
    }

    timer = setTimeout(done, WEB_SUPABASE_AUTH_START_DELAY_MS);
    globalThis.addEventListener('pointerdown', done, {
      once: true,
      passive: true,
    });
    globalThis.addEventListener('keydown', done, { once: true });
    globalThis.addEventListener('touchstart', done, {
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
  // Per-realm session slots. A OneKey ID login is backed by ONE of two
  // Supabase realms persisted under DIFFERENT storage keys: the legacy email
  // realm or the Keyless OAuth realm (see supabaseClientUtils /
  // primeAuthSessionAccess). Track both and select by the persisted
  // authSessionSource below.
  const [legacySession, setLegacySession] = useState<
    Session | undefined | null
  >();
  const [keylessSession, setKeylessSession] = useState<
    Session | undefined | null
  >();
  const [authSessionSource, setAuthSessionSource] = useState<
    EPrimeAuthSessionSource | undefined
  >();
  // const [profile, setProfile] = useState<any>();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [primePersistAtom] = usePrimePersistAtom();
  const isPrimeLoggedIn = primePersistAtom.isLoggedIn;
  logSupabaseAuthProvider(`render isLoading=${isLoading}`);

  // Read the bg-owned (persisted) auth session source through the bridge.
  // Intentionally the RAW persisted source (getAuthSessionSource), not the
  // effective resolver: undefined and LegacyEmailSupabase both select the
  // legacy slot below, so the legacy-migration fallback (which may hit the
  // network via a bg token read) is unnecessary for identity display.
  const refreshAuthSessionSource = useCallback(async () => {
    try {
      const source =
        await backgroundApiProxy.simpleDb.prime.getAuthSessionSource();
      setAuthSessionSource(source);
    } catch (error) {
      console.error('Error reading auth session source:', error);
    }
  }, []);

  // The auth session source changes on login / logout / source switch, all
  // of which flip the bg-owned primePersistAtom.isLoggedIn (the source is
  // committed before the atom update — see
  // ServicePrime.commitAuthSessionSourceBeforeAtomUpdate); re-resolve on
  // every flip (and once on mount).
  useEffect(() => {
    void refreshAuthSessionSource();
  }, [isPrimeLoggedIn, refreshAuthSessionSource]);

  // TODO move to OneKeyAuthGlobalEffects
  // Fetch the sessions once, and subscribe to auth state changes
  useEffect(() => {
    let cancelled = false;
    const unsubscribes: (() => void)[] = [];

    const fetchSession = async () => {
      try {
        await waitForSupabaseAuthStart();
        if (cancelled) {
          return;
        }
        const {
          getSupabaseClient,
          getKeylessSupabaseClient,
          isSupabaseTokenRefreshRuntime,
        } = await import('@onekeyhq/shared/src/utils/supabaseClientUtils');
        if (cancelled) {
          return;
        }
        const { client: legacyClient, storage } = getSupabaseClient();
        const keylessClient = getKeylessSupabaseClient().client;
        logSupabaseAuthProvider('fetchSession start');
        setIsLoading(true);
        // Resolve the source before clearing isLoading so an OAuth-backed
        // login is selectable as soon as consumers see isReady.
        await refreshAuthSessionSource();
        if (cancelled) {
          return;
        }
        let nextLegacySession: Session | null = null;
        let nextKeylessSession: Session | null = null;
        if (isSupabaseTokenRefreshRuntime()) {
          // bg/standalone runtime: getSession() may perform a network token
          // refresh of an expired session — allowed here because this runtime
          // owns token rotation (both realms).
          const readClientSession = async (client: typeof legacyClient) => {
            const { data, error } = await client.auth.getSession();
            if (error) {
              console.error('Error fetching session:', error);
            }
            return data.session;
          };
          nextLegacySession = await readClientSession(legacyClient);
          nextKeylessSession = await readClientSession(keylessClient);
        } else {
          // Pure-UI (main) runtime: NEVER call client.auth.getSession() in
          // steady state — its on-demand refresh of an expired session is NOT
          // disabled by autoRefreshToken:false and would race the bg
          // runtime's token rotation (see isSupabaseTokenRefreshRuntime).
          // Read the persisted sessions directly instead (the native session
          // storage is shared with bg; only JS-heap copies are per-runtime);
          // they are only used here for identity display (user / isLoggedIn),
          // so a possibly expired access token is fine — steady-state token
          // reads go through the bg bridge.
          const readStoredSession = async (sessionKey: string) => {
            try {
              const raw = await storage.getItem(sessionKey);
              const parsed = raw ? (JSON.parse(raw) as Session) : null;
              return parsed?.access_token && parsed?.refresh_token
                ? parsed
                : null;
            } catch (error) {
              console.error('Error reading stored session:', error);
              return null;
            }
          };
          nextLegacySession = await readStoredSession(
            getSupabaseAuthSessionKey(),
          );
          nextKeylessSession = await readStoredSession(
            getKeylessSupabaseAuthSessionKey(),
          );
        }
        if (cancelled) {
          return;
        }
        setLegacySession(nextLegacySession);
        setKeylessSession(nextKeylessSession);
        // Auth state events only fire from THIS runtime's client (interactive
        // flows: verifyOtp / setSession / signOut). In pure-UI runtimes the bg
        // runtime's token refreshes do NOT emit TOKEN_REFRESHED here — that is
        // fine because this context only tracks identity (user / isLoggedIn),
        // which a token refresh never changes; nothing may read a steady-state
        // access token from this context. Subscribe to BOTH realms' clients:
        // interactive OAuth flows (persistKeylessOAuthSession / keylessSignOut
        // in useSupabaseAuth) run against the keyless client in this runtime.
        const legacySubscription = legacyClient.auth.onAuthStateChange(
          (_event, nextSession) => {
            setLegacySession(nextSession);
          },
        ).data.subscription;
        unsubscribes.push(() => legacySubscription.unsubscribe());
        const keylessSubscription = keylessClient.auth.onAuthStateChange(
          (_event, nextSession) => {
            setKeylessSession(nextSession);
          },
        ).data.subscription;
        unsubscribes.push(() => keylessSubscription.unsubscribe());
      } finally {
        logSupabaseAuthProvider('fetchSession done');
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };
    void fetchSession();

    // Cleanup subscriptions on unmount
    return () => {
      cancelled = true;
      unsubscribes.forEach((unsubscribe) => unsubscribe());
    };
  }, [refreshAuthSessionSource]);

  // Runtime note (main): when the bg runtime clears the shared keyless
  // session storage (keyless wallet removal / cleanup), this runtime's
  // keyless client still holds an isolated in-memory JS session copy. Sign
  // it out locally so the context (and any other main-side holder of the
  // keyless client) stops acting logged-in. On desktop/web (standalone,
  // single runtime) the sign-out is an idempotent no-op — the emitting
  // runtime already signed out this same client instance.
  useEffect(() => {
    const onKeylessAuthSessionCleared = () => {
      void (async () => {
        try {
          const { getKeylessSupabaseClient } =
            await import('@onekeyhq/shared/src/utils/supabaseClientUtils');
          // scope:'local' only drops the local session (storage already
          // cleared by bg) and emits SIGNED_OUT to the subscription above.
          await getKeylessSupabaseClient().client.auth.signOut({
            scope: 'local',
          });
        } catch (error) {
          console.error('Error signing out keyless client:', error);
        }
        setKeylessSession(null);
        void refreshAuthSessionSource();
      })();
    };
    appEventBus.on(
      EAppEventBusNames.KeylessAuthSessionCleared,
      onKeylessAuthSessionCleared,
    );
    return () => {
      appEventBus.off(
        EAppEventBusNames.KeylessAuthSessionCleared,
        onKeylessAuthSessionCleared,
      );
    };
  }, [refreshAuthSessionSource]);

  // Select the session slot matching the persisted auth session source.
  // HARD SAFETY RULE (mirrors SimpleDbEntityPrime.getEffectiveAuthSessionSource):
  // a keyless session with no persisted KeylessOAuth source means "Keyless
  // wallet only, NOT logged into OneKey ID", so an undefined source selects
  // the legacy slot and must never fall back to the keyless session.
  const authSession =
    authSessionSource === EPrimeAuthSessionSource.KeylessOAuth
      ? keylessSession
      : legacySession;

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

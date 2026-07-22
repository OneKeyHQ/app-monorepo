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

  // Re-resolve the source whenever the bg-owned primePersistAtom.isLoggedIn
  // flips (login / logout), and once on mount. This is NOT sufficient for
  // every source change: apiBindLegacyOneKeyIdOAuth switches the source
  // while staying logged in — that case is covered by the
  // PrimeAuthSessionSourceCommitted subscription below.
  useEffect(() => {
    void refreshAuthSessionSource();
  }, [isPrimeLoggedIn, refreshAuthSessionSource]);

  // Read both per-realm session slots. Reusable outside the mount effect:
  // the runtime split below (bg/standalone getSession() vs pure-UI direct
  // storage read) is position-independent, and both reads are idempotent.
  const readSessionSlots = useCallback(async (): Promise<{
    nextLegacySession: Session | null;
    nextKeylessSession: Session | null;
  }> => {
    const {
      getSupabaseClient,
      getKeylessSupabaseClient,
      isSupabaseTokenRefreshRuntime,
    } = await import('@onekeyhq/shared/src/utils/supabaseClientUtils');
    const { client: legacyClient, storage } = getSupabaseClient();
    const keylessClient = getKeylessSupabaseClient().client;
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
          return parsed?.access_token && parsed?.refresh_token ? parsed : null;
        } catch (error) {
          console.error('Error reading stored session:', error);
          return null;
        }
      };
      nextLegacySession = await readStoredSession(getSupabaseAuthSessionKey());
      nextKeylessSession = await readStoredSession(
        getKeylessSupabaseAuthSessionKey(),
      );
    }
    return { nextLegacySession, nextKeylessSession };
  }, []);

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
        const { getSupabaseClient, getKeylessSupabaseClient } =
          await import('@onekeyhq/shared/src/utils/supabaseClientUtils');
        if (cancelled) {
          return;
        }
        const legacyClient = getSupabaseClient().client;
        const keylessClient = getKeylessSupabaseClient().client;
        logSupabaseAuthProvider('fetchSession start');
        setIsLoading(true);
        // Resolve the source before clearing isLoading so an OAuth-backed
        // login is selectable as soon as consumers see isReady.
        await refreshAuthSessionSource();
        if (cancelled) {
          return;
        }
        const { nextLegacySession, nextKeylessSession } =
          await readSessionSlots();
        if (cancelled) {
          return;
        }
        setLegacySession(nextLegacySession);
        setKeylessSession(nextKeylessSession);
        // Auth state events only fire from THIS runtime's client (interactive
        // flows: verifyOtp / signOut). In pure-UI runtimes the bg runtime's
        // token refreshes do NOT emit TOKEN_REFRESHED here — that is fine
        // because this context only tracks identity (user / isLoggedIn),
        // which a token refresh never changes; nothing may read a steady-state
        // access token from this context. Subscribe to BOTH realms' clients:
        // keylessSignOut (useSupabaseAuth) still runs against the keyless
        // client in this runtime, and on single-runtime targets the bg-owned
        // keyless persist (ServicePrime.persistKeylessOAuthSession) uses the
        // same client instance, so its setSession emits here too; on
        // split-runtime targets that persist is covered by the
        // PrimeAuthSessionSourceCommitted projection refresh below.
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
  }, [readSessionSlots, refreshAuthSessionSource]);

  // A source commit does not necessarily flip primePersistAtom.isLoggedIn:
  // apiBindLegacyOneKeyIdOAuth switches LegacyEmailSupabase -> KeylessOAuth
  // while staying logged in, so the [isPrimeLoggedIn] effect above never
  // re-resolves the source in that flow and this context would keep
  // selecting the (just signed-out) legacy slot — session=null while the
  // app is logged in — until restart. bg-side setSession writes (the legacy
  // keyless migration and, on split-runtime targets, the bg-owned keyless
  // persist) additionally never emit auth events in this runtime, leaving
  // the keyless SLOT stale even when the source is re-resolved. Handle both
  // by re-resolving the source AND re-reading both slots on every commit.
  // Ordering vs the in-flight bind flow is safe: the slots converge through
  // the storage re-reads here and the onAuthStateChange subscriptions above
  // regardless of whether this handler runs before or after the main-side
  // legacy sign-out.
  useEffect(() => {
    let isActive = true;
    // Pure PROJECTION refresh: re-resolve the source and re-read both
    // persisted session slots, then update local state. Never mutates the
    // shared session storage from this (main) runtime — bg owns every
    // persistent session deletion (generation-gated slot queue), so a
    // stale event arriving after a fresh login simply re-reads the fresh
    // session and keeps presenting it, instead of a main-side signOut
    // deleting credentials that no guard could restore.
    const refreshProjectionFromStorage = () => {
      void (async () => {
        try {
          await refreshAuthSessionSource();
          const { nextLegacySession, nextKeylessSession } =
            await readSessionSlots();
          if (!isActive) {
            return;
          }
          setLegacySession(nextLegacySession);
          setKeylessSession(nextKeylessSession);
        } catch (error) {
          console.error(
            'Error refreshing session projection from storage:',
            error,
          );
        }
      })();
    };
    // Source committed (login / bind switch): pick up the new slot.
    appEventBus.on(
      EAppEventBusNames.PrimeAuthSessionSourceCommitted,
      refreshProjectionFromStorage,
    );
    // Bg cleared the shared keyless session storage (keyless wallet
    // removal / teardown): drop this runtime's projection by re-reading
    // the storage bg just cleared. Runtime note (main): the keyless client
    // itself holds no long-lived in-memory session — auth-js re-reads
    // storage per getSession — so no client sign-out is needed here, and
    // performing one would race a concurrent fresh login's persist.
    appEventBus.on(
      EAppEventBusNames.KeylessAuthSessionCleared,
      refreshProjectionFromStorage,
    );
    // Bg cleared auth state after a confirmed invalid token: same
    // projection refresh; the per-source persistent deletion already
    // happened (generation-gated) in bg before the event was emitted.
    appEventBus.on(
      EAppEventBusNames.PrimeLoginInvalidToken,
      refreshProjectionFromStorage,
    );
    return () => {
      isActive = false;
      appEventBus.off(
        EAppEventBusNames.PrimeAuthSessionSourceCommitted,
        refreshProjectionFromStorage,
      );
      appEventBus.off(
        EAppEventBusNames.KeylessAuthSessionCleared,
        refreshProjectionFromStorage,
      );
      appEventBus.off(
        EAppEventBusNames.PrimeLoginInvalidToken,
        refreshProjectionFromStorage,
      );
    };
  }, [readSessionSlots, refreshAuthSessionSource]);

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

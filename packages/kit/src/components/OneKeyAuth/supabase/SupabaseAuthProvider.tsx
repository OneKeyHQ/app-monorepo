import type { PropsWithChildren } from 'react';
import { useEffect, useMemo, useState } from 'react';

import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { getSupabaseAuthSessionKey } from '@onekeyhq/shared/src/storage/SupabaseStorage/consts';
import {
  getSupabaseClient,
  isSupabaseTokenRefreshRuntime,
} from '@onekeyhq/shared/src/utils/supabaseClientUtils';

import { SupabaseAuthContext } from './SupabaseAuthContext';

import type { Session } from '@supabase/supabase-js';

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
    const fetchSession = async () => {
      try {
        logSupabaseAuthProvider('fetchSession start');
        setIsLoading(true);
        let session: Session | null = null;
        if (isSupabaseTokenRefreshRuntime()) {
          // bg/standalone runtime: getSession() may perform a network token
          // refresh of an expired session — allowed here because this runtime
          // owns token rotation.
          const { data, error } =
            await getSupabaseClient().client.auth.getSession();
          if (error) {
            console.error('Error fetching session:', error);
          }
          session = data.session;
        } else {
          // Pure-UI runtime: NEVER call client.auth.getSession() in steady
          // state — its on-demand refresh of an expired session is NOT
          // disabled by autoRefreshToken:false and would race the bg
          // runtime's token rotation (see isSupabaseTokenRefreshRuntime).
          // Read the persisted session directly instead; it is only used
          // here for identity display (user / isLoggedIn), so a possibly
          // expired access token is fine — steady-state token reads go
          // through the bg bridge.
          try {
            const raw = await getSupabaseClient().storage.getItem(
              getSupabaseAuthSessionKey(),
            );
            const parsed = raw ? (JSON.parse(raw) as Session) : null;
            session =
              parsed?.access_token && parsed?.refresh_token ? parsed : null;
          } catch (error) {
            console.error('Error reading stored session:', error);
          }
        }
        setSession(session);
      } finally {
        logSupabaseAuthProvider('fetchSession done');
        setIsLoading(false);
      }
    };
    void fetchSession();

    // Auth state events only fire from THIS runtime's client (interactive
    // flows: verifyOtp / setSession / signOut). In pure-UI runtimes the bg
    // runtime's token refreshes do NOT emit TOKEN_REFRESHED here — that is
    // fine because this context only tracks identity (user / isLoggedIn),
    // which a token refresh never changes; nothing may read a steady-state
    // access token from this context.
    const {
      data: { subscription },
    } = getSupabaseClient().client.auth.onAuthStateChange((_event, session) => {
      console.log('Auth state changed:', { event: _event, session });
      setSession(session);
    });
    // Cleanup subscription on unmount
    return () => {
      subscription.unsubscribe();
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

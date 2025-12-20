import type { PropsWithChildren } from 'react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { getSupabaseClient } from './getSupabaseClient';
import { SupabaseAuthContext } from './SupabaseAuthContext';

import type { Session } from '@supabase/supabase-js';

export default function SupabaseAuthProvider({ children }: PropsWithChildren) {
  const [authSession, setSession] = useState<Session | undefined | null>();
  // const [profile, setProfile] = useState<any>();
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // TODO move to OneKeyAuthGlobalEffects
  // Fetch the session once, and subscribe to auth state changes
  useEffect(() => {
    const fetchSession = async () => {
      try {
        setIsLoading(true);
        const {
          data: { session },
          error,
        } = await getSupabaseClient().client.auth.getSession();
        if (error) {
          console.error('Error fetching session:', error);
        }
        setSession(session);
      } finally {
        setIsLoading(false);
      }
    };
    void fetchSession();

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
  useEffect(() => {
    const fetchProfile = async () => {
      setIsLoading(true);
      // if (authSession) {
      //   const { data } = await getSupabaseClient()
      //     .client.from('profiles')
      //     .select('*')
      //     .eq('id', authSession.user.id)
      //     .single();
      //   setProfile(data);
      // } else {
      //   setProfile(null);
      // }
      setIsLoading(false);
    };
    // void fetchProfile();
  }, [authSession]);

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

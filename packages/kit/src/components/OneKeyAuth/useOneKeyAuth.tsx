import { useCallback, useMemo } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useSupabaseAuth } from '@onekeyhq/kit/src/components/OneKeyAuth/supabase/useSupabaseAuth';
import { usePrimePersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import { getSupabaseClient } from './supabase/getSupabaseClient';

// TODO use useOneKeyAuth(), merge useLoginOneKeyId()
export function usePrimeAuthV2() {
  const [user] = usePrimePersistAtom();

  const {
    signOut: supabaseSignOut,
    getAccessToken,
    isReady,
    isLoggedIn: isSupabaseLoggedIn,
    supabaseUser,
    signInWithOtp: supabaseSignInWithOtp,
    verifyOtp: supabaseVerifyOtp,
  } = useSupabaseAuth();

  const useLoginWithEmail = useCallback(
    // ({
    //   onComplete,
    //   onError,
    // }: {
    //   onComplete: () => void;
    //   onError: (error: Error) => void;
    // })
    () => {
      return {
        sendCode: async ({ email }: { email: string }) => {
          const _res = await supabaseSignInWithOtp({ email });
          // return res;
        },
        loginWithCode: async ({
          code,
          email,
        }: {
          code: string;
          email: string;
        }) => {
          const _res = await supabaseVerifyOtp({ email, otp: code });
          // return res;
        },
      };
    },
    [supabaseSignInWithOtp, supabaseVerifyOtp],
  );

  const apiLogout = useCallback(async () => {
    await backgroundApiProxy.servicePrime.apiLogout();
  }, []);

  const logout: () => Promise<void> = useCallback(async () => {
    try {
      await apiLogout();
    } finally {
      await supabaseSignOut();
    }
  }, [apiLogout, supabaseSignOut]);

  return useMemo(() => {
    return {
      isLoggedIn: user?.isLoggedIn && user?.isLoggedInOnServer,
      isPrimeSubscriptionActive: user?.primeSubscription?.isActive,
      user,
      logout,
      // apiLogout,
      // sdkLogout,
      getAccessToken,
      isReady,
      authenticated: isSupabaseLoggedIn,
      useLoginWithEmail,
      supabaseUser,
    };
  }, [
    getAccessToken,
    isReady,
    isSupabaseLoggedIn,
    logout,
    supabaseUser,
    useLoginWithEmail,
    user,
  ]);
}

export function useOneKeyAuth() {
  const signOut = useCallback(async () => {
    const res = await getSupabaseClient().client.auth.signOut();
    if (res.error) {
      console.error('Error signing out:', res.error);
    }
    // TODO force clear supabase storage
    return res;
  }, []);
  const signInWithOtp = useCallback(async ({ email }: { email: string }) => {
    const res = await getSupabaseClient().client.auth.signInWithOtp({
      email,
      options: {
        // set this to false if you do not want the user to be automatically signed up
        shouldCreateUser: true,
      },
    });
    return res;
  }, []);
  const verifyOtp = useCallback(
    async ({ email, otp }: { email: string; otp: string }) => {
      const res = await getSupabaseClient().client.auth.verifyOtp({
        email,
        token: otp,
        type: 'email',
      });
      return res;
    },
    [],
  );
  return useMemo(
    () => ({ signOut, signInWithOtp, verifyOtp, getSupabaseClient }),
    [signOut, signInWithOtp, verifyOtp],
  );
}

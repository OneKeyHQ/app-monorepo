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
          console.log(_res);
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
      isSupabaseLoggedIn,
      useLoginWithEmail,
      getSupabaseClient,
      supabaseUser,
      supabaseSignInWithOtp,
      supabaseVerifyOtp,
      supabaseSignOut,
    };
  }, [
    getAccessToken,
    isReady,
    isSupabaseLoggedIn,
    logout,
    user,
    useLoginWithEmail,
    supabaseUser,
    supabaseSignInWithOtp,
    supabaseVerifyOtp,
    supabaseSignOut,
  ]);
}

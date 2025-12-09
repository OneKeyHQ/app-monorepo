import { useCallback, useMemo } from 'react';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { getSupabaseClient } from './getSupabaseClient';
import { useSupabaseAuthContext } from './SupabaseAuthContext';

export function useSupabaseAuth() {
  const ctx = useSupabaseAuthContext();
  const supabaseUser = ctx?.session?.user;
  const isReady = !ctx?.isLoading;
  const isLoggedIn = ctx?.isLoggedIn;

  void supabaseUser?.id;

  const signOut = useCallback(async () => {
    const res = await getSupabaseClient().client.auth.signOut();
    console.log('useSupabaseAuth_signOut', res);
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
    if (res.error && res.error.message) {
      throw new OneKeyLocalError(res.error.message);
    }
    console.log('useSupabaseAuth_signInWithOtp', res);
    return res;
  }, []);
  const verifyOtp = useCallback(
    async ({ email, otp }: { email: string; otp: string }) => {
      const res = await getSupabaseClient().client.auth.verifyOtp({
        email,
        token: otp,
        type: 'email',
      });
      console.log('useSupabaseAuth_verifyOtp', res);
      if (res.error && res.error.message) {
        throw new OneKeyLocalError(res.error.message);
      }
      return res;
    },
    [],
  );
  const getAccessToken = useCallback(async () => {
    const res = await getSupabaseClient().client.auth.getSession();
    return res.data.session?.access_token;
  }, []);

  return useMemo(
    () => ({
      signOut,
      signInWithOtp,
      verifyOtp,
      getSupabaseClient,
      getAccessToken,
      supabaseUser,
      isReady,
      isLoggedIn,
    }),
    [
      signOut,
      signInWithOtp,
      verifyOtp,
      getAccessToken,
      supabaseUser,
      isReady,
      isLoggedIn,
    ],
  );
}

import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { getSupabaseClient } from './getSupabaseClient';
import { useSupabaseAuthContext } from './SupabaseAuthContext';

import type { AuthResponse } from '@supabase/supabase-js';

export function useSupabaseAuth() {
  const ctx = useSupabaseAuthContext();
  const supabaseUser = ctx?.session?.user;
  const isReady = !ctx?.isLoading;
  const isLoggedIn = ctx?.isLoggedIn;
  const intl = useIntl();

  void supabaseUser?.id;

  const signOut = useCallback(async () => {
    const res = await getSupabaseClient().client.auth.signOut({
      scope: 'local',
    });
    console.log('useSupabaseAuth_signOut', res);
    if (res.error) {
      console.error('Error signing out:', res.error);
    }
    return res;
  }, []);
  const signInWithOtp = useCallback(
    async ({ email }: { email: string }) => {
      const res = await getSupabaseClient().client.auth.signInWithOtp({
        email,
        options: {
          // set this to false if you do not want the user to be automatically signed up
          shouldCreateUser: true,
        },
      });
      console.log('useSupabaseAuth_signInWithOtp', res);
      if (res.error && res.error.message) {
        // For security purposes, you can only request this after 48 seconds.
        if (
          res.error.message?.includes(
            'For security purposes, you can only request this after',
          )
        ) {
          const rateLimitMatch = res.error.message.match(
            /you can only request this after (\d+) seconds?/i,
          );
          if (rateLimitMatch) {
            const seconds = rateLimitMatch[1];
            const rateLimitMessage = intl.formatMessage(
              {
                id: ETranslations.email_verification_rate_limit,
              },
              { rest: seconds },
            );
            throw new OneKeyLocalError(rateLimitMessage);
          }
        }

        throw new OneKeyLocalError(res.error.message);
      }
      return res;
    },
    [intl],
  );
  const verifyOtp = useCallback(
    async ({ email, otp }: { email: string; otp: string }) => {
      let res: AuthResponse | undefined;
      const isPrivyEmail = email.endsWith('@privy.io');
      // Special handling for privy.io emails
      if (isPrivyEmail) {
        let phoneOtpData:
          | {
              phone: string;
              otp: string;
            }
          | undefined;
        try {
          phoneOtpData = await backgroundApiProxy.servicePrime.apiFetchPhoneOtp(
            {
              email,
              otp,
            },
          );
        } catch (error) {
          console.error('Error fetching phone OTP:', error);
        }

        if (phoneOtpData?.phone && phoneOtpData?.otp) {
          res = await getSupabaseClient().client.auth.verifyOtp({
            phone: phoneOtpData.phone,
            token: phoneOtpData.otp,
            type: 'sms',
          });
        }
      }

      if (!res) {
        // Default email OTP verification
        res = await getSupabaseClient().client.auth.verifyOtp({
          email,
          token: otp,
          type: 'email',
        });
      }

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

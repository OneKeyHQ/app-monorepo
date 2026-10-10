import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { createClient } from '@supabase/supabase-js';

import { GOOGLE_OAUTH_CLIENT_IDS } from '@onekeyhq/shared/src/consts/authConsts';
import { OAuthLoginCancelError } from '@onekeyhq/shared/src/errors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { OAuthPopup } from './OAuthPopup.native';

import type { IHandleOAuthSessionPersistenceParams } from './types';
import type { User } from '@react-native-google-signin/google-signin';
import type { Session } from '@supabase/supabase-js';

jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn(),
    signOut: jest.fn(),
    signIn: jest.fn(),
  },
}));
jest.mock('expo-apple-authentication', () => ({}));
jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  randomUUID: () => 'synthetic-nonce',
  digestStringAsync: () => Promise.resolve('synthetic-hashed-nonce'),
}));
jest.mock('expo-web-browser', () => ({}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({}));
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    prime: { subscription: { onekeyIdLoginFailedReason: jest.fn() } },
  },
}));

describe('native Google identity authentication', () => {
  const originalAndroid = platformEnv.isNativeAndroid;
  const originalIOS = platformEnv.isNativeIOS;
  const googleSignin = jest.mocked(GoogleSignin);
  const client = createClient(
    'https://synthetic.example.invalid',
    'synthetic-public-key',
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
  const handleSessionPersistence = jest.fn<
    Promise<void>,
    [IHandleOAuthSessionPersistenceParams]
  >();
  const googleUser: User = {
    idToken: 'synthetic-google-id-token',
    serverAuthCode: null,
    scopes: ['openid', 'profile', 'email'],
    user: {
      id: 'synthetic-google-account',
      email: 'synthetic@example.invalid',
      name: 'Synthetic User',
      photo: null,
      familyName: null,
      givenName: null,
    },
  };
  const user = {
    id: 'synthetic-user',
    aud: 'authenticated',
    app_metadata: {},
    user_metadata: {},
    created_at: '2026-10-08T00:00:00Z',
  };
  const session: Session = {
    access_token: 'synthetic-access-token',
    refresh_token: 'synthetic-refresh-token',
    token_type: 'bearer',
    expires_in: 3600,
    user,
  };
  let signInWithIdToken: jest.SpiedFunction<
    typeof client.auth.signInWithIdToken
  >;

  beforeEach(() => {
    jest.resetAllMocks();
    platformEnv.isNativeAndroid = true;
    platformEnv.isNativeIOS = false;
    googleSignin.hasPlayServices.mockResolvedValue(true);
    googleSignin.signOut.mockResolvedValue(null);
    googleSignin.signIn.mockResolvedValue({
      type: 'success',
      data: googleUser,
    });
    handleSessionPersistence.mockResolvedValue(undefined);
    signInWithIdToken = jest
      .spyOn(client.auth, 'signInWithIdToken')
      .mockResolvedValue({
        data: { user, session },
        error: null,
      });
  });

  afterEach(() => {
    platformEnv.isNativeAndroid = originalAndroid;
    platformEnv.isNativeIOS = originalIOS;
    jest.restoreAllMocks();
  });

  it.each(['Android', 'iOS'] as const)(
    'requests only identity scopes and completes login on %s',
    async (platform) => {
      platformEnv.isNativeAndroid = platform === 'Android';
      platformEnv.isNativeIOS = platform === 'iOS';

      await expect(
        OAuthPopup.open({
          provider: 'google',
          client,
          handleSessionPersistence,
        }),
      ).resolves.toEqual({
        success: true,
        session: {
          accessToken: session.access_token,
          refreshToken: session.refresh_token,
        },
      });
      expect(googleSignin.configure).toHaveBeenCalledWith({
        scopes: ['openid', 'profile', 'email'],
        offlineAccess: false,
        ...(platform === 'Android'
          ? { webClientId: GOOGLE_OAUTH_CLIENT_IDS.ANDROID }
          : { iosClientId: GOOGLE_OAUTH_CLIENT_IDS.IOS }),
      });
      expect(googleSignin.signOut).toHaveBeenCalledTimes(1);
      expect(googleSignin.signOut.mock.invocationCallOrder[0]).toBeLessThan(
        googleSignin.signIn.mock.invocationCallOrder[0],
      );
      expect(signInWithIdToken).toHaveBeenCalledWith({
        provider: 'google',
        token: googleUser.idToken,
        nonce: platform === 'Android' ? 'synthetic-nonce' : undefined,
      });
      expect(handleSessionPersistence).toHaveBeenCalledWith({
        accessToken: session.access_token,
        refreshToken: session.refresh_token,
      });
    },
  );

  it('ends cancelled login before creating an identity session', async () => {
    googleSignin.signIn.mockResolvedValue({ type: 'cancelled', data: null });

    await expect(
      OAuthPopup.open({
        provider: 'google',
        client,
        handleSessionPersistence,
      }),
    ).rejects.toBeInstanceOf(OAuthLoginCancelError);
    expect(signInWithIdToken).not.toHaveBeenCalled();
    expect(handleSessionPersistence).not.toHaveBeenCalled();
  });

  it('rejects with the Play services error itself so its code stays classifiable', async () => {
    // Shape of the rejection when Play services cannot reach Google.
    const networkError = Object.assign(new Error('NETWORK_ERROR'), {
      code: '7',
    });
    googleSignin.signIn.mockRejectedValue(networkError);

    await expect(
      OAuthPopup.open({
        provider: 'google',
        client,
        handleSessionPersistence,
      }),
    ).rejects.toBe(networkError);
    expect(signInWithIdToken).not.toHaveBeenCalled();
  });
});

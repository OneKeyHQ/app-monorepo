import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { createClient } from '@supabase/supabase-js';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';

import { devSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
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
jest.mock('expo-apple-authentication', () => ({
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
  isAvailableAsync: jest.fn(),
  signInAsync: jest.fn(),
}));
jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  randomUUID: () => 'synthetic-nonce',
  digestStringAsync: () => Promise.resolve('synthetic-hashed-nonce'),
}));
jest.mock('expo-web-browser', () => ({
  WebBrowserResultType: { CANCEL: 'cancel', DISMISS: 'dismiss' },
  openAuthSessionAsync: jest.fn(),
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  devSettingsPersistAtom: { get: jest.fn() },
}));
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

  it.each([
    // Play services reports an unreachable Google as an error, not a cancel.
    { platform: 'Android', data: { systemSheet: true } },
    // The iOS SDK shows a web page, which can fail to load behind a cancel.
    { platform: 'iOS', data: undefined },
  ])(
    'reports a Google cancel on $platform with data $data',
    async ({ platform, data }) => {
      platformEnv.isNativeAndroid = platform === 'Android';
      platformEnv.isNativeIOS = platform === 'iOS';
      googleSignin.signIn.mockResolvedValue({ type: 'cancelled', data: null });

      const error: unknown = await OAuthPopup.open({
        provider: 'google',
        client,
        handleSessionPersistence,
      }).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(OAuthLoginCancelError);
      expect((error as OAuthLoginCancelError).data).toEqual(data);
    },
  );

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

describe('native Apple sign-in cancel', () => {
  const originalAndroid = platformEnv.isNativeAndroid;
  const originalIOS = platformEnv.isNativeIOS;
  const appleAuthentication = jest.mocked(AppleAuthentication);
  const client = createClient(
    'https://synthetic.example.invalid',
    'synthetic-public-key',
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const openApple = () =>
    OAuthPopup.open({
      provider: 'apple',
      authUrl: 'https://synthetic.example.invalid/auth/v1/authorize',
      redirectTo: 'https://synthetic.example.invalid/oauth_callback_native',
      client,
      handleSessionPersistence: jest.fn(),
    });
  const appleError = (code: string, message: string) =>
    Object.assign(new Error(message), { code });

  beforeEach(() => {
    jest.resetAllMocks();
    platformEnv.isNativeAndroid = false;
    platformEnv.isNativeIOS = true;
    appleAuthentication.isAvailableAsync.mockResolvedValue(true);
  });

  afterEach(() => {
    platformEnv.isNativeAndroid = originalAndroid;
    platformEnv.isNativeIOS = originalIOS;
    jest.restoreAllMocks();
  });

  it('marks a dismissed system sheet, which has no page that could fail to load', async () => {
    appleAuthentication.signInAsync.mockRejectedValue(
      appleError(
        'ERR_REQUEST_CANCELED',
        'The user canceled the authorization attempt',
      ),
    );

    const error: unknown = await openApple().catch((e: unknown) => e);

    expect(error).toBeInstanceOf(OAuthLoginCancelError);
    expect((error as OAuthLoginCancelError).data).toEqual({
      systemSheet: true,
    });
    expect(WebBrowser.openAuthSessionAsync).not.toHaveBeenCalled();
  });

  it('leaves the cancel unmarked once sign-in has moved to the browser', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    appleAuthentication.signInAsync.mockRejectedValue(
      appleError(
        'ERR_REQUEST_NOT_HANDLED',
        'The authorization request was not handled',
      ),
    );
    jest
      .mocked(devSettingsPersistAtom.get)
      .mockResolvedValue({ enabled: false } as never);
    jest
      .mocked(WebBrowser.openAuthSessionAsync)
      .mockResolvedValue({ type: 'cancel' } as never);

    const error: unknown = await openApple().catch((e: unknown) => e);

    expect(error).toBeInstanceOf(OAuthLoginCancelError);
    expect((error as OAuthLoginCancelError).data).toBeUndefined();
  });
});

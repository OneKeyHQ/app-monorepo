import { GoogleSignin } from '@react-native-google-signin/google-signin';
import RNCloudFs from 'react-native-cloud-fs';

import { OAuthLoginCancelError } from '../../errors';

import { GoogleDriveStorage } from './GoogleDriveStorage.android';

jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPreviousSignIn: jest.fn(),
    signIn: jest.fn(),
    signInSilently: jest.fn(),
  },
}));
jest.mock('react-native-cloud-fs', () => ({
  loginIfNeeded: jest.fn(),
}));
jest.mock('../../modules3rdParty/react-native-fs', () => ({}));
jest.mock(
  '@onekeyhq/shared/src/googlePlayService/googlePlayService',
  () => ({}),
);

describe('Google Drive login authorization', () => {
  const signIn = jest.mocked(GoogleSignin);
  const cloudFs = jest.mocked(RNCloudFs);
  const storage = new GoogleDriveStorage();
  const success = {
    type: 'success' as const,
    data: {
      idToken: null,
      serverAuthCode: null,
      scopes: [],
      user: {
        id: 'synthetic-account',
        email: 'test@example.com',
        name: null,
        photo: null,
        givenName: null,
        familyName: null,
      },
    },
  };

  beforeEach(() => {
    jest.resetAllMocks();
    signIn.hasPreviousSignIn.mockReturnValue(false);
    cloudFs.loginIfNeeded.mockResolvedValue(true);
  });

  it.each([false, true])(
    'continues after successful sign-in (existing account: %s)',
    async (existing) => {
      signIn.hasPreviousSignIn.mockReturnValue(existing);
      signIn.signIn.mockResolvedValue(success);
      signIn.signInSilently.mockResolvedValue(success);
      await expect(
        storage.loginIfNeeded({ showSignInDialog: true }),
      ).resolves.toBe(true);
      expect(cloudFs.loginIfNeeded.mock.calls).toHaveLength(1);
      expect(
        existing ? signIn.signInSilently : signIn.signIn,
      ).toHaveBeenCalledTimes(1);
    },
  );

  it('rejects an unsuccessful Drive login instead of continuing backup', async () => {
    signIn.signIn.mockResolvedValue(success);
    cloudFs.loginIfNeeded.mockResolvedValue(false);
    await expect(
      storage.loginIfNeeded({ showSignInDialog: true }),
    ).rejects.toThrow('Google Drive login did not complete');
  });

  it('propagates Drive authorization cancellation and permits a later retry', async () => {
    signIn.signIn.mockResolvedValue(success);
    const error = new Error('User canceled');
    cloudFs.loginIfNeeded.mockRejectedValueOnce(error);
    await expect(
      storage.loginIfNeeded({ showSignInDialog: true }),
    ).rejects.toBe(error);
    await expect(
      storage.loginIfNeeded({ showSignInDialog: true }),
    ).resolves.toBe(true);
  });

  it('stops after cancelled interactive sign-in without starting another consent flow', async () => {
    signIn.signIn.mockResolvedValue({ type: 'cancelled', data: null });
    await expect(
      storage.loginIfNeeded({ showSignInDialog: true }),
    ).rejects.toBeInstanceOf(OAuthLoginCancelError);
    expect(cloudFs.loginIfNeeded.mock.calls).toHaveLength(0);
  });

  it('does not turn an absent silent account into interactive Drive login', async () => {
    signIn.signInSilently.mockResolvedValue({
      type: 'noSavedCredentialFound',
      data: null,
    });
    await expect(
      storage.loginIfNeeded({ showSignInDialog: false }),
    ).rejects.toThrow('Google sign-in did not complete');
    expect(cloudFs.loginIfNeeded.mock.calls).toHaveLength(0);
  });

  it('propagates sign-in failures without entering Drive', async () => {
    const error = new Error('authorization denied');
    signIn.signIn.mockRejectedValue(error);
    await expect(
      storage.loginIfNeeded({ showSignInDialog: true }),
    ).rejects.toBe(error);
    expect(cloudFs.loginIfNeeded.mock.calls).toHaveLength(0);
  });
});

import { EOAuthSocialLoginProvider } from '@onekeyhq/shared/src/consts/authConsts';

import { getWalletAvatarProvider } from './getWalletAvatarProvider';

describe('getWalletAvatarProvider', () => {
  test('prefers avatarProvider over keylessProvider', () => {
    expect(
      getWalletAvatarProvider({
        keylessDetailsInfo: {
          keylessOwnerId: 'owner-id',
          keylessProvider: EOAuthSocialLoginProvider.Google,
          avatarProvider: EOAuthSocialLoginProvider.Apple,
          socialUserIdHash: 'hash',
        },
      } as never),
    ).toBe(EOAuthSocialLoginProvider.Apple);
  });

  test('falls back to keylessProvider when avatarProvider is missing', () => {
    expect(
      getWalletAvatarProvider({
        keylessDetailsInfo: {
          keylessOwnerId: 'owner-id',
          keylessProvider: EOAuthSocialLoginProvider.Google,
          socialUserIdHash: 'hash',
        },
      } as never),
    ).toBe(EOAuthSocialLoginProvider.Google);
  });

  test('returns undefined when wallet is missing', () => {
    expect(getWalletAvatarProvider(undefined)).toBeUndefined();
  });
});

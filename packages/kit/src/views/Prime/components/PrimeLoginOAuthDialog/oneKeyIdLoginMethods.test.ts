import { EOAuthSocialLoginProvider } from '@onekeyhq/shared/src/consts/authConsts';

import { getOneKeyIdLoginMethods } from './oneKeyIdLoginMethods';

describe('getOneKeyIdLoginMethods', () => {
  test('shows both OAuth providers without local Keyless', () => {
    expect(
      getOneKeyIdLoginMethods({
        isLocalKeylessOAuthMode: false,
      }),
    ).toEqual([
      {
        type: 'oauth',
        provider: EOAuthSocialLoginProvider.Google,
        requiresKeylessLogout: false,
      },
      {
        type: 'oauth',
        provider: EOAuthSocialLoginProvider.Apple,
        requiresKeylessLogout: false,
      },
    ]);
  });

  test.each([
    {
      localProvider: EOAuthSocialLoginProvider.Google,
      oppositeProvider: EOAuthSocialLoginProvider.Apple,
    },
    {
      localProvider: EOAuthSocialLoginProvider.Apple,
      oppositeProvider: EOAuthSocialLoginProvider.Google,
    },
  ])(
    'shows $localProvider and $oppositeProvider together while preserving Keyless logout',
    ({ localProvider, oppositeProvider }) => {
      expect(
        getOneKeyIdLoginMethods({
          isLocalKeylessOAuthMode: true,
          localKeylessProvider: localProvider,
        }),
      ).toEqual([
        {
          type: 'oauth',
          provider: localProvider,
          requiresKeylessLogout: false,
        },
        {
          type: 'oauth',
          provider: oppositeProvider,
          requiresKeylessLogout: true,
        },
      ]);
    },
  );

  test('routes visible OAuth methods through confirmed Keyless recovery when the wallet data is unavailable', () => {
    expect(
      getOneKeyIdLoginMethods({
        isLocalKeylessOAuthMode: true,
      }),
    ).toEqual([
      {
        type: 'oauth',
        provider: EOAuthSocialLoginProvider.Google,
        requiresKeylessLogout: false,
        requiresMalformedKeylessRecovery: true,
      },
      {
        type: 'oauth',
        provider: EOAuthSocialLoginProvider.Apple,
        requiresKeylessLogout: false,
        requiresMalformedKeylessRecovery: true,
      },
    ]);
  });
});

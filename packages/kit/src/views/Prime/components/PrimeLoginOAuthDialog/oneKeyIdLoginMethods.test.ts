import { EOAuthSocialLoginProvider } from '@onekeyhq/shared/src/consts/authConsts';

import { getOneKeyIdLoginMethodGroups } from './oneKeyIdLoginMethods';

describe('getOneKeyIdLoginMethodGroups', () => {
  test('shows both OAuth providers as primary methods without local Keyless', () => {
    expect(
      getOneKeyIdLoginMethodGroups({
        isLocalKeylessOAuthMode: false,
      }),
    ).toEqual({
      primary: [
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
      ],
      more: [{ type: 'email' }],
    });
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
    'keeps $localProvider primary and puts $oppositeProvider behind Keyless logout',
    ({ localProvider, oppositeProvider }) => {
      expect(
        getOneKeyIdLoginMethodGroups({
          isLocalKeylessOAuthMode: true,
          localKeylessProvider: localProvider,
        }),
      ).toEqual({
        primary: [
          {
            type: 'oauth',
            provider: localProvider,
            requiresKeylessLogout: false,
          },
        ],
        more: [
          {
            type: 'oauth',
            provider: oppositeProvider,
            requiresKeylessLogout: true,
          },
          { type: 'email' },
        ],
      });
    },
  );

  test('routes visible OAuth methods through confirmed Keyless recovery when the wallet data is unavailable', () => {
    expect(
      getOneKeyIdLoginMethodGroups({
        isLocalKeylessOAuthMode: true,
      }),
    ).toEqual({
      primary: [
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
      ],
      more: [{ type: 'email' }],
    });
  });
});

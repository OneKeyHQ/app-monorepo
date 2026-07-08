import { EOAuthSocialLoginProvider } from '@onekeyhq/shared/src/consts/authConsts';
import {
  EOneKeyIdAccountStatus,
  EOneKeyIdIdentityType,
  EOneKeyIdOAuthProvider,
} from '@onekeyhq/shared/types/prime/primeTypes';
import type {
  IOneKeyIdAccount,
  IOneKeyIdIdentity,
} from '@onekeyhq/shared/types/prime/primeTypes';

import {
  ONEKEY_ID_OAUTH_PROVIDER_ORDER,
  getBoundOAuthProviders,
  getOAuthSocialLoginProviderName,
  getOneKeyIdOAuthProviderIcon,
  getOneKeyIdOAuthProviderName,
} from './oauthProviderUtils';

function buildAccount(identities: IOneKeyIdIdentity[]): IOneKeyIdAccount {
  return {
    onekeyUserId: 'user-1',
    status: EOneKeyIdAccountStatus.Active,
    identities,
  };
}

describe('getOneKeyIdOAuthProviderName', () => {
  test('maps known providers to display names', () => {
    expect(getOneKeyIdOAuthProviderName(EOneKeyIdOAuthProvider.Google)).toBe(
      'Google',
    );
    expect(getOneKeyIdOAuthProviderName(EOneKeyIdOAuthProvider.Apple)).toBe(
      'Apple',
    );
  });

  test('falls back to the raw provider value for unknown providers', () => {
    // Characterization: out-of-enum runtime values (e.g. a newer server
    // adding a provider) are surfaced verbatim instead of being mislabeled.
    expect(
      getOneKeyIdOAuthProviderName('github' as EOneKeyIdOAuthProvider),
    ).toBe('github');
  });
});

describe('getOneKeyIdOAuthProviderIcon', () => {
  test('maps known providers to icon names', () => {
    expect(getOneKeyIdOAuthProviderIcon(EOneKeyIdOAuthProvider.Google)).toBe(
      'GoogleIllus',
    );
    expect(getOneKeyIdOAuthProviderIcon(EOneKeyIdOAuthProvider.Apple)).toBe(
      'AppleBrand',
    );
  });

  test('falls back to the Apple icon for unknown providers', () => {
    // Characterization: historical fallback keeps out-of-enum runtime values
    // rendering the Apple icon.
    expect(
      getOneKeyIdOAuthProviderIcon('github' as EOneKeyIdOAuthProvider),
    ).toBe('AppleBrand');
  });
});

describe('getOAuthSocialLoginProviderName', () => {
  test('maps known providers to display names', () => {
    expect(
      getOAuthSocialLoginProviderName(EOAuthSocialLoginProvider.Google),
    ).toBe('Google');
    expect(
      getOAuthSocialLoginProviderName(EOAuthSocialLoginProvider.Apple),
    ).toBe('Apple');
  });

  test('returns an empty string for undefined provider', () => {
    expect(getOAuthSocialLoginProviderName(undefined)).toBe('');
  });

  test('falls back to the raw provider value for unknown providers', () => {
    expect(
      getOAuthSocialLoginProviderName('github' as EOAuthSocialLoginProvider),
    ).toBe('github');
  });
});

describe('getBoundOAuthProviders', () => {
  test('returns an empty list for an undefined account', () => {
    expect(getBoundOAuthProviders(undefined)).toEqual([]);
  });

  test('returns an empty list when identities are empty', () => {
    expect(getBoundOAuthProviders(buildAccount([]))).toEqual([]);
  });

  test('ignores legacy email identities', () => {
    expect(
      getBoundOAuthProviders(
        buildAccount([
          {
            identityType: EOneKeyIdIdentityType.LegacyEmail,
            legacyEmail: 'a@example.com',
          },
        ]),
      ),
    ).toEqual([]);
  });

  test('drops OAuth identities that are missing oauthProvider', () => {
    expect(
      getBoundOAuthProviders(
        buildAccount([
          {
            identityType: EOneKeyIdIdentityType.OAuth,
            // oauthProvider intentionally missing
            oauthSubject: 'sub-1',
          },
        ]),
      ),
    ).toEqual([]);
  });

  test('returns providers in canonical display order regardless of identity order', () => {
    expect(
      getBoundOAuthProviders(
        buildAccount([
          {
            identityType: EOneKeyIdIdentityType.OAuth,
            oauthProvider: EOneKeyIdOAuthProvider.Apple,
          },
          {
            identityType: EOneKeyIdIdentityType.OAuth,
            oauthProvider: EOneKeyIdOAuthProvider.Google,
          },
        ]),
      ),
    ).toEqual([EOneKeyIdOAuthProvider.Google, EOneKeyIdOAuthProvider.Apple]);
  });

  test('deduplicates repeated providers', () => {
    expect(
      getBoundOAuthProviders(
        buildAccount([
          {
            identityType: EOneKeyIdIdentityType.OAuth,
            oauthProvider: EOneKeyIdOAuthProvider.Google,
          },
          {
            identityType: EOneKeyIdIdentityType.OAuth,
            oauthProvider: EOneKeyIdOAuthProvider.Google,
          },
        ]),
      ),
    ).toEqual([EOneKeyIdOAuthProvider.Google]);
  });

  test('returns a single bound provider mixed with a legacy identity', () => {
    expect(
      getBoundOAuthProviders(
        buildAccount([
          {
            identityType: EOneKeyIdIdentityType.LegacyEmail,
            legacyEmail: 'a@example.com',
          },
          {
            identityType: EOneKeyIdIdentityType.OAuth,
            oauthProvider: EOneKeyIdOAuthProvider.Apple,
          },
        ]),
      ),
    ).toEqual([EOneKeyIdOAuthProvider.Apple]);
  });

  test('canonical order covers exactly the known providers, Google first', () => {
    expect(ONEKEY_ID_OAUTH_PROVIDER_ORDER).toEqual([
      EOneKeyIdOAuthProvider.Google,
      EOneKeyIdOAuthProvider.Apple,
    ]);
  });
});

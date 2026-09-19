import {
  EOneKeyIdAccountStatus,
  EOneKeyIdIdentityType,
  EOneKeyIdOAuthProvider,
} from '@onekeyhq/shared/types/prime/primeTypes';
import type {
  IOneKeyIdAccount,
  IOneKeyIdIdentity,
} from '@onekeyhq/shared/types/prime/primeTypes';

import { isLegacyOneKeyIdAccountMissingOAuthIdentity } from './oneKeyIdAccountUtils';

function buildAccount(identities: IOneKeyIdIdentity[]): IOneKeyIdAccount {
  return {
    onekeyUserId: 'user-1',
    status: EOneKeyIdAccountStatus.Active,
    identities,
  };
}

const legacyEmailIdentity: IOneKeyIdIdentity = {
  identityType: EOneKeyIdIdentityType.LegacyEmail,
  legacyEmail: 'a@example.com',
};

const oauthIdentity: IOneKeyIdIdentity = {
  identityType: EOneKeyIdIdentityType.OAuth,
  oauthProvider: EOneKeyIdOAuthProvider.Google,
  oauthSubject: 'sub-1',
};

describe('isLegacyOneKeyIdAccountMissingOAuthIdentity', () => {
  test('legacy-email-only account is a legacy account missing OAuth identity', () => {
    expect(
      isLegacyOneKeyIdAccountMissingOAuthIdentity(
        buildAccount([legacyEmailIdentity]),
      ),
    ).toBe(true);
  });

  test('legacy email + bound OAuth identity is not missing OAuth identity', () => {
    expect(
      isLegacyOneKeyIdAccountMissingOAuthIdentity(
        buildAccount([legacyEmailIdentity, oauthIdentity]),
      ),
    ).toBe(false);
  });

  test('OAuth-only account is not a legacy account', () => {
    expect(
      isLegacyOneKeyIdAccountMissingOAuthIdentity(
        buildAccount([oauthIdentity]),
      ),
    ).toBe(false);
  });

  test('multiple legacy email identities without OAuth still classify as legacy', () => {
    expect(
      isLegacyOneKeyIdAccountMissingOAuthIdentity(
        buildAccount([
          legacyEmailIdentity,
          {
            identityType: EOneKeyIdIdentityType.LegacyEmail,
            legacyEmail: 'b@example.com',
          },
        ]),
      ),
    ).toBe(true);
  });

  test('empty identities array returns false (unknown data is NOT legacy)', () => {
    // Documented contract: callers needing a different classification for
    // unknown identity data (offline / stale persisted state) must handle
    // the empty case themselves (see the WithFallback wrapper in kit).
    expect(isLegacyOneKeyIdAccountMissingOAuthIdentity(buildAccount([]))).toBe(
      false,
    );
  });

  test('missing identities array returns false', () => {
    expect(
      isLegacyOneKeyIdAccountMissingOAuthIdentity({
        onekeyUserId: 'user-1',
        status: EOneKeyIdAccountStatus.Active,
      } as IOneKeyIdAccount),
    ).toBe(false);
  });

  test('undefined account returns false', () => {
    expect(isLegacyOneKeyIdAccountMissingOAuthIdentity(undefined)).toBe(false);
  });
});

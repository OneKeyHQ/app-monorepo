import {
  EOneKeyIdAccountStatus,
  EOneKeyIdIdentityType,
  EOneKeyIdOAuthProvider,
} from '@onekeyhq/shared/types/prime/primeTypes';
import type {
  IOneKeyIdAccount,
  IOneKeyIdIdentity,
} from '@onekeyhq/shared/types/prime/primeTypes';

import { shouldShowOneKeyIdLegacyOAuthBindPrompt } from './shouldShowOneKeyIdLegacyOAuthBindPrompt';

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

describe('shouldShowOneKeyIdLegacyOAuthBindPrompt', () => {
  test('shows for a legacy email account with no OAuth identity', () => {
    expect(
      shouldShowOneKeyIdLegacyOAuthBindPrompt({
        onekeyAccount: buildAccount([legacyEmailIdentity]),
      }),
    ).toBe(true);
  });

  test('hides when an OAuth identity is present', () => {
    expect(
      shouldShowOneKeyIdLegacyOAuthBindPrompt({
        onekeyAccount: buildAccount([legacyEmailIdentity, oauthIdentity]),
        lastKnownShouldShow: true,
      }),
    ).toBe(false);
  });

  test('keeps last-known visibility when identities are empty', () => {
    expect(
      shouldShowOneKeyIdLegacyOAuthBindPrompt({
        onekeyAccount: buildAccount([]),
        lastKnownShouldShow: true,
      }),
    ).toBe(true);
    expect(
      shouldShowOneKeyIdLegacyOAuthBindPrompt({
        onekeyAccount: buildAccount([]),
        lastKnownShouldShow: false,
      }),
    ).toBe(false);
  });

  test('keeps last-known visibility when the account is missing', () => {
    expect(
      shouldShowOneKeyIdLegacyOAuthBindPrompt({
        onekeyAccount: undefined,
        lastKnownShouldShow: true,
      }),
    ).toBe(true);
  });

  test('defaults unknown identity data to hidden', () => {
    expect(
      shouldShowOneKeyIdLegacyOAuthBindPrompt({
        onekeyAccount: undefined,
      }),
    ).toBe(false);
  });
});

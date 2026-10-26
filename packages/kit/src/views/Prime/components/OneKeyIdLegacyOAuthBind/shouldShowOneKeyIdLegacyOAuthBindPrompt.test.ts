import { EOneKeyIdAccountStatus } from '@onekeyhq/shared/types/prime/primeTypes';
import type { IOneKeyIdAccount } from '@onekeyhq/shared/types/prime/primeTypes';

import { shouldShowOneKeyIdLegacyOAuthBindPrompt } from './shouldShowOneKeyIdLegacyOAuthBindPrompt';

function buildEmptyAccount(): IOneKeyIdAccount {
  return {
    onekeyUserId: 'user-1',
    status: EOneKeyIdAccountStatus.Active,
    identities: [],
  };
}

describe('shouldShowOneKeyIdLegacyOAuthBindPrompt', () => {
  test.each([
    {
      name: 'empty identities keep last-known visible',
      onekeyAccount: buildEmptyAccount(),
      lastKnownShouldShow: true,
      expected: true,
    },
    {
      name: 'empty identities keep last-known hidden',
      onekeyAccount: buildEmptyAccount(),
      lastKnownShouldShow: false,
      expected: false,
    },
    {
      name: 'a missing account keeps last-known visible',
      onekeyAccount: undefined,
      lastKnownShouldShow: true,
      expected: true,
    },
    {
      name: 'a missing account keeps last-known hidden',
      onekeyAccount: undefined,
      lastKnownShouldShow: false,
      expected: false,
    },
    {
      name: 'unknown data without last-known defaults to hidden',
      onekeyAccount: undefined,
      expected: false,
    },
    {
      name: 'empty identities without last-known default to hidden',
      onekeyAccount: buildEmptyAccount(),
      expected: false,
    },
  ])('$name', ({ onekeyAccount, lastKnownShouldShow, expected }) => {
    expect(
      shouldShowOneKeyIdLegacyOAuthBindPrompt({
        onekeyAccount,
        ...(lastKnownShouldShow === undefined ? {} : { lastKnownShouldShow }),
      }),
    ).toBe(expected);
  });
});

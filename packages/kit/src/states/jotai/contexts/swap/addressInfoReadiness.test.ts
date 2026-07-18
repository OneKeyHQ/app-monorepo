import { isSwapAddressInfoReadyForOwner } from './addressInfoReadiness';

describe('swap address info owner readiness', () => {
  it.each([
    ['network/watch-only account', { account: { id: 'account-a' } }],
    ['All Networks indexed account', { indexedAccount: { id: 'indexed-a' } }],
    ['external db account', { dbAccount: { id: 'db-a' } }],
  ] as const)(
    'fails closed when an active %s resolves without an address',
    (_label, owner) => {
      expect(
        isSwapAddressInfoReadyForOwner({
          address: undefined,
          isAddressInfoReady: true,
          owner,
        }),
      ).toBe(false);
    },
  );

  it.each([
    [
      'watch-only account',
      { account: { id: 'watch-account' } },
      'NonEvmMixedCaseAddress',
    ],
    ['All Networks account', { indexedAccount: { id: 'indexed-a' } }, '0xabc'],
    ['external account', { dbAccount: { id: 'db-a' } }, '0xdef'],
    [
      'custom recipient backed by an active account',
      { account: { id: 'source-account' } },
      'CustomRecipientAddress',
    ],
  ] as const)('accepts a resolved %s address', (_label, owner, address) => {
    expect(
      isSwapAddressInfoReadyForOwner({
        address,
        isAddressInfoReady: true,
        owner,
      }),
    ).toBe(true);
  });

  it('keeps resolved no-wallet address info valid', () => {
    expect(
      isSwapAddressInfoReadyForOwner({
        address: undefined,
        isAddressInfoReady: true,
      }),
    ).toBe(true);
  });
});

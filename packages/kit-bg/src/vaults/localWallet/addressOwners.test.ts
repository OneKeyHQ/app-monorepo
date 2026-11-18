import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { findLocalWalletAddressOwners } from './addressOwners';

function fixture(
  state: { enabled: boolean; paused: boolean } = {
    enabled: true,
    paused: false,
  },
) {
  return {
    listAccounts: async () => ({
      accounts: [
        {
          accountId: 'own-one',
          runtimeKey: 'one',
          accountRuntimeKey: 'one',
          syncEnabled: true,
        },
        {
          accountId: 'own-two',
          runtimeKey: 'two',
          accountRuntimeKey: 'two',
          syncEnabled: true,
        },
      ],
      cleanupAccountIds: [],
    }),
    getAccountState: async () => state,
    getAccountAddresses: async ({ accountId }: { accountId: string }) => ({
      publicAddress: `t-${accountId}`,
      privateAddress: `u-${accountId}`,
    }),
  };
}
it('finds the owning account for its stored private receive address', async () => {
  expect(
    await findLocalWalletAddressOwners({
      capability: fixture(),
      address: 'u-own-two',
    }),
  ).toEqual(['own-two']);
});
it('does not label a foreign address or a case-altered Zcash address as our account', async () => {
  expect(
    await findLocalWalletAddressOwners({
      capability: fixture(),
      address: 'u-foreign',
    }),
  ).toEqual([]);
  expect(
    await findLocalWalletAddressOwners({
      capability: fixture(),
      address: 'U-own-two',
    }),
  ).toEqual([]);
});
// A paused account is hidden from Receive but still named by its stored addresses.
it('names a paused account by its stored address but not one never enabled', async () => {
  const pausedFixture = (state: { enabled: boolean; paused: boolean }) => ({
    ...fixture(state),
    // What Receive reads: no private address while not scanning.
    getAccountAddresses: async ({ accountId }: { accountId: string }) => ({
      publicAddress: `t-${accountId}`,
    }),
    getAccountNamingAddresses: async ({
      accountId,
    }: {
      accountId: string;
    }) => ({
      publicAddress: `t-${accountId}`,
      privateAddress: `u-${accountId}`,
    }),
  });
  expect(
    await findLocalWalletAddressOwners({
      capability: pausedFixture({ enabled: false, paused: true }),
      address: 'u-own-two',
    }),
  ).toEqual(['own-two']);
  expect(
    await findLocalWalletAddressOwners({
      capability: pausedFixture({ enabled: false, paused: false }),
      address: 'u-own-two',
    }),
  ).toEqual([]);
});
it('a failed account read does not suppress another account’s label', async () => {
  const capability = fixture();
  capability.getAccountAddresses = async ({ accountId }) => {
    if (accountId === 'own-one') throw new OneKeyLocalError('unavailable');
    return { publicAddress: 't-own-two', privateAddress: 'u-own-two' };
  };
  expect(
    await findLocalWalletAddressOwners({ capability, address: 'u-own-two' }),
  ).toEqual(['own-two']);
});
// The chain reads back a payment as the receiver it paid, not the receive address shown.
it("uses the chain's own recipient match for a private address", async () => {
  const capability = {
    ...fixture(),
    isSameRecipient: (a: string, b: string) =>
      a.replace(/^u-/, '') === b.replace(/^receiver-/, ''),
  };
  expect(
    await findLocalWalletAddressOwners({
      capability,
      address: 'receiver-own-one',
    }),
  ).toEqual(['own-one']);
  expect(
    await findLocalWalletAddressOwners({ capability, address: 't-own-two' }),
  ).toEqual(['own-two']);
});

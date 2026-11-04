import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { findLocalWalletAddressOwners } from './addressOwners';

function fixture(enabled = true) {
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
    getAccountState: async () => ({ enabled, paused: !enabled }),
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
it('does not expose a paused private address through account naming', async () => {
  expect(
    await findLocalWalletAddressOwners({
      capability: fixture(false),
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

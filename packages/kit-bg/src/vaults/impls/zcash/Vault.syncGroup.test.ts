/* cspell:ignore Ufvks */
/* eslint-disable import/first */
jest.mock('../../../dbs/local/localDbInstance', () => ({
  __esModule: true,
  default: {},
}));

import { ZCASH_NETWORK_MAIN } from '@onekeyhq/core/src/chains/zcash/sdkZcash/constants';

import Vault from './Vault';

import type { IZcashPrivacyModeStateView } from '../../../dbs/simple/entity/SimpleDbEntityZcash';

it('refreshes queued scans and serializes enable rescans with every active key', async () => {
  const states: Record<string, IZcashPrivacyModeStateView> = {
    a: { intent: 'on' },
    b: { intent: 'off' },
    off: { intent: 'off' },
  };
  let finishFirst: (() => void) | undefined;
  const firstScan = new Promise<void>((resolve) => {
    finishFirst = resolve;
  });
  let startedFirst: (() => void) | undefined;
  const started = new Promise<void>((resolve) => {
    startedFirst = resolve;
  });
  const syncWallet = jest
    .fn<
      Promise<{ stateChanged: boolean }>,
      [unknown, { activeUfvks: string[] }]
    >()
    .mockImplementationOnce(async () => {
      startedFirst?.();
      await firstScan;
      return { stateChanged: true };
    })
    .mockResolvedValue({ stateChanged: true });
  const queueLocalWalletRescanFrom = jest
    .fn()
    .mockResolvedValue({ queued: true });
  const zcashPrepareAccounts = jest.fn(
    async ({ accountIds }: { accountIds: string[] }) =>
      accountIds.map((id) => ({ ufvk: id })),
  );
  const vault = Object.assign(
    Object.create(Vault.prototype) as Pick<
      Vault,
      'syncLocalWalletGroup' | 'zcashPreparePrivacyModeAccount'
    >,
    {
      backgroundApi: {
        servicePrivacyChain: { isLocalWalletScanAllowed: async () => true },
        simpleDb: {
          zcash: {
            getPrivacyModeState: async ({ accountId }: { accountId: string }) =>
              states[accountId],
          },
        },
      },
      listLocalWalletAccounts: async () => ({
        accounts: Object.keys(states).map((accountId) => ({
          accountId,
          runtimeKey: ZCASH_NETWORK_MAIN,
        })),
      }),
      zcashResumePendingRescans: async () => undefined,
      zcashPrepareAccounts,
      zcashGetWalletAccount: async () => ({ ufvk: 'a' }),
      zcashGetApi: async () => ({
        syncWallet,
      }),
      queueLocalWalletRescanFrom,
    },
  );
  const first = vault.syncLocalWalletGroup({ accountIds: ['a'] });
  await started;
  const staleScheduler = vault.syncLocalWalletGroup({ accountIds: ['a'] });
  states.b = { intent: 'off', operation: { type: 'enable', requestedAt: 1 } };
  const enable = vault.zcashPreparePrivacyModeAccount({
    accountId: 'b',
    fromHeight: 2_000_000,
  });
  expect(queueLocalWalletRescanFrom).not.toHaveBeenCalled();
  finishFirst?.();
  await Promise.all([first, staleScheduler, enable]);
  expect(syncWallet.mock.calls.map((call) => call[1].activeUfvks)).toEqual([
    ['a'],
    ['a'],
  ]);
  expect(queueLocalWalletRescanFrom).toHaveBeenCalledWith({
    accountId: 'b',
    fromHeight: 2_000_000,
  });
  expect(
    queueLocalWalletRescanFrom.mock.invocationCallOrder[0],
  ).toBeGreaterThan(syncWallet.mock.invocationCallOrder[1]);
  states.b = { intent: 'on' };
  await vault.syncLocalWalletGroup({ accountIds: ['a'] });
  expect(syncWallet.mock.calls[2][1].activeUfvks).toEqual(['a', 'b']);
});

it('does not open the scanner when cellular permission is unavailable', async () => {
  const zcashGetApi = jest.fn();
  const vault = Object.create(Vault.prototype) as Vault;
  Object.assign(vault, {
    backgroundApi: {
      servicePrivacyChain: { isLocalWalletScanAllowed: async () => false },
    },
    zcashGetApi,
  });
  await expect(
    vault.syncLocalWalletGroup({ accountIds: ['a'] }),
  ).resolves.toEqual({ synced: false });
  expect(zcashGetApi).not.toHaveBeenCalled();
});

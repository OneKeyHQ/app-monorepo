/* cspell:ignore Ufvks */
/* eslint-disable import/first */
jest.mock('../../../dbs/local/localDbInstance', () => ({
  __esModule: true,
  default: {},
}));

import * as runtime from 'onekey-zcash-runtime';

import { ZCASH_NETWORK_MAIN } from '@onekeyhq/core/src/chains/zcash/sdkZcash/constants';
import sdk from '@onekeyhq/core/src/chains/zcash/sdkZcash/impl';
import { forgetOpenWallet } from '@onekeyhq/core/src/chains/zcash/sdkZcash/impl/carrier';

import Vault from './Vault';

import type { IZcashPrivacyModeStateView } from '../../../dbs/simple/entity/SimpleDbEntityPrivacyChainState';

jest.mock('onekey-zcash-runtime', () => ({
  __esModule: true,
  default: async () => undefined,
  init: async () => undefined,
  storageRequiresWorkerRestart: () => false,
  openWallet: jest.fn(async () => undefined),
  setLightwalletdUrl: jest.fn(),
  accountByUfvk: jest.fn(),
  importAccountUfvk: jest.fn(),
  listAccounts: jest.fn(),
  accountBalance: jest.fn(),
  accountSyncStatus: jest.fn(),
  syncPeek: jest.fn(),
  syncPrepare: jest.fn(async () => undefined),
  syncStep: jest.fn(),
  deleteWallet: jest.fn(async () => undefined),
}));

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
          privacyChainState: {
            isAccountDeletionPending: async () => false,
            getZcashPrivacyModeState: async ({
              accountId,
            }: {
              accountId: string;
            }) => states[accountId],
          },
        },
      },
      listLocalWalletAccounts: async () => ({
        accounts: Object.keys(states).map((accountId) => ({
          accountId,
          runtimeKey: ZCASH_NETWORK_MAIN,
          accountRuntimeKey: accountId,
          syncEnabled: states[accountId].intent === 'on',
        })),
      }),
      zcashResumePendingRescans: async () => undefined,
      zcashHasAccountViewingKey: async () => true,
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
    onPrepared: async () => undefined,
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

it('keeps a queued peer scan behind recovery admission until the recovering key is on', async () => {
  const states: Record<string, IZcashPrivacyModeStateView> = {
    a: { intent: 'off', operation: { type: 'enable', requestedAt: 1 } },
    b: { intent: 'on' },
  };
  let finishAdmission: (() => void) | undefined;
  const admission = new Promise<void>((resolve) => {
    finishAdmission = resolve;
  });
  let beginAdmission: (() => void) | undefined;
  const admitted = new Promise<void>((resolve) => {
    beginAdmission = resolve;
  });
  const pendingHeights = new Set<number>();
  const discovered = new Set<string>();
  const syncWallet = jest.fn(
    async (_account: unknown, { activeUfvks }: { activeUfvks: string[] }) => {
      if (pendingHeights.has(2_000_000) && activeUfvks.includes('a'))
        discovered.add('note-a');
      pendingHeights.clear();
      return { stateChanged: true };
    },
  );
  const vault = Object.create(Vault.prototype) as Vault;
  Object.assign(vault, {
    backgroundApi: {
      servicePrivacyChain: { isLocalWalletScanAllowed: async () => true },
      simpleDb: {
        privacyChainState: {
          isAccountDeletionPending: async () => false,
          getZcashPrivacyModeState: async ({
            accountId,
          }: {
            accountId: string;
          }) => states[accountId],
        },
      },
    },
    listLocalWalletAccounts: async () => ({
      accounts: Object.entries(states).map(([accountId, state]) => ({
        accountId,
        runtimeKey: ZCASH_NETWORK_MAIN,
        syncEnabled: state.intent === 'on',
      })),
    }),
    zcashResumePendingRescans: async () => undefined,
    zcashHasAccountViewingKey: async () => true,
    zcashPrepareAccounts: async ({ accountIds }: { accountIds: string[] }) =>
      accountIds.map((ufvk) => ({ ufvk })),
    zcashGetWalletAccount: async () => ({ ufvk: 'a' }),
    zcashGetApi: async () => ({ syncWallet }),
    queueLocalWalletRescanFrom: async ({
      fromHeight,
    }: {
      fromHeight: number;
    }) => {
      pendingHeights.add(fromHeight);
    },
  });
  const enable = vault.zcashPreparePrivacyModeAccount({
    accountId: 'a',
    fromHeight: 2_000_000,
    onPrepared: async () => {
      beginAdmission?.();
      await admission;
      states.a = { intent: 'on' };
    },
  });
  await admitted;
  const peer = vault.syncLocalWalletGroup({ accountIds: ['b'] });
  await Promise.resolve();
  expect(syncWallet).not.toHaveBeenCalled();
  finishAdmission?.();
  await Promise.all([enable, peer]);
  expect(syncWallet.mock.calls[0][1].activeUfvks).toEqual(['a', 'b']);
  expect(discovered.has('note-a')).toBe(true);
});

// A key the store lost waits for Repair; the other accounts keep scanning.
it('scans without an account whose viewing key cannot be read', async () => {
  const states: Record<string, IZcashPrivacyModeStateView> = {
    a: { intent: 'on' },
    lost: { intent: 'on', birthdayHeight: 2_000_000 },
  };
  const syncWallet = jest.fn(
    async (_account: unknown, _options: { activeUfvks: string[] }) => ({
      stateChanged: false,
    }),
  );
  const zcashPrepareAccounts = jest.fn(
    async ({ accountIds }: { accountIds: string[] }) =>
      accountIds.map((id) => ({ ufvk: id })),
  );
  const markPrivacyModeScanExcluded = jest.fn(async () => undefined);
  const vault = Object.assign(Object.create(Vault.prototype) as Vault, {
    backgroundApi: {
      servicePrivacyChain: { isLocalWalletScanAllowed: async () => true },
      simpleDb: {
        privacyChainState: {
          isAccountDeletionPending: async () => false,
          getZcashPrivacyModeState: async ({
            accountId,
          }: {
            accountId: string;
          }) => states[accountId],
          getZcashAccountMeta: async () => undefined,
          markZcashScanExcluded: markPrivacyModeScanExcluded,
        },
      },
    },
    listLocalWalletAccounts: async () => ({
      accounts: Object.keys(states).map((accountId) => ({
        accountId,
        runtimeKey: ZCASH_NETWORK_MAIN,
        accountRuntimeKey: accountId,
        syncEnabled: true,
      })),
    }),
    zcashResumePendingRescans: async () => undefined,
    zcashHasAccountViewingKey: async ({ accountId }: { accountId: string }) =>
      accountId !== 'lost',
    getLocalWalletSyncProgress: async () => ({ birthdayHeight: null }),
    zcashPrepareAccounts,
    zcashGetWalletAccount: async () => ({ ufvk: 'a' }),
    zcashGetApi: async () => ({ syncWallet }),
  });

  await expect(
    vault.syncLocalWalletGroup({ accountIds: ['a', 'lost'] }),
  ).resolves.toMatchObject({ synced: true });

  expect(zcashPrepareAccounts).toHaveBeenCalledWith({
    accountIds: ['a'],
    chainTip: undefined,
  });
  expect(syncWallet.mock.calls[0][1].activeUfvks).toEqual(['a']);
  // Its scan resumes from here once Repair restores the key.
  expect(markPrivacyModeScanExcluded).toHaveBeenCalledWith({
    accountId: 'lost',
    fromHeight: 2_000_000,
  });
});

describe('runtime registration during background group sync', () => {
  beforeEach(() => {
    forgetOpenWallet('main');
    jest.clearAllMocks();
  });
  afterEach(() => jest.restoreAllMocks());

  async function createVault() {
    const registered = new Set<string>();
    const scan = { allowPending: false, remaining: 0, scanned: 2_000_000 };
    const failure = Object.assign(new Error('DATABASE_ERROR'), {
      payload: {
        code: 'DATABASE_ERROR',
        params: { operation: 'importAccount' },
        detail: 'retains checkpoints both above and below the requested height',
      },
    });
    jest
      .mocked(runtime.accountByUfvk)
      .mockImplementation((ufvk) =>
        JSON.stringify(registered.has(ufvk) ? { uuid: ufvk } : null),
      );
    jest
      .mocked(runtime.importAccountUfvk)
      .mockImplementation(async (_name, ufvk) => {
        if (ufvk === 'pending' && !scan.allowPending) throw failure;
        registered.add(ufvk);
        return ufvk;
      });
    jest
      .mocked(runtime.listAccounts)
      .mockImplementation(() => JSON.stringify([...registered]));
    jest.mocked(runtime.accountBalance).mockImplementation(() =>
      JSON.stringify({
        chainTip: 3_000_000,
        fullyScannedHeight: scan.scanned,
      }),
    );
    jest.mocked(runtime.accountSyncStatus).mockImplementation(() =>
      JSON.stringify({
        birthdayHeight: 2_000_000,
        chainTip: 3_000_000,
        scannedToHeight: scan.scanned,
        remainingBlocks: scan.remaining,
        isComplete: scan.remaining === 0,
      }),
    );
    jest
      .mocked(runtime.syncPeek)
      .mockImplementation(() =>
        JSON.stringify({ totalBlocks: scan.remaining }),
      );
    jest.mocked(runtime.syncStep).mockImplementation(async () => {
      const blocksScanned = scan.remaining > 0 ? 1 : 0;
      scan.remaining -= blocksScanned;
      scan.scanned += blocksScanned;
      return JSON.stringify({ blocksScanned, done: scan.remaining === 0 });
    });
    const api = await sdk.getZcashApi();
    const syncWallet = jest.spyOn(api, 'syncWallet');
    const rotateAccountEpochs = jest.fn(async () => undefined);
    const vault = Object.assign(Object.create(Vault.prototype) as Vault, {
      networkId: 'zec--0',
      backgroundApi: {
        servicePrivacyChain: {
          isLocalWalletScanAllowed: jest.fn(async () => true),
        },
        simpleDb: {
          privacyChainState: {
            isAccountDeletionPending: async () => false,
            getAccountEpoch: async () => undefined,
            getZcashAccountMeta: async () => undefined,
            getZcashPrivacyModeState: async () => ({ intent: 'on' }),
            listAccountIds: async () => ['pending', 'healthy'],
            rotateAccountEpochs,
          },
        },
      },
      listLocalWalletAccounts: async () => ({
        accounts: ['pending', 'healthy'].map((accountId) => ({
          accountId,
          runtimeKey: 'main',
          accountRuntimeKey: accountId,
          syncEnabled: true,
        })),
      }),
      zcashHasAccountViewingKey: async () => true,
      zcashResumePendingRescans: async () => undefined,
      zcashHealOutOfRangeBirthdays: async () => undefined,
      zcashGetWalletAccount: async ({ accountId }: { accountId: string }) => ({
        network: 'main',
        ufvk: accountId,
        hdIndex: accountId === 'pending' ? 0 : 1,
        birthdayHeight: 2_000_000,
        seedFingerprintHex: 'synthetic-fingerprint',
        lightwalletdUrl: 'https://example.invalid',
      }),
      zcashGetApi: async () => api,
    });
    return { vault, scan, syncWallet, rotateAccountEpochs };
  }

  it('keeps other accounts scanning without deleting data, and retries registration only after scan progress', async () => {
    const { vault, scan, syncWallet, rotateAccountEpochs } =
      await createVault();
    const params = { accountIds: ['pending', 'healthy'], chainTip: 3_000_000 };
    await expect(vault.syncLocalWalletGroup(params)).resolves.toMatchObject({
      synced: true,
      stateChanged: false,
    });
    expect(syncWallet).toHaveBeenLastCalledWith(
      expect.objectContaining({ ufvk: 'healthy' }),
      { activeUfvks: ['healthy'], chainTip: 3_000_000 },
    );
    expect(runtime.importAccountUfvk).toHaveBeenCalledTimes(2);
    await vault.syncLocalWalletGroup(params);
    expect(runtime.importAccountUfvk).toHaveBeenCalledTimes(2);

    scan.remaining = 1;
    await expect(vault.syncLocalWalletGroup(params)).resolves.toMatchObject({
      synced: true,
      stateChanged: true,
      backfillRemaining: true,
    });
    expect(runtime.importAccountUfvk).toHaveBeenCalledTimes(2);
    scan.allowPending = true;
    await vault.syncLocalWalletGroup(params);
    expect(runtime.importAccountUfvk).toHaveBeenCalledTimes(3);
    expect(syncWallet).toHaveBeenLastCalledWith(
      expect.objectContaining({ ufvk: 'pending' }),
      { activeUfvks: ['pending', 'healthy'], chainTip: 3_000_000 },
    );
    expect(runtime.deleteWallet).not.toHaveBeenCalled();
    expect(rotateAccountEpochs).not.toHaveBeenCalled();
  });

  it('still rotates every epoch and rebuilds for actual SQLite corruption', async () => {
    const { vault, rotateAccountEpochs } = await createVault();
    const corruption = Object.assign(new Error('DATABASE_ERROR'), {
      code: 'DATABASE_ERROR',
      params: { operation: 'syncStep' },
      detail: 'database disk image is malformed',
    });
    jest.mocked(runtime.syncPeek).mockImplementationOnce(() => {
      throw corruption;
    });
    await expect(
      vault.syncLocalWalletGroup({
        accountIds: ['pending', 'healthy'],
        chainTip: 3_000_000,
      }),
    ).resolves.toEqual({ synced: false });
    expect(rotateAccountEpochs).toHaveBeenCalledWith({
      accountIds: ['pending', 'healthy'],
    });
    expect(runtime.deleteWallet).toHaveBeenCalledWith('zcash-main.db');
    expect(rotateAccountEpochs.mock.invocationCallOrder[0]).toBeLessThan(
      jest.mocked(runtime.deleteWallet).mock.invocationCallOrder[0],
    );
  });

  it('propagates a locked migration without rebuilding or rotating epochs', async () => {
    const { vault, rotateAccountEpochs } = await createVault();
    forgetOpenWallet('main');
    const locked = Object.assign(new Error('DATABASE_ERROR'), {
      payload: {
        code: 'DATABASE_ERROR',
        params: { operation: 'migrate' },
        detail: 'database is locked',
      },
    });
    jest.mocked(runtime.openWallet).mockRejectedValueOnce(locked);
    await expect(
      vault.syncLocalWalletGroup({ accountIds: ['pending', 'healthy'] }),
    ).rejects.toBe(locked);
    expect(runtime.deleteWallet).not.toHaveBeenCalled();
    expect(rotateAccountEpochs).not.toHaveBeenCalled();
  });
});

it('excludes a stale deletion candidate without blocking a healthy account', async () => {
  const syncWallet = jest.fn(async () => ({ stateChanged: true }));
  const zcashPrepareAccounts = jest.fn(
    async ({ accountIds }: { accountIds: string[] }) =>
      accountIds.map((ufvk) => ({ ufvk })),
  );
  const vault = Object.assign(Object.create(Vault.prototype) as Vault, {
    backgroundApi: {
      servicePrivacyChain: { isLocalWalletScanAllowed: async () => true },
      simpleDb: {
        privacyChainState: {
          isAccountDeletionPending: async ({
            accountId,
          }: {
            accountId: string;
          }) => accountId === 'a',
          getZcashPrivacyModeState: async () => ({ intent: 'on' }),
        },
      },
    },
    listLocalWalletAccounts: async () => ({
      accounts: ['a', 'b'].map((accountId) => ({
        accountId,
        runtimeKey: ZCASH_NETWORK_MAIN,
        accountRuntimeKey: accountId,
        syncEnabled: true,
      })),
    }),
    zcashHasAccountViewingKey: async () => true,
    zcashResumePendingRescans: async () => undefined,
    zcashPrepareAccounts,
    zcashGetApi: async () => ({ syncWallet }),
  });
  await expect(
    vault.syncLocalWalletGroup({ accountIds: ['a', 'b'] }),
  ).resolves.toMatchObject({ synced: true });
  expect(zcashPrepareAccounts).toHaveBeenCalledWith(
    expect.objectContaining({ accountIds: ['b'] }),
  );
  expect(syncWallet).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ activeUfvks: ['b'] }),
  );
});

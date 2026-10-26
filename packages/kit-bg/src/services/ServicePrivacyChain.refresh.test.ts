import { SimpleDbEntityPrivacyChainCache } from '../dbs/simple/entity/SimpleDbEntityPrivacyChainCache';
import { SimpleDbEntityPrivacyChainState } from '../dbs/simple/entity/SimpleDbEntityPrivacyChainState';

import type { ILocalWalletSyncProgress } from '../vaults/localWallet/types';

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => {
  const actual = jest.requireActual<
    typeof import('@onekeyhq/shared/src/background/backgroundDecorators')
  >('@onekeyhq/shared/src/background/backgroundDecorators');
  const passthrough =
    () => (_target: unknown, _key?: string, descriptor?: PropertyDescriptor) =>
      descriptor;
  return {
    ...actual,
    backgroundClass: passthrough,
    backgroundMethod: passthrough,
  };
});
const mockGetChainOnlyVault = jest.fn();
jest.mock('../vaults/factory', () => ({
  vaultFactory: { getChainOnlyVault: mockGetChainOnlyVault },
}));
const mockPublish = jest.fn(async (_updater: unknown) => undefined);
jest.mock('../states/jotai/atoms', () => ({
  privacyChainAtom: { set: (updater: unknown) => mockPublish(updater) },
}));

const ServicePrivacyChain = require('./ServicePrivacyChain')
  .default as typeof import('./ServicePrivacyChain').default;
const networkId = 'zec--0';
const accountId = 'hd-1--0';
const params = { networkId, accountId };
const completeProgress: ILocalWalletSyncProgress = {
  birthdayHeight: 100,
  backfillScannedHeight: 200,
  backfillTargetHeight: 200,
  backfillProgress: 1,
  isBackfillComplete: true,
  tipScannedHeight: 200,
  chainTip: 200,
  tipLag: 0,
  isTipCaughtUp: true,
  isSyncing: false,
};

async function createHarness() {
  const state = new SimpleDbEntityPrivacyChainState();
  const cache = new SimpleDbEntityPrivacyChainCache();
  for (const entity of [state, cache]) {
    let saved: unknown = null;
    Reflect.set(entity, 'appStorage', {
      getItem: async () => saved,
      setItem: async (_key: string, value: unknown) => {
        saved = value;
      },
      removeItem: async () => {
        saved = null;
      },
    });
  }
  await state.beginZcashPrivacyModeEnable({ ...params, birthdayHeight: 100 });
  await state.saveZcashAccountMeta({
    accountId,
    meta: {
      vkFp: 'a'.repeat(32),
      unifiedAddress: 'u-test',
      transparentAddress: 't-test',
      seedFingerprintHex: 'b'.repeat(64),
      hdIndex: 0,
      birthdayHeight: 100,
      birthdaySource: 'manual-height',
      createdAt: 1,
    },
  });
  await state.completeZcashPrivacyModeEnable({ accountId });
  const getSyncProgress = jest.fn(async () => completeProgress);
  const capability = {
    getAccountState: () =>
      state
        .getZcashPrivacyModeState({ accountId })
        .then((v) => ({ enabled: v.intent === 'on', paused: false })),
    getSyncProgress,
  };
  mockGetChainOnlyVault.mockResolvedValue({
    getLocalWalletCapability: () => capability,
  });
  const service = Object.assign(
    Object.create(ServicePrivacyChain.prototype) as InstanceType<
      typeof ServicePrivacyChain
    >,
    {
      backgroundApi: {
        simpleDb: { privacyChainState: state, privacyChainCache: cache },
        serviceAccount: {
          getDBAccountSafe: async () => ({ id: accountId }),
          getWalletSafe: async () => ({ isTemp: false }),
        },
      },
      runtimeSyncState: new Map([
        ['zec--0|main', { accountSignature: accountId, lastChainTip: 200 }],
        ['xmr--0|main', { accountSignature: 'other', lastChainTip: 300 }],
      ]),
      boostPausedByNetwork: {},
    },
  );
  const epoch = (await state.getAccountEpoch({ accountId }))!;
  const candidate = {
    networkId,
    runtimeStateKey: 'zec--0|main',
    accountIds: [accountId],
    accountSignature: accountId,
    chainTip: 200,
    reason: 'tip',
    capability,
  } as unknown as Parameters<typeof service.publishScanProgress>[0];
  return { service, state, cache, epoch, candidate, getSyncProgress };
}

afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

it('records completed syncs even when the balance is unchanged, and never records a UI-only progress read', async () => {
  const { service, cache, epoch, candidate } = await createHarness();
  await service.publishScanProgress(candidate);
  expect(await service.getLocalWalletLastSyncedAt(params)).toBeUndefined();
  jest.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
  await service.publishScanProgress(candidate, new Map([[accountId, epoch]]));
  expect(await service.getLocalWalletLastSyncedAt(params)).toBe(
    1_700_000_000_000,
  );
  expect(await cache.getLastBalance({ accountId })).toBeUndefined();
  jest.spyOn(Date, 'now').mockReturnValue(1_700_000_060_000);
  await service.publishScanProgress(candidate, new Map([[accountId, epoch]]));
  expect(await service.getLocalWalletLastSyncedAt(params)).toBe(
    1_700_000_060_000,
  );
  expect(
    await service.getLocalWalletLastSyncedAt({
      ...params,
      networkId: 'xmr--0',
    }),
  ).toBeUndefined();
});

it.each(['pending birthday', 'deleted', 'new epoch'])(
  'does not record an old successful pass when %s',
  async (condition) => {
    const { service, state, cache, epoch, candidate } = await createHarness();
    if (condition === 'pending birthday') {
      await state.saveZcashPendingRescan({
        accountId,
        repair: {
          birthdayHeight: 50,
          birthdaySource: 'manual-height',
          requestedAt: 1,
        },
      });
      expect(await state.getAccountEpoch({ accountId })).toBe(epoch);
    }
    if (condition === 'deleted') await state.requestAccountDeletion(params);
    if (condition === 'new epoch')
      await state.rotateAccountEpochs({ accountIds: [accountId] });
    await service.publishScanProgress(candidate, new Map([[accountId, epoch]]));
    expect(await cache.getLastSync({ accountId })).toBeUndefined();
    expect(await service.getLocalWalletLastSyncedAt(params)).toBeUndefined();
  },
);

it('hides a previously recorded update as soon as a new birthday request is accepted', async () => {
  const { service, state, epoch, candidate } = await createHarness();
  await service.publishScanProgress(candidate, new Map([[accountId, epoch]]));
  expect(await service.getLocalWalletLastSyncedAt(params)).toEqual(
    expect.any(Number),
  );
  await state.saveZcashPendingRescan({
    accountId,
    repair: {
      birthdayHeight: 50,
      birthdaySource: 'manual-height',
      requestedAt: 1,
    },
  });
  expect(await service.getLocalWalletLastSyncedAt(params)).toBeUndefined();
});

it('keeps the last successful time visible on pause without recording a late scan as a new success', async () => {
  const { service, state, cache, epoch, candidate } = await createHarness();
  jest.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
  await service.publishScanProgress(candidate, new Map([[accountId, epoch]]));
  await state.beginZcashPrivacyModeDisable({
    accountId,
    resumeFromHeight: 150,
  });
  await state.completeZcashPrivacyModeDisable({ accountId });
  expect(await state.isAccountSyncCurrent({ accountId, epoch })).toBe(false);
  expect(await service.getLocalWalletLastSyncedAt(params)).toBe(
    1_700_000_000_000,
  );
  jest.spyOn(Date, 'now').mockReturnValue(1_700_000_060_000);
  await service.publishScanProgress(candidate, new Map([[accountId, epoch]]));
  expect((await cache.getLastSync({ accountId }))?.syncedAt).toBe(
    1_700_000_000_000,
  );
  expect(await service.getLocalWalletLastSyncedAt(params)).toBe(
    1_700_000_000_000,
  );
  await state.requestAccountDeletion(params);
  expect(await service.getLocalWalletLastSyncedAt(params)).toBeUndefined();
});

it.each(['account', 'network', 'all'])(
  'clears successful update records with %s cleanup and makes timestamp-only records discoverable to GC',
  async (scope) => {
    const { service, cache, epoch, candidate } = await createHarness();
    await service.publishScanProgress(candidate, new Map([[accountId, epoch]]));
    await cache.setLastSync({
      accountId: 'other',
      record: { networkId: 'xmr--0', epoch: 'other', syncedAt: 10 },
      isCurrent: async () => true,
    });
    expect(await cache.listLastBalanceAccountIds()).toEqual(
      expect.arrayContaining([accountId, 'other']),
    );
    if (scope === 'account')
      await cache.removeLastBalances({ accountIds: [accountId] });
    else if (scope === 'network')
      await cache.removeNetworkLastBalances({ networkId });
    else await cache.clearBalances();
    expect(await cache.getLastSync({ accountId })).toBeUndefined();
    expect(
      (await cache.getLastSync({ accountId: 'other' })) !== undefined,
    ).toBe(scope !== 'all');
  },
);

it('schedules an explicit refresh through Resume and forces a check even at an unchanged tip', async () => {
  const { service } = await createHarness();
  const start = jest
    .spyOn(service, 'startForegroundBoost')
    .mockResolvedValue(undefined);
  await service.refreshLocalWalletAccount(params);
  expect(start).toHaveBeenCalledWith({ ...params, trigger: 'manual-sync' });
  expect(service.runtimeSyncState.has('zec--0|main')).toBe(false);
  expect(service.runtimeSyncState.has('xmr--0|main')).toBe(true);
  expect(await service.getLocalWalletLastSyncedAt(params)).toBeUndefined();
});

it('leaves a paused chain paused when the balance is refreshed', async () => {
  const { service } = await createHarness();
  service.boostPausedByNetwork[networkId] = true;
  const start = jest
    .spyOn(service, 'startForegroundBoost')
    .mockResolvedValue(undefined);
  await service.refreshLocalWalletAccount(params);
  expect(start).not.toHaveBeenCalled();
  expect(service.boostPausedByNetwork[networkId]).toBe(true);
});

it('does not use stale display progress to establish success, and does not lose authoritative success to a failed display read', async () => {
  const { service, cache, epoch, candidate, getSyncProgress } =
    await createHarness();
  await service.publishScanProgress(candidate, new Map());
  expect(await cache.getLastSync({ accountId })).toBeUndefined();
  getSyncProgress.mockRejectedValueOnce(new Error('display unavailable'));
  const log = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  await service.publishScanProgress(candidate, new Map([[accountId, epoch]]));
  expect(await service.getLocalWalletLastSyncedAt(params)).toEqual(
    expect.any(Number),
  );
  expect(log).toHaveBeenCalled();
});

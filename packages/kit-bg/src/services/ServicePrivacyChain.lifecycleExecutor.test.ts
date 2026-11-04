import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { createMemoryStorage } from '@onekeyhq/shared/src/test-utils/mocks/memoryStorage';
import { travelModeManager } from '@onekeyhq/shared/src/travelMode';
import type { IRuntimeEnvironment } from '@onekeyhq/shared/src/travelMode/runtimeEnvironment';

import { SimpleDbEntityPrivacyChainCache } from '../dbs/simple/entity/SimpleDbEntityPrivacyChainCache';
import { SimpleDbEntityPrivacyChainState } from '../dbs/simple/entity/SimpleDbEntityPrivacyChainState';
import {
  LOCAL_WALLET_LIFECYCLE,
  LOCAL_WALLET_LIFECYCLE_STEPS,
} from '../vaults/localWallet/lifecycle';
import {
  readLocalWalletBalanceStaleFirst,
  saveLastLocalWalletBalance,
} from '../vaults/localWallet/privacyChainCacheStore';

import type { IBackgroundApi } from '../apis/IBackgroundApi';
import type {
  ILocalWalletDataClass,
  ILocalWalletLifecycleEvent,
  ILocalWalletLifecycleStep,
} from '../vaults/localWallet/lifecycle';
import type { ILocalWalletCapability } from '../vaults/localWallet/types';

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators');
const mockGetChainOnlyVault = jest.fn();
jest.mock('../vaults/factory', () => ({
  vaultFactory: { getChainOnlyVault: mockGetChainOnlyVault },
}));
const mockAtomSet = jest.fn(async (_update: unknown) => undefined);
jest.mock('../states/jotai/atoms', () => ({
  privacyChainAtom: {
    set: (update: unknown) => mockAtomSet(update),
  },
}));

const ServicePrivacyChain = require('./ServicePrivacyChain')
  .default as typeof import('./ServicePrivacyChain').default;

type IService = InstanceType<typeof ServicePrivacyChain>;

const networkId = 'zec--0';
const accountId = 'hd-1--0';

type IRecorded = ILocalWalletDataClass | 'rotateEpoch' | 'stopScheduling';

function createHarness() {
  const calls: IRecorded[] = [];
  const record =
    (name: IRecorded, result?: unknown) =>
    async (..._args: unknown[]) => {
      calls.push(name);
      return result;
    };
  const capability = {
    deleteRuntimeAccount: jest.fn(record('runtimeRows', { orphaned: false })),
    rewindAccount: jest.fn(record('runtimeRows')),
    rescan: jest.fn(record('runtimeRows', { fromHeight: 1 })),
    dropLocalData: jest.fn(record('runtimeRows')),
    disableAccount: jest.fn(record('accountState')),
    clearPendingSends: jest.fn(record('zcashTransparentJournal')),
    forgetMemoryCaches: jest.fn(record('memoryCaches')),
    recoverFromTimeout: jest.fn(record('stopScheduling', true)),
  } as unknown as ILocalWalletCapability;
  const backgroundApi = {
    simpleDb: {
      privacyChainState: {
        rotateAccountEpochs: jest.fn(record('rotateEpoch')),
        removeAccount: jest.fn(record('accountState')),
        removeNetworkAccounts: jest.fn(record('accountState')),
        clearAccountScanData: jest.fn(record('accountState')),
        markRuntimeOrphans: jest.fn(record('runtimeRows')),
        clearRuntimeOrphans: jest.fn(record('runtimeRows')),
        removeWalletState: jest.fn(record('walletState')),
        forgetAccountEpochs: jest.fn(record('memoryCaches')),
      },
      privacyChainKeys: {
        removeKeys: jest.fn(record('viewingKeys')),
        removeNetworkKeys: jest.fn(record('viewingKeys')),
      },
      privacyChainJournal: {
        removeAccounts: jest.fn(record('zcashTransparentJournal')),
      },
      privacyChainXmrSent: {
        removeAccounts: jest.fn(record('xmrSent')),
      },
      privacyChainZcashSent: {
        removeAccounts: jest.fn(record('zcashSent')),
      },
      privacyChainCache: {
        removeLastBalances: jest.fn(record('displayCaches')),
        removeNetworkLastBalances: jest.fn(record('displayCaches')),
        clearBalances: jest.fn(record('displayCaches')),
        removeChainTips: jest.fn(record('chainTips')),
      },
      localTokens: {
        removeAccountTokenList: jest.fn(record('genericStorage')),
      },
      accountValue: {
        removeAccountNetworkValue: jest.fn(record('genericStorage')),
      },
      localHistory: {
        clearAccountLocalHistory: jest.fn(record('localHistory')),
      },
    },
    serviceAccount: {
      getAccount: jest.fn(async () => ({ address: 't1account' })),
      getDBAccountSafe: jest.fn(async () => ({ id: accountId })),
      getAccountAddressForApi: jest.fn(async () => 't1account'),
      getAccountXpub: jest.fn(async () => undefined),
    },
  } as unknown as IBackgroundApi;
  const service = Object.assign(
    Object.create(ServicePrivacyChain.prototype) as IService,
    {
      backgroundApi,
      backfillActiveByAccount: {},
      boostPausedByNetwork: {},
      foregroundBoostRequestedByNetwork: {},
      syncFailureBackoff: new Map(),
      orphanCleanupGeneration: new Map(),
      syncTickRunning: false,
      schedulingHalted: false,
    },
  );
  const scheduleBackgroundSync = jest.fn();
  const publishBoostingNetworks = jest.fn(async () => undefined);
  service.scheduleBackgroundSync = scheduleBackgroundSync;
  service.publishBoostingNetworks = publishBoostingNetworks;
  service.getLocalWalletNetworkIds = jest.fn(async () => [networkId]);
  mockAtomSet.mockImplementation(async () => {
    calls.push('memoryCaches');
  });
  mockGetChainOnlyVault.mockResolvedValue({
    getLocalWalletCapability: () => capability,
  });
  return {
    service: Object.assign(service, {
      scheduleBackgroundSync,
      publishBoostingNetworks,
    }),
    capability,
    backgroundApi,
    calls,
  };
}

function targetFor(
  event: ILocalWalletLifecycleEvent,
  capability: ILocalWalletCapability,
) {
  if (event === 'clearCache' || event === 'travelMode') {
    return { scope: 'app' as const, accountIds: [] };
  }
  return {
    scope: event === 'appReset' ? ('network' as const) : ('accounts' as const),
    networkId,
    capability,
    accountIds: [accountId],
  };
}

const STEP_OF: Record<IRecorded, ILocalWalletLifecycleStep> = {
  stopScheduling: 'stopScheduling',
  rotateEpoch: 'rotateEpoch',
  runtimeRows: 'runtime',
  accountState: 'hostRecords',
  viewingKeys: 'hostRecords',
  zcashTransparentJournal: 'hostRecords',
  xmrSent: 'hostRecords',
  zcashSent: 'hostRecords',
  displayCaches: 'hostRecords',
  chainTips: 'hostRecords',
  walletState: 'hostRecords',
  deviceState: 'hostRecords',
  genericStorage: 'genericStorage',
  localHistory: 'genericStorage',
  memoryCaches: 'memory',
};

const SILENT_EFFECTS = new Set([
  'clearedWithAppStorage',
  'rewritePendingDrop',
  'pauseFlag',
]);

const events = Object.keys(
  LOCAL_WALLET_LIFECYCLE,
) as ILocalWalletLifecycleEvent[];

describe('privacy chain lifecycle executor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each(events)(
    '%s: touches exactly the data classes its table row changes, in step order',
    async (event) => {
      const { service, capability, calls } = createHarness();
      service.syncTickRunning = event === 'appReset';
      if (event === 'appReset') {
        (capability.recoverFromTimeout as jest.Mock).mockImplementation(
          async () => {
            calls.push('stopScheduling');
            service.syncTickRunning = false;
            return true;
          },
        );
      }
      await service.runLocalWalletLifecycle({
        event,
        targets: [targetFor(event, capability)],
        walletIds: ['hd-gone'],
      });

      const spec = LOCAL_WALLET_LIFECYCLE[event];
      const expected = new Set<IRecorded>(
        (
          Object.entries(spec.effects) as [ILocalWalletDataClass, string][]
        ).flatMap(([dataClass, effect]) =>
          effect === 'keep' || SILENT_EFFECTS.has(effect) ? [] : [dataClass],
        ),
      );
      if (spec.rotateEpoch) expected.add('rotateEpoch');
      if (spec.stopScheduling === 'waitForTick') expected.add('stopScheduling');
      expect([...new Set(calls)].toSorted()).toEqual([...expected].toSorted());

      const runtimeAt = calls.indexOf('runtimeRows');
      const steps = calls.map((name, index) =>
        LOCAL_WALLET_LIFECYCLE_STEPS.indexOf(
          name === 'rotateEpoch' && runtimeAt !== -1 && index > runtimeAt
            ? 'settleEpoch'
            : STEP_OF[name],
        ),
      );
      expect(steps).toEqual(steps.toSorted((a, b) => a - b));
      expect(calls.filter((name) => name === 'rotateEpoch')).toHaveLength(
        spec.rotateEpoch ? 2 : 0,
      );
    },
  );

  it('notifies the UI only for events whose table row says so', async () => {
    const emit = jest.spyOn(appEventBus, 'emit');
    for (const event of events) {
      const { service, capability } = createHarness();
      emit.mockClear();
      await service.runLocalWalletLifecycle({
        event,
        targets: [targetFor(event, capability)],
      });
      const refreshed = emit.mock.calls.some(
        ([name]) => name === EAppEventBusNames.RefreshTokenList,
      );
      const notifies =
        LOCAL_WALLET_LIFECYCLE[event].notify && event !== 'networkPause';
      expect({ event, refreshed }).toEqual({ event, refreshed: notifies });
    }
    emit.mockRestore();
  });

  it('network pause is a session flag only', async () => {
    const { service, calls } = createHarness();
    await service.runLocalWalletLifecycle({
      event: 'networkPause',
      targets: [{ scope: 'accounts', networkId, accountIds: [] }],
    });
    expect(service.boostPausedByNetwork[networkId]).toBe(true);
    expect(calls).toEqual([]);
    expect(service.publishBoostingNetworks).toHaveBeenCalled();
  });

  it('clear cache never reaches the runtime', async () => {
    const { service, capability } = createHarness();
    await service.runLocalWalletLifecycle({
      event: 'clearCache',
      targets: [{ scope: 'app', accountIds: [] }],
    });
    for (const method of [
      'deleteRuntimeAccount',
      'rewindAccount',
      'rescan',
      'dropLocalData',
    ] as const) {
      expect(capability[method]).not.toHaveBeenCalled();
    }
    expect(capability.forgetMemoryCaches).toHaveBeenCalledWith({});
  });

  it('a runtime delete that may leave rows nothing names marks the network', async () => {
    const { service, capability, backgroundApi } = createHarness();
    (capability.deleteRuntimeAccount as jest.Mock).mockResolvedValue({
      orphaned: true,
    });
    await service.runLocalWalletLifecycle({
      event: 'deleteAccount',
      targets: [targetFor('deleteAccount', capability)],
    });
    expect(
      backgroundApi.simpleDb.privacyChainState.markRuntimeOrphans,
    ).toHaveBeenCalledWith({ networkId });
  });

  it('a failed runtime delete keeps every host record for the next attempt', async () => {
    const { service, capability, calls } = createHarness();
    (capability.deleteRuntimeAccount as jest.Mock).mockRejectedValue(
      new Error('runtime down'),
    );
    await expect(
      service.runLocalWalletLifecycle({
        event: 'deleteAccount',
        targets: [targetFor('deleteAccount', capability)],
      }),
    ).rejects.toThrow('runtime down');
    expect(calls).toEqual(['rotateEpoch']);
  });

  it('App Reset skips the host records of a network whose drop failed and reports it', async () => {
    const { service, capability, calls } = createHarness();
    (capability.dropLocalData as jest.Mock).mockRejectedValue(
      new Error('stuck'),
    );
    await expect(
      service.runLocalWalletLifecycle({
        event: 'appReset',
        targets: [targetFor('appReset', capability)],
      }),
    ).resolves.toEqual({ failedNetworkIds: [networkId] });
    expect(calls).toEqual([]);
  });

  it('travel mode stops every timer for good', async () => {
    const { service } = createHarness();
    service.schedulingHalted = false;
    service.syncTimer = setTimeout(() => undefined, 60_000);
    service.periodicSyncTimer = setInterval(() => undefined, 60_000);
    await service.runLocalWalletLifecycle({
      event: 'travelMode',
      targets: [{ scope: 'app', accountIds: [] }],
    });
    expect(service.syncTimer).toBeUndefined();
    expect(service.periodicSyncTimer).toBeUndefined();
    expect(service.schedulingHalted).toBe(true);
  });
});

describe('privacy chain lifecycle executor: failures, timers and Travel Mode', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('finishes cache and memory cleanup but reports a failed viewing-key deletion', async () => {
    const { service, capability, backgroundApi, calls } = createHarness();
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const error = new Error('key deletion could not be persisted');
    (
      backgroundApi.simpleDb.privacyChainKeys.removeKeys as jest.Mock
    ).mockRejectedValue(error);
    await expect(
      service.runLocalWalletLifecycle({
        event: 'deleteLocalData',
        targets: [targetFor('deleteLocalData', capability)],
      }),
    ).rejects.toBe(error);
    expect(calls).toContain('displayCaches');
    expect(calls).toContain('memoryCaches');
    expect(service.scheduleBackgroundSync).toHaveBeenCalled();
  });

  it('reports a network for App Reset retry when its Runtime was dropped but its key deletion failed', async () => {
    const { service, capability, backgroundApi } = createHarness();
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    (
      backgroundApi.simpleDb.privacyChainKeys.removeNetworkKeys as jest.Mock
    ).mockRejectedValue(new Error('key deletion could not be persisted'));
    await expect(
      service.runLocalWalletLifecycle({
        event: 'appReset',
        targets: [targetFor('appReset', capability)],
      }),
    ).resolves.toEqual({ failedNetworkIds: [networkId] });
    expect(capability.dropLocalData).toHaveBeenCalled();
    expect(
      backgroundApi.simpleDb.privacyChainKeys.removeNetworkKeys,
    ).toHaveBeenCalledWith({ networkId });
  });

  it('once runtime data is gone, a later failure still lets cleanup, memory and notify run', async () => {
    const { service, capability, backgroundApi, calls } = createHarness();
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    (
      backgroundApi.simpleDb.privacyChainCache.removeLastBalances as jest.Mock
    ).mockRejectedValue(new Error('storage busy'));
    (
      backgroundApi.serviceAccount.getDBAccountSafe as jest.Mock
    ).mockImplementation(async ({ accountId: id }: { accountId: string }) =>
      id === 'hd-gone--0' ? undefined : { id },
    );
    (
      backgroundApi.serviceAccount.getAccountAddressForApi as jest.Mock
    ).mockImplementation(async ({ accountId: id }: { accountId: string }) => {
      if (id === 'hd-gone--0') throw new OneKeyLocalError('account not found');
      return 't1account';
    });

    await expect(
      service.runLocalWalletLifecycle({
        event: 'rescan',
        targets: [
          {
            scope: 'accounts',
            networkId,
            capability,
            accountIds: ['hd-gone--0', accountId],
            runtimeAccountIds: [accountId],
          },
        ],
      }),
    ).resolves.toEqual({ failedNetworkIds: [] });

    expect(
      backgroundApi.simpleDb.localHistory.clearAccountLocalHistory,
    ).toHaveBeenCalledTimes(1);
    expect(calls).toContain('memoryCaches');
    expect(service.backfillActiveByAccount[accountId]).toBe(true);
    expect(service.scheduleBackgroundSync).toHaveBeenCalled();
  });

  it('a failure before the runtime step still stops the event', async () => {
    const { service, capability, backgroundApi, calls } = createHarness();
    (
      backgroundApi.simpleDb.privacyChainState.rotateAccountEpochs as jest.Mock
    ).mockRejectedValue(new Error('storage busy'));

    await expect(
      service.runLocalWalletLifecycle({
        event: 'deleteLocalData',
        targets: [targetFor('deleteLocalData', capability)],
      }),
    ).rejects.toThrow('storage busy');
    expect(calls).toEqual([]);
  });

  it('the wipe retry at startup leaves the first scheduled tick in place', async () => {
    const { service, capability } = createHarness();
    const firstTick = setTimeout(() => undefined, 60_000);
    service.syncTimer = firstTick;

    await service.runLocalWalletLifecycle({
      event: 'appReset',
      targets: [targetFor('appReset', capability)],
    });

    expect(service.syncTimer).toBe(firstTick);
    clearTimeout(firstTick);
  });

  function maskPersistence() {
    return jest
      .spyOn(travelModeManager, 'getRuntimeEnvironment')
      .mockResolvedValue({
        persistence: { kind: 'masked' },
      } as unknown as IRuntimeEnvironment);
  }

  it.each([
    'deleteAccount',
    'deleteWallet',
    'deleteLocalData',
    'resetSyncStorage',
    'rescan',
  ] as const)(
    '%s is refused while Travel Mode masks the records naming the data',
    async (event) => {
      const { service, capability, calls } = createHarness();
      maskPersistence();

      await expect(
        service.runLocalWalletLifecycle({
          event,
          targets: [targetFor(event, capability)],
        }),
      ).rejects.toThrow('Travel Mode');
      expect(calls).toEqual([]);
    },
  );

  it.each(['appReset', 'travelMode', 'clearCache', 'disable'] as const)(
    '%s still runs while persistence is masked',
    async (event) => {
      const { service, capability, calls } = createHarness();
      maskPersistence();

      await service.runLocalWalletLifecycle({
        event,
        targets: [targetFor(event, capability)],
      });
      expect(calls.length).toBeGreaterThan(0);
    },
  );
});

describe('privacy chain cache write-back racing a delete', () => {
  function memoryStorage() {
    const storage = createMemoryStorage(null);
    return storage;
  }

  function createRealHarness() {
    const harness = createHarness();
    const privacyChainState = new SimpleDbEntityPrivacyChainState();
    (privacyChainState as { appStorage: unknown }).appStorage = memoryStorage();
    const privacyChainCache = new SimpleDbEntityPrivacyChainCache();
    (privacyChainCache as { appStorage: unknown }).appStorage = memoryStorage();
    const { simpleDb } = harness.backgroundApi as unknown as {
      simpleDb: Record<string, unknown>;
    };
    simpleDb.privacyChainState = privacyChainState;
    simpleDb.privacyChainCache = privacyChainCache;
    return { ...harness, privacyChainState, privacyChainCache };
  }

  async function seedRecord(
    privacyChainState: SimpleDbEntityPrivacyChainState,
  ) {
    await privacyChainState.beginXmrEnable({
      networkId,
      accountId,
      birthdayHeight: 100,
    });
    await privacyChainState.completeXmrEnable({ accountId });
  }

  async function deleteLocalData(
    service: IService,
    capability: ILocalWalletCapability,
  ) {
    await service.runLocalWalletLifecycle({
      event: 'deleteLocalData',
      targets: [targetFor('deleteLocalData', capability)],
    });
  }

  it('drops a write-back whose read started before the delete', async () => {
    const { service, capability, backgroundApi, privacyChainState } =
      createRealHarness();
    await seedRecord(privacyChainState);
    let finishRead: (value: string) => void = () => undefined;
    const reading = readLocalWalletBalanceStaleFirst({
      backgroundApi,
      networkId,
      accountId,
      read: () =>
        new Promise<string>((resolve) => {
          finishRead = resolve;
        }),
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    await deleteLocalData(service, capability);
    finishRead('balance of deleted data');
    await reading;

    await expect(
      backgroundApi.simpleDb.privacyChainCache.getLastBalance({ accountId }),
    ).resolves.toBeUndefined();
  });

  it('a write-back that landed first is deleted by the delete', async () => {
    const { service, capability, backgroundApi, privacyChainState } =
      createRealHarness();
    await seedRecord(privacyChainState);
    await readLocalWalletBalanceStaleFirst({
      backgroundApi,
      networkId,
      accountId,
      read: async () => 'balance',
    });
    await expect(
      backgroundApi.simpleDb.privacyChainCache.getLastBalance({ accountId }),
    ).resolves.toBeDefined();

    await deleteLocalData(service, capability);

    await expect(
      backgroundApi.simpleDb.privacyChainCache.getLastBalance({ accountId }),
    ).resolves.toBeUndefined();
  });

  it('a delete that died after rotating leaves an entry every read ignores', async () => {
    const { backgroundApi, privacyChainState } = createRealHarness();
    await seedRecord(privacyChainState);
    const epoch = await privacyChainState.getAccountEpoch({ accountId });
    await saveLastLocalWalletBalance({
      backgroundApi,
      networkId,
      accountId,
      epoch,
      value: 'balance',
    });
    await privacyChainState.rotateAccountEpochs({ accountIds: [accountId] });

    await expect(
      readLocalWalletBalanceStaleFirst({
        backgroundApi,
        networkId,
        accountId,
        skipLive: true,
        read: async () => 'live',
      }),
    ).resolves.toBeNull();
  });

  it('refuses a write-back whose read started between the rotation and the rescan', async () => {
    const { service, capability, backgroundApi, privacyChainState } =
      createRealHarness();
    await seedRecord(privacyChainState);
    let finishRead: (value: string) => void = () => undefined;
    let reading: Promise<unknown> = Promise.resolve();
    (capability.rescan as jest.Mock).mockImplementation(async () => {
      reading = readLocalWalletBalanceStaleFirst({
        backgroundApi,
        networkId,
        accountId,
        read: () =>
          new Promise<string>((resolve) => {
            finishRead = resolve;
          }),
      });
      await new Promise((resolve) => setTimeout(resolve, 0));
      return { fromHeight: 1 };
    });

    await service.runLocalWalletLifecycle({
      event: 'rescan',
      targets: [targetFor('rescan', capability)],
      rescanFrom: { type: 'height', height: 1 },
    });
    finishRead('balance from before the rescan');
    await reading;

    await expect(
      backgroundApi.simpleDb.privacyChainCache.getLastBalance({ accountId }),
    ).resolves.toBeUndefined();
  });

  it('a write-back racing a rescan of an alias is refused too', async () => {
    const { service, capability, backgroundApi, privacyChainState } =
      createRealHarness();
    await seedRecord(privacyChainState);
    let finishRead: (value: string) => void = () => undefined;
    const reading = readLocalWalletBalanceStaleFirst({
      backgroundApi,
      networkId,
      accountId,
      read: () =>
        new Promise<string>((resolve) => {
          finishRead = resolve;
        }),
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    await service.runLocalWalletLifecycle({
      event: 'rescan',
      targets: [
        {
          scope: 'accounts',
          networkId,
          capability,
          accountIds: [accountId, 'hd-2--0'],
          runtimeAccountIds: ['hd-2--0'],
        },
      ],
    });
    finishRead('balance before the rescan');
    await reading;

    await expect(
      backgroundApi.simpleDb.privacyChainCache.getLastBalance({ accountId }),
    ).resolves.toBeUndefined();
  });
});

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { SimpleDbEntityPrivacyChainKeys } from '../dbs/simple/entity/SimpleDbEntityPrivacyChainKeys';
import { SimpleDbEntityPrivacyChainState } from '../dbs/simple/entity/SimpleDbEntityPrivacyChainState';
import { getViewingKeyFingerprint } from '../vaults/localWallet/viewingKeyFingerprint';
import {
  getLocalWalletViewingKey,
  isLocalWalletViewingKeyMismatchError,
  saveLocalWalletViewingKey,
} from '../vaults/localWallet/viewingKeyStore';

import type VaultXmr from '../vaults/impls/xmr/Vault';

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

const mockGetVault = jest.fn();
jest.mock('../vaults/factory', () => ({
  vaultFactory: {
    getChainOnlyVault: jest.fn(),
    getVault: mockGetVault,
  },
}));
const mockGetVaultSettings = jest.fn();
jest.mock('../vaults/settings', () => ({
  getVaultSettings: mockGetVaultSettings,
}));
jest.mock('../states/jotai/atoms', () => ({
  privacyChainAtom: { set: jest.fn(async () => undefined) },
}));

const ServicePrivacyChain = require('./ServicePrivacyChain')
  .default as typeof import('./ServicePrivacyChain').default;

const XmrVault = require('../vaults/impls/xmr/Vault')
  .default as typeof import('../vaults/impls/xmr/Vault').default;
const { buildXmrLocalWalletCapability } =
  require('../vaults/impls/xmr/localWallet') as typeof import('../vaults/impls/xmr/localWallet');

const networkId = 'xmr--0';
const hdAccountId = 'hd-1--0';

function createStateDb() {
  let saved: unknown = null;
  const entity = new SimpleDbEntityPrivacyChainState();
  (entity as { appStorage: unknown }).appStorage = {
    getItem: jest.fn(async () => saved),
    setItem: jest.fn(async (_key: string, value: unknown) => {
      saved = value;
    }),
  };
  return entity;
}

function createKeysDb() {
  let saved: unknown = null;
  const entity = new SimpleDbEntityPrivacyChainKeys();
  (entity as { appStorage: unknown }).appStorage = {
    getItem: jest.fn(async () => saved),
    setItem: jest.fn(async (_key: string, value: unknown) => {
      saved = value;
    }),
    removeItem: jest.fn(async () => {
      saved = null;
    }),
  };
  return entity;
}

function createService({
  cachedPassword,
  promptedPassword,
  liveAccountIds = [hdAccountId],
  lastBalanceAccountIds = [],
}: {
  cachedPassword?: string;
  promptedPassword?: string;
  liveAccountIds?: string[];
  lastBalanceAccountIds?: string[];
} = {}) {
  const privacyChainKeys = createKeysDb();
  const privacyChainState = createStateDb();
  const removeAccountTokenList = jest.fn(async () => undefined);
  const removeAccountNetworkValue = jest.fn(async () => undefined);
  const removeLastBalances = jest.fn(async () => undefined);
  const promptPasswordVerifyByAccount = jest.fn(async () => {
    if (!promptedPassword) throw new OneKeyLocalError('cancelled');
    return { password: promptedPassword };
  });
  const backgroundApi = {
    serviceSignature: {
      listZcashSignedTransactionAccountIds: async () => [],
      removeSignedTransactionsForAccount: jest.fn(async () => undefined),
    },
    simpleDb: {
      privacyChainKeys,
      privacyChainState,
      localTokens: { removeAccountTokenList },
      accountValue: { removeAccountNetworkValue },
      privacyChainCache: {
        removeLastBalances,
        listLastBalanceAccountIds: async () => lastBalanceAccountIds,
      },
      privacyChainJournal: {
        listAccountIds: async () => [],
        removeAccounts: jest.fn(async () => undefined),
      },
      privacyChainXmrSent: {
        listAccountIds: async () => [],
        removeAccounts: jest.fn(async () => undefined),
      },
    },
    servicePassword: {
      hasCachedPassword: jest.fn(async () => !!cachedPassword),
      getCachedPassword: jest.fn(async () => cachedPassword),
      promptPasswordVerifyByAccount,
    },
    serviceAccount: {
      getAllAccounts: jest.fn(async () => ({
        accounts: liveAccountIds.map((id) => ({
          id,
          indexedAccountId: `${id}--indexed`,
        })),
      })),
      getAllIndexedAccounts: jest.fn(async () => ({
        indexedAccounts: liveAccountIds.map((id) => ({
          id: `${id}--indexed`,
        })),
      })),
      getAllWallets: jest.fn(async () => ({ wallets: [] })),
      getDBAccountSafe: jest.fn(
        async ({ accountId }: { accountId: string }) => ({ id: accountId }),
      ),
      getAccount: jest.fn(async () => ({ address: '4synthetic' })),
      getWalletSafe: async () => ({ isTemp: false }),
    },
  };
  const service = Object.assign(
    Object.create(ServicePrivacyChain.prototype) as object,
    {
      backgroundApi,
      init: jest.fn(async () => undefined),
      enableMutexByNetwork: new Map(),
      orphanCleanupGeneration: new Map(),
      backfillActiveByAccount: {},
      syncFailureBackoff: new Map(),
      scheduleBackgroundSync: jest.fn(),
      getLocalWalletNetworkIds: async () => [],
      forEachLocalWalletCapability: async () => undefined,
      assertEnabledAccountLimit: async () => undefined,
      requireAccountCapability: async () => ({
        getAccountState: async ({ accountId }: { accountId: string }) => {
          const state = await privacyChainState.getXmrAccountState({
            accountId,
          });
          return {
            enabled: state.intent === 'on' && !state.operation,
            pendingOperation: state.operation?.type,
          };
        },
      }),
    },
  ) as unknown as InstanceType<typeof ServicePrivacyChain>;
  return {
    service,
    backgroundApi,
    privacyChainKeys,
    privacyChainState,
    promptPasswordVerifyByAccount,
    removeAccountTokenList,
    removeAccountNetworkValue,
    removeLastBalances,
  };
}

function storeApi(
  backgroundApi: ReturnType<typeof createService>['backgroundApi'],
) {
  return backgroundApi as unknown as Parameters<
    typeof getLocalWalletViewingKey
  >[0]['backgroundApi'];
}

async function repairWithOwner(
  service: ReturnType<typeof createService>['service'],
  accountId: string,
) {
  const db = service.backgroundApi.simpleDb.privacyChainState;
  if ((await db.getAccountEpoch({ accountId })) === undefined) {
    await db.beginXmrEnable({
      networkId,
      accountId,
      birthdayHeight: 3_000_000,
    });
  }
  return service.ensureLocalWalletViewingKey({
    networkId,
    accountId,
    expectedEpoch: await db.getAccountEpoch({ accountId }),
  });
}

describe('Privacy chain viewing key store', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns the stored viewing key without deriving', async () => {
    const { service, backgroundApi } = createService();
    await saveLocalWalletViewingKey({
      backgroundApi: storeApi(backgroundApi),
      networkId,
      accountId: hdAccountId,
      value: 'stored',
    });

    await expect(repairWithOwner(service, hdAccountId)).resolves.toBe('stored');
    expect(mockGetVault).not.toHaveBeenCalled();
  });

  it('rebuilds a missing HD viewing key with the cached password and keeps it', async () => {
    const deriveViewingKey = jest.fn(async () => 'derived');
    mockGetVault.mockResolvedValue({
      getLocalWalletCapability: () => ({ deriveViewingKey }),
    });
    const { service, privacyChainKeys } = createService({
      cachedPassword: 'pw',
    });

    await expect(repairWithOwner(service, hdAccountId)).resolves.toBe(
      'derived',
    );
    expect(deriveViewingKey).toHaveBeenCalledWith({
      accountId: hdAccountId,
      password: 'pw',
    });
    await expect(
      privacyChainKeys.getKey({ accountId: hdAccountId }),
    ).resolves.toEqual({
      networkId,
      vkFp: getViewingKeyFingerprint({ networkId, viewingKey: 'derived' }),
      sealed: { format: 'plain', value: 'derived' },
    });
  });

  it('never prompts: a locked wallet gets no viewing key', async () => {
    const deriveViewingKey = jest.fn(async () => 'derived');
    mockGetVault.mockResolvedValue({
      getLocalWalletCapability: () => ({ deriveViewingKey }),
    });
    const { service, promptPasswordVerifyByAccount } = createService({
      promptedPassword: 'pw',
    });

    await expect(
      repairWithOwner(service, hdAccountId),
    ).resolves.toBeUndefined();
    expect(deriveViewingKey).not.toHaveBeenCalled();
    expect(promptPasswordVerifyByAccount).not.toHaveBeenCalled();
  });

  it('does not derive for a hardware account', async () => {
    const { service } = createService({ cachedPassword: 'pw' });

    await expect(repairWithOwner(service, 'hw-1--0')).resolves.toBeUndefined();
    expect(mockGetVault).not.toHaveBeenCalled();
  });

  it('ignores a key stored for another network', async () => {
    const { service, backgroundApi } = createService();
    await saveLocalWalletViewingKey({
      backgroundApi: storeApi(backgroundApi),
      networkId: 'zec--0',
      accountId: hdAccountId,
      value: 'zcash',
    });

    await expect(
      repairWithOwner(service, hdAccountId),
    ).resolves.toBeUndefined();
  });

  it('stops with the setup-incomplete error when a derived key differs from the stored identity', async () => {
    mockGetVault.mockResolvedValue({
      getLocalWalletCapability: () => ({
        deriveViewingKey: async () => 'derived',
      }),
    });
    const { service, privacyChainKeys } = createService({
      cachedPassword: 'pw',
    });
    // Its value no longer matches its fingerprint, so it reads as missing,
    // yet it still names another identity.
    const stored = {
      networkId,
      vkFp: getViewingKeyFingerprint({ networkId, viewingKey: 'original' }),
      sealed: { format: 'plain' as const, value: 'damaged' },
    };
    await privacyChainKeys.saveKey({ accountId: hdAccountId, record: stored });

    const error = await repairWithOwner(service, hdAccountId).catch(
      (e: unknown) => e,
    );

    expect(isLocalWalletViewingKeyMismatchError(error)).toBe(true);
    expect((error as Error).message).toBe(
      ETranslations.privacy_error_setup_incomplete__msg,
    );
    await expect(
      privacyChainKeys.getKey({ accountId: hdAccountId }),
    ).resolves.toEqual(stored);
  });

  // The scan state keeps the identity after the key is deleted with the
  // local data; a key derived later must still be that one.
  it('stops with the setup-incomplete error when a derived key differs from the state identity', async () => {
    mockGetVault.mockResolvedValue({
      getLocalWalletCapability: () => ({
        deriveViewingKey: async () => 'derived',
      }),
    });
    const { service, privacyChainKeys, privacyChainState } = createService({
      cachedPassword: 'pw',
    });
    await privacyChainState.beginXmrEnable({
      networkId,
      accountId: hdAccountId,
      birthdayHeight: 3_000_000,
    });
    await privacyChainState.completeXmrEnable({
      accountId: hdAccountId,
      vkFp: getViewingKeyFingerprint({ networkId, viewingKey: 'original' }),
    });

    const error = await repairWithOwner(service, hdAccountId).catch(
      (e: unknown) => e,
    );

    expect(isLocalWalletViewingKeyMismatchError(error)).toBe(true);
    await expect(
      privacyChainKeys.getKey({ accountId: hdAccountId }),
    ).resolves.toBeUndefined();
  });

  it('completes enable with the real XMR stored-key reader without reentering its mutex', async () => {
    const { service, backgroundApi, privacyChainState } = createService({
      cachedPassword: 'pw',
    });
    const vault = Object.assign(Object.create(XmrVault.prototype) as VaultXmr, {
      networkId,
      backgroundApi,
    });
    const capability = buildXmrLocalWalletCapability(vault);
    capability.deriveViewingKey = jest.fn(
      async () => `${'01'.repeat(32)}:${'02'.repeat(32)}`,
    );
    Object.assign(service, {
      requireAccountCapability: async () => capability,
      onLocalWalletAccountsChanged: jest.fn(async () => undefined),
    });
    mockGetVault.mockResolvedValue({
      getLocalWalletCapability: () => capability,
    });
    await service.enableLocalWalletAccount({
      networkId,
      accountId: hdAccountId,
      birthdayHeight: 3_000_000,
    });
    expect(capability.deriveViewingKey).toHaveBeenCalledTimes(1);
    expect(
      await privacyChainState.getXmrAccountState({ accountId: hdAccountId }),
    ).toMatchObject({ intent: 'on', birthdayHeight: 3_000_000 });
  });

  it('does not save a key if deletion supersedes a background derivation', async () => {
    const { service, privacyChainState, privacyChainKeys } = createService({
      cachedPassword: 'pw',
    });
    let release: () => void = () => undefined;
    let entered: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    mockGetVault.mockResolvedValue({
      getLocalWalletCapability: () => ({
        deriveViewingKey: async () => {
          entered();
          await gate;
          return 'derived';
        },
      }),
    });
    const deriving = repairWithOwner(service, hdAccountId);
    await started;
    await privacyChainState.requestAccountDeletion({
      networkId,
      accountId: hdAccountId,
    });
    release();
    expect(await deriving).toBeUndefined();
    expect(await privacyChainKeys.listAccountIds()).toEqual([]);
  });

  it('never derives from an unowned key read', async () => {
    const { service } = createService({ cachedPassword: 'pw' });
    mockGetVault.mockClear();
    expect(
      await service.ensureLocalWalletViewingKey({
        networkId,
        accountId: hdAccountId,
      }),
    ).toBeUndefined();
    expect(mockGetVault).not.toHaveBeenCalled();
  });

  it('drops viewing keys and saved balances of removed accounts', async () => {
    const { service, backgroundApi, privacyChainKeys, removeLastBalances } =
      createService({
        liveAccountIds: [hdAccountId],
        lastBalanceAccountIds: [hdAccountId, 'hd-1--9'],
      });
    for (const [accountId, value] of [
      [hdAccountId, 'live'],
      ['hd-1--9', 'removed'],
    ]) {
      // eslint-disable-next-line no-await-in-loop
      await saveLocalWalletViewingKey({
        backgroundApi: storeApi(backgroundApi),
        networkId,
        accountId,
        value,
      });
    }

    await service.gcRemovedAccounts();

    await expect(privacyChainKeys.listAccountIds()).resolves.toEqual([
      hdAccountId,
    ]);
    expect(removeLastBalances).toHaveBeenCalledWith({
      accountIds: ['hd-1--9'],
    });
  });
});

describe('Privacy chain viewing key lifecycle', () => {
  it('does not enter enable when the derived key was not persisted', async () => {
    const deriveViewingKey = jest.fn(
      async () => 'synthetic-spend:synthetic-view',
    );
    mockGetVault.mockResolvedValue({
      getLocalWalletCapability: () => ({ deriveViewingKey }),
    });
    const { service, privacyChainKeys } = createService({
      cachedPassword: 'pw',
    });
    const enableAccount = jest.fn(async () => undefined);
    withCapability(service, { deriveViewingKey, enableAccount });
    jest.spyOn(privacyChainKeys, 'setRawData').mockResolvedValue(undefined);

    await expect(
      service.enableLocalWalletAccount({ networkId, accountId: hdAccountId }),
    ).rejects.toThrow('viewing key could not be persisted');

    expect(deriveViewingKey).toHaveBeenCalledTimes(1);
    expect(enableAccount).not.toHaveBeenCalled();
    await expect(
      privacyChainKeys.getKey({ accountId: hdAccountId }),
    ).resolves.toBeUndefined();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  function withCapability(
    service: ReturnType<typeof createService>['service'],
    capability: Record<string, unknown>,
  ) {
    Object.assign(service, {
      requireAccountCapability: async () => capability,
    });
  }

  // Q3: both chains delete the key with local data, as the UI copy says.
  // Zcash derives it again in its own enable (see accountMeta.test.ts).
  it.each([
    ['xmr--0', 'spend:view'],
    ['zec--0', 'uview1synthetic'],
  ])(
    '%s: delete-local-data removes the key',
    async (chainNetworkId, viewingKey) => {
      const {
        service,
        backgroundApi,
        removeAccountTokenList,
        removeAccountNetworkValue,
        removeLastBalances,
      } = createService({ cachedPassword: 'pw' });
      const deleteRuntimeAccount = jest.fn(async () => ({ orphaned: false }));
      withCapability(service, {
        deleteRuntimeAccount,
        getAccountState: async () => ({ enabled: false }),
      });
      await saveLocalWalletViewingKey({
        backgroundApi: storeApi(backgroundApi),
        networkId: chainNetworkId,
        accountId: hdAccountId,
        value: viewingKey,
      });

      await service.deleteLocalWalletAccountData({
        networkId: chainNetworkId,
        accountId: hdAccountId,
      });
      await service.resumePendingAccountDeletions();

      expect(deleteRuntimeAccount).toHaveBeenCalledWith({
        accountId: hdAccountId,
        deletionRequestId: expect.stringMatching(/^[0-9a-f]{16}$/),
      });
      await expect(
        getLocalWalletViewingKey({
          backgroundApi: storeApi(backgroundApi),
          networkId: chainNetworkId,
          accountId: hdAccountId,
        }),
      ).resolves.toBeUndefined();
      // The shared caches hold the composed balance, private part included.
      const owner = {
        networkId: chainNetworkId,
        accountAddress: '4synthetic',
        xpub: undefined,
      };
      expect(removeAccountTokenList).toHaveBeenCalledWith(owner);
      expect(removeAccountNetworkValue).toHaveBeenCalledWith(owner);
      expect(removeLastBalances).toHaveBeenCalledWith({
        accountIds: [hdAccountId],
      });
    },
  );

  it('xmr: the enable after delete-local-data derives the same key again', async () => {
    const deriveViewingKey = jest.fn(async () => 'spend:view');
    mockGetVault.mockResolvedValue({
      getLocalWalletCapability: () => ({ deriveViewingKey }),
    });
    const { service, backgroundApi, privacyChainState } = createService({
      cachedPassword: 'pw',
    });
    const enableAccount = jest.fn(async () => {
      await privacyChainState.saveXmrEnabledAccount({
        networkId,
        accountId: hdAccountId,
        vkFp: getViewingKeyFingerprint({ networkId, viewingKey: 'spend:view' }),
        birthdayHeight: 100,
      });
    });
    withCapability(service, {
      deleteRuntimeAccount: async () => ({ orphaned: false }),
      enableAccount,
      deriveViewingKey,
      getAccountState: async () => ({ enabled: false }),
    });
    const before = await saveLocalWalletViewingKey({
      backgroundApi: storeApi(backgroundApi),
      networkId,
      accountId: hdAccountId,
      value: 'spend:view',
    });
    await service.deleteLocalWalletAccountData({
      networkId,
      accountId: hdAccountId,
    });

    await service.enableLocalWalletAccount({
      networkId,
      accountId: hdAccountId,
    });

    expect(deriveViewingKey).toHaveBeenCalledWith({
      accountId: hdAccountId,
      password: 'pw',
    });
    expect(enableAccount).toHaveBeenCalled();
    await service.resumePendingAccountDeletions();
    await expect(
      getLocalWalletViewingKey({
        backgroundApi: storeApi(backgroundApi),
        networkId,
        accountId: hdAccountId,
      }),
    ).resolves.toEqual(before);
  });

  // The way out of an identity mismatch: deleting local data forgets the
  // identity, so the next enable may store whatever key it derives.
  it('xmr: after delete-local-data a different derived key is accepted', async () => {
    const deriveViewingKey = jest.fn(async () => 'spend:other');
    mockGetVault.mockResolvedValue({
      getLocalWalletCapability: () => ({ deriveViewingKey }),
    });
    const { service, backgroundApi, privacyChainState } = createService({
      cachedPassword: 'pw',
    });
    withCapability(service, {
      deleteRuntimeAccount: async () => ({ orphaned: false }),
      enableAccount: async () => undefined,
      deriveViewingKey,
      getAccountState: async () => ({ enabled: false }),
    });
    await privacyChainState.beginXmrEnable({
      networkId,
      accountId: hdAccountId,
      birthdayHeight: 100,
    });
    await privacyChainState.completeXmrEnable({
      accountId: hdAccountId,
      vkFp: getViewingKeyFingerprint({ networkId, viewingKey: 'spend:view' }),
    });
    await privacyChainState.beginXmrDisable({ accountId: hdAccountId });
    await privacyChainState.completeXmrDisable({ accountId: hdAccountId });

    await service.deleteLocalWalletAccountData({
      networkId,
      accountId: hdAccountId,
    });
    await service.resumePendingAccountDeletions();
    await service.enableLocalWalletAccount({
      networkId,
      accountId: hdAccountId,
    });

    await expect(
      getLocalWalletViewingKey({
        backgroundApi: storeApi(backgroundApi),
        networkId,
        accountId: hdAccountId,
      }),
    ).resolves.toMatchObject({ value: 'spend:other' });
  });

  it('enabling asks for the password when none is cached', async () => {
    const deriveViewingKey = jest.fn(async () => 'spend:view');
    mockGetVault.mockResolvedValue({
      getLocalWalletCapability: () => ({ deriveViewingKey }),
    });
    const { service, backgroundApi, promptPasswordVerifyByAccount } =
      createService({ promptedPassword: 'typed' });
    withCapability(service, {
      enableAccount: async () => undefined,
      deriveViewingKey,
    });

    await service.enableLocalWalletAccount({
      networkId,
      accountId: hdAccountId,
    });

    expect(promptPasswordVerifyByAccount).toHaveBeenCalledTimes(1);
    expect(deriveViewingKey).toHaveBeenCalledWith({
      accountId: hdAccountId,
      password: 'typed',
    });
    await expect(
      getLocalWalletViewingKey({
        backgroundApi: storeApi(backgroundApi),
        networkId,
        accountId: hdAccountId,
      }),
    ).resolves.toMatchObject({ value: 'spend:view' });
  });

  it('an enable that never started leaves no key behind', async () => {
    mockGetVault.mockResolvedValue({
      getLocalWalletCapability: () => ({
        deriveViewingKey: async () => 'spend:view',
      }),
    });
    const { service, privacyChainKeys } = createService({
      cachedPassword: 'pw',
    });
    withCapability(service, {
      enableAccount: async () => {
        throw new OneKeyLocalError('node unreachable');
      },
      deriveViewingKey: async () => 'spend:view',
      getAccountState: async () => ({ enabled: false }),
    });

    await expect(
      service.enableLocalWalletAccount({ networkId, accountId: hdAccountId }),
    ).rejects.toThrow('node unreachable');

    await expect(privacyChainKeys.listAccountIds()).resolves.toEqual([]);
  });

  it('an enable journaled as pending keeps its key for the retry', async () => {
    mockGetVault.mockResolvedValue({
      getLocalWalletCapability: () => ({
        deriveViewingKey: async () => 'spend:view',
      }),
    });
    const { service, privacyChainKeys } = createService({
      cachedPassword: 'pw',
    });
    withCapability(service, {
      enableAccount: async () => {
        throw new OneKeyLocalError('runtime busy');
      },
      deriveViewingKey: async () => 'spend:view',
      getAccountState: async () => ({
        enabled: false,
        pendingOperation: 'enable',
      }),
    });

    await expect(
      service.enableLocalWalletAccount({ networkId, accountId: hdAccountId }),
    ).rejects.toThrow('runtime busy');

    await expect(privacyChainKeys.listAccountIds()).resolves.toEqual([
      hdAccountId,
    ]);
  });

  it('a chain whose keys come from its own setup is not derived at enable', async () => {
    const { service, privacyChainKeys } = createService({
      cachedPassword: 'pw',
    });
    const enableAccount = jest.fn(async () => undefined);
    withCapability(service, { enableAccount });

    await service.enableLocalWalletAccount({
      networkId: 'zec--0',
      accountId: hdAccountId,
    });

    expect(enableAccount).toHaveBeenCalled();
    expect(mockGetVault).not.toHaveBeenCalled();
    await expect(privacyChainKeys.listAccountIds()).resolves.toEqual([]);
  });
});

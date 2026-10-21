import { SimpleDbEntityPrivacyChain } from '../dbs/simple/entity/SimpleDbEntityPrivacyChain';

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

const networkId = 'xmr--0';
const hdAccountId = 'hd-1--0';

function createPrivacyChainDb() {
  let saved: unknown = null;
  const entity = new SimpleDbEntityPrivacyChain();
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
  liveAccountIds = [hdAccountId],
  lastBalanceAccountIds = [],
}: {
  cachedPassword?: string;
  liveAccountIds?: string[];
  lastBalanceAccountIds?: string[];
} = {}) {
  const privacyChain = createPrivacyChainDb();
  const removeAccountTokenList = jest.fn(async () => undefined);
  const removeAccountNetworkValue = jest.fn(async () => undefined);
  const removeLastBalances = jest.fn(async () => undefined);
  const service = Object.assign(
    Object.create(ServicePrivacyChain.prototype) as InstanceType<
      typeof ServicePrivacyChain
    >,
    {
      backgroundApi: {
        simpleDb: {
          privacyChain,
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
        },
        servicePassword: {
          hasCachedPassword: jest.fn(async () => !!cachedPassword),
          getCachedPassword: jest.fn(async () => cachedPassword),
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
          getAccount: jest.fn(async () => ({ address: '4synthetic' })),
          getWalletSafe: async () => ({ isTemp: false }),
        },
      },
      enableMutexByNetwork: new Map(),
      getLocalWalletNetworkIds: async () => [],
      forEachLocalWalletCapability: async () => undefined,
    },
  );
  return {
    service,
    privacyChain,
    removeAccountTokenList,
    removeAccountNetworkValue,
    removeLastBalances,
  };
}

describe('Privacy chain viewing key store', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns the stored viewing key without deriving', async () => {
    const { service, privacyChain } = createService();
    await privacyChain.setViewingKey({
      accountId: hdAccountId,
      record: { networkId, value: 'stored' },
    });

    await expect(
      service.ensureLocalWalletViewingKey({
        networkId,
        accountId: hdAccountId,
      }),
    ).resolves.toBe('stored');
    expect(mockGetVault).not.toHaveBeenCalled();
  });

  it('rebuilds a missing HD viewing key with the cached password and keeps it', async () => {
    const deriveViewingKey = jest.fn(async () => 'derived');
    mockGetVault.mockResolvedValue({
      getLocalWalletCapability: () => ({ deriveViewingKey }),
    });
    const { service, privacyChain } = createService({ cachedPassword: 'pw' });

    await expect(
      service.ensureLocalWalletViewingKey({
        networkId,
        accountId: hdAccountId,
      }),
    ).resolves.toBe('derived');
    expect(deriveViewingKey).toHaveBeenCalledWith({
      accountId: hdAccountId,
      password: 'pw',
    });
    await expect(
      privacyChain.getViewingKey({ accountId: hdAccountId }),
    ).resolves.toEqual({ networkId, value: 'derived' });
  });

  it('never prompts: a locked wallet gets no viewing key', async () => {
    const deriveViewingKey = jest.fn(async () => 'derived');
    mockGetVault.mockResolvedValue({
      getLocalWalletCapability: () => ({ deriveViewingKey }),
    });
    const { service } = createService();

    await expect(
      service.ensureLocalWalletViewingKey({
        networkId,
        accountId: hdAccountId,
      }),
    ).resolves.toBeUndefined();
    expect(deriveViewingKey).not.toHaveBeenCalled();
  });

  it('does not derive for a hardware account', async () => {
    const { service } = createService({ cachedPassword: 'pw' });

    await expect(
      service.ensureLocalWalletViewingKey({
        networkId,
        accountId: 'hw-1--0',
      }),
    ).resolves.toBeUndefined();
    expect(mockGetVault).not.toHaveBeenCalled();
  });

  it('ignores a key stored for another network', async () => {
    const { service, privacyChain } = createService();
    await privacyChain.setViewingKey({
      accountId: hdAccountId,
      record: { networkId: 'zec--0', value: 'zcash' },
    });

    await expect(
      service.ensureLocalWalletViewingKey({
        networkId,
        accountId: hdAccountId,
      }),
    ).resolves.toBeUndefined();
  });

  it.each([
    ['with-local-data', undefined],
    ['until-account-removed', { networkId, value: 'stored' }],
  ] as const)(
    'applies %s retention when local privacy data is deleted',
    async (viewingKeyRetention, expected) => {
      const deleteAccountData = jest.fn(async () => undefined);
      const {
        service,
        privacyChain,
        removeAccountTokenList,
        removeAccountNetworkValue,
        removeLastBalances,
      } = createService();
      Object.assign(service, {
        requireAccountCapability: async () => ({
          deleteAccountData,
          getAccountState: async () => ({ enabled: false }),
        }),
      });
      mockGetVaultSettings.mockResolvedValue({
        localWallet: { viewingKeyRetention },
      });
      await privacyChain.setViewingKey({
        accountId: hdAccountId,
        record: { networkId, value: 'stored' },
      });

      await service.deleteLocalWalletAccountData({
        networkId,
        accountId: hdAccountId,
      });

      expect(deleteAccountData).toHaveBeenCalledWith({
        accountId: hdAccountId,
      });
      // The shared caches hold the composed balance, private part included.
      const owner = {
        networkId,
        accountAddress: '4synthetic',
        xpub: undefined,
      };
      expect(removeAccountTokenList).toHaveBeenCalledWith(owner);
      expect(removeAccountNetworkValue).toHaveBeenCalledWith(owner);
      expect(removeLastBalances).toHaveBeenCalledWith({
        accountIds: [hdAccountId],
      });
      await expect(
        privacyChain.getViewingKey({ accountId: hdAccountId }),
      ).resolves.toEqual(expected);
    },
  );

  it('drops viewing keys and saved balances of removed accounts', async () => {
    const { service, privacyChain, removeLastBalances } = createService({
      liveAccountIds: [hdAccountId],
      lastBalanceAccountIds: [hdAccountId, 'hd-1--9'],
    });
    await privacyChain.setViewingKey({
      accountId: hdAccountId,
      record: { networkId, value: 'live' },
    });
    await privacyChain.setViewingKey({
      accountId: 'hd-1--9',
      record: { networkId, value: 'removed' },
    });

    await service.gcRemovedAccounts();

    await expect(privacyChain.listViewingKeyAccountIds()).resolves.toEqual([
      hdAccountId,
    ]);
    expect(removeLastBalances).toHaveBeenCalledWith({
      accountIds: ['hd-1--9'],
    });
  });
});

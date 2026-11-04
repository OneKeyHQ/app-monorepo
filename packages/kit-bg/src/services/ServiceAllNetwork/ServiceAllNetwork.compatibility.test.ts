import type { IServerNetwork } from '@onekeyhq/shared/types';

import ServiceAllNetwork from './ServiceAllNetwork';

import type { IAllNetworkAccountInfo } from './ServiceAllNetwork';

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => (target: unknown) => target,
  backgroundMethod:
    () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) =>
      descriptor,
}));
jest.mock('../ServiceBase', () => ({
  __esModule: true,
  default: class {
    backgroundApi: unknown;

    constructor({ backgroundApi }: { backgroundApi: unknown }) {
      this.backgroundApi = backgroundApi;
    }
  },
}));
jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: {},
  appEventBus: { on: jest.fn() },
}));
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({ defaultLogger: {} }));
jest.mock('@onekeyhq/shared/src/utils/accountUtils', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('@onekeyhq/shared/src/utils/debug/perfUtils', () => ({}));
jest.mock('@onekeyhq/shared/src/config/presetNetworks', () => ({
  getDefaultEnabledNetworkIdsInAllNetworks: () => [
    'evm--1',
    'evm--56',
    'btc--0',
    'sol--101',
  ],
  getPresetNetworks: () => [],
}));

const network = (id: string, impl: string, isTestnet = false) =>
  ({ id, impl, isTestnet }) as IServerNetwork;

function setup() {
  const networks = [
    network('evm--1', 'evm'),
    network('evm--56', 'evm'),
    network('btc--0', 'btc'),
    network('sol--101', 'sol'),
    network('custom--9', 'custom'),
    network('evm--111', 'evm', true),
  ];
  const state = {
    enabledNetworks: {} as Record<string, boolean>,
    disabledNetworks: {} as Record<string, boolean>,
  };
  const mergeById: Record<string, boolean> = {};
  const deriveById: Record<string, string> = {};
  const accountsById: Record<string, { deriveType: string }[]> = {};
  const incompatibleIds = new Set<string>();
  const serviceNetwork = {
    getAllNetworks: jest.fn(async () => ({
      networks: networks.filter((item) => !item.isTestnet),
    })),
    getChainSelectorNetworksCompatibleWithAccountId: jest.fn(
      async ({ networkIds }: { networkIds: string[] }) => ({
        mainnetItems: networks.filter(
          (item) =>
            networkIds.includes(item.id) && !incompatibleIds.has(item.id),
        ),
      }),
    ),
    getGlobalDeriveTypeOfNetwork: jest.fn(
      async ({ networkId }: { networkId: string }) =>
        deriveById[networkId] ?? 'default',
    ),
    getVaultSettings: jest.fn(async ({ networkId }: { networkId: string }) => ({
      mergeDeriveAssetsEnabled: mergeById[networkId] ?? false,
      accountDeriveInfo: {
        default: { idSuffix: undefined },
        alternate: { idSuffix: 'ALTERNATE' },
      },
    })),
  };
  const serviceAccount = {
    getDbAccountIdFromIndexedAccountId: jest.fn(
      async ({
        networkId,
        deriveType,
      }: {
        indexedAccountId: string;
        networkId: string;
        deriveType: string;
      }) => `${networkId}|${deriveType}`,
    ),
    getAllAccounts: jest.fn(async ({ ids }: { ids?: string[] } = {}) => ({
      accounts: (ids ?? [])
        .filter((id) => {
          const [networkId, deriveType] = id.split('|');
          return (accountsById[networkId] ?? []).some(
            (account) => account.deriveType === deriveType,
          );
        })
        .map((id) => ({ id })),
    })),
  };
  const service = new ServiceAllNetwork({
    backgroundApi: {
      serviceAccount,
      serviceNetwork,
      simpleDb: { allNetworks: { getAllNetworksState: async () => state } },
    },
  });
  return {
    service,
    serviceAccount,
    serviceNetwork,
    networks,
    state,
    mergeById,
    deriveById,
    accountsById,
    incompatibleIds,
  };
}

describe('Home All Networks narrow account response', () => {
  it.each([true, false])(
    'returns only the original entries with fixed category filters (enabledOnly=%s)',
    async (networksEnabledOnly) => {
      const { service } = setup();
      const account: IAllNetworkAccountInfo = {
        accountId: 'fixture-account',
        networkId: 'evm--1',
        apiAddress: 'fixture-address',
        accountXpub: undefined,
        pub: undefined,
        dbAccount: undefined,
        isNftEnabled: false,
        isBackendIndexed: true,
        deriveType: 'default',
        deriveInfo: undefined,
        isTestnet: false,
      };
      const accountsInfo = [
        account,
        {
          ...account,
          networkId: 'btc--0',
          deriveType: 'BIP86' as const,
          isBackendIndexed: false,
        },
        {
          ...account,
          networkId: 'sol--101',
          accountId: '',
          apiAddress: '',
          isBackendIndexed: undefined,
        },
      ];
      accountsInfo.forEach(Object.freeze);
      Object.freeze(accountsInfo);
      const getAccounts = jest
        .spyOn(service, 'getAllNetworkAccounts')
        .mockResolvedValue({
          accountsInfo,
          allAccountsInfo: accountsInfo,
          accountsInfoBackendIndexed: [accountsInfo[0]],
          accountsInfoBackendNotIndexed: accountsInfo.slice(1),
        });

      const result = await service.getAllNetworkAccountsForHome({
        accountId: 'fixture-owner',
        networkId: 'onekeyall--0',
        networksEnabledOnly,
        excludeTestNetwork: true,
      });

      expect(getAccounts).toHaveBeenCalledWith({
        accountId: 'fixture-owner',
        networkId: 'onekeyall--0',
        networksEnabledOnly,
        excludeTestNetwork: true,
        deriveType: undefined,
        nftEnabledOnly: false,
        DeFiEnabledOnly: false,
      });
      expect(result).toBe(accountsInfo);
      expect(result.map((item) => item.networkId)).toEqual([
        'evm--1',
        'btc--0',
        'sol--101',
      ]);
    },
  );
});

describe('All Networks account compatibility inside bg', () => {
  it.each([
    { enabledNetworkIds: [] },
    { enabledNetworkIds: ['evm--111'] },
    { enabledNetworkIds: ['unknown--0'] },
  ])(
    'does not expand an empty mainnet intersection to all networks: %j',
    async ({ enabledNetworkIds }) => {
      const { service, serviceNetwork, serviceAccount } = setup();
      await expect(
        service.getEnabledNetworksAccountCompatibility({
          walletId: 'fixture-wallet',
          enabledNetworkIds,
          filterNetworksWithoutAccount: true,
          indexedAccountId: 'fixture-index',
          withNetworksInfo: true,
        }),
      ).resolves.toEqual({
        compatibleNetworks: [],
        compatibleNetworksWithoutAccount: [],
        networkInfoMap: {},
      });
      expect(
        serviceNetwork.getChainSelectorNetworksCompatibleWithAccountId,
      ).not.toHaveBeenCalled();
      expect(serviceAccount.getAllAccounts).not.toHaveBeenCalled();
    },
  );

  it('returns empty when all persisted mainnets are disabled', async () => {
    const { service, serviceNetwork, state } = setup();
    for (const id of ['evm--1', 'evm--56', 'btc--0', 'sol--101']) {
      state.disabledNetworks[id] = true;
    }
    await expect(
      service.getEnabledNetworksCompatibleWithWalletId({
        walletId: 'fixture-wallet',
      }),
    ).resolves.toEqual([]);
    expect(
      serviceNetwork.getChainSelectorNetworksCompatibleWithAccountId,
    ).not.toHaveBeenCalled();
  });

  it('preserves persisted defaults, disabled networks and wallet compatibility', async () => {
    const { service, serviceNetwork, serviceAccount, state, incompatibleIds } =
      setup();
    state.disabledNetworks['evm--56'] = true;
    state.enabledNetworks['custom--9'] = true;
    state.enabledNetworks['evm--111'] = true;
    incompatibleIds.add('btc--0');
    const result = await service.getEnabledNetworksAccountCompatibility({
      walletId: 'fixture-wallet',
    });
    expect(result.compatibleNetworks.map((item) => item.id)).toEqual([
      'evm--1',
      'sol--101',
      'custom--9',
    ]);
    expect(serviceNetwork.getAllNetworks).toHaveBeenCalledWith({
      excludeTestNetwork: true,
      excludeAllNetworkItem: true,
    });
    expect(serviceAccount.getAllAccounts).not.toHaveBeenCalled();
    expect(result.networkInfoMap).toEqual({});
  });

  it('treats explicit enabled IDs as an override while keeping network order', async () => {
    const { service, state } = setup();
    state.disabledNetworks['evm--1'] = true;
    const result = await service.getEnabledNetworksAccountCompatibility({
      walletId: 'fixture-wallet',
      enabledNetworkIds: ['custom--9', 'evm--1', 'evm--1'],
    });
    expect(result.compatibleNetworks.map((item) => item.id)).toEqual([
      'evm--1',
      'custom--9',
    ]);
  });

  it('resolves accounts per implementation group with one batched id lookup', async () => {
    const { service, serviceAccount, accountsById } = setup();
    accountsById['evm--1'] = [{ deriveType: 'default' }];
    const result = await service.getEnabledNetworksAccountCompatibility({
      walletId: 'fixture-wallet',
      indexedAccountId: 'fixture-index',
      filterNetworksWithoutAccount: true,
    });
    expect(serviceAccount.getAllAccounts).toHaveBeenCalledTimes(1);
    expect(serviceAccount.getAllAccounts).toHaveBeenCalledWith({
      ids: ['evm--1|default', 'btc--0|default', 'sol--101|default'],
    });
    for (const networkId of ['evm--1', 'btc--0', 'sol--101']) {
      expect(
        serviceAccount.getDbAccountIdFromIndexedAccountId,
      ).toHaveBeenCalledWith({
        indexedAccountId: 'fixture-index',
        networkId,
        deriveType: 'default',
      });
    }
    expect(
      result.compatibleNetworksWithoutAccount.map((item) => item.id),
    ).toEqual(['btc--0', 'sol--101']);
    expect(Object.keys(result).toSorted()).toEqual([
      'compatibleNetworks',
      'compatibleNetworksWithoutAccount',
      'networkInfoMap',
    ]);
    expect(JSON.stringify(result)).not.toContain('|default');
  });

  it.each([true, false])(
    'preserves merge-derive selection with merge=%s',
    async (mergeDeriveAssetsEnabled) => {
      const { service, mergeById, accountsById } = setup();
      mergeById['evm--1'] = mergeDeriveAssetsEnabled;
      accountsById['evm--1'] = [{ deriveType: 'alternate' }];
      const result = await service.getEnabledNetworksAccountCompatibility({
        walletId: 'fixture-wallet',
        enabledNetworkIds: ['evm--1', 'evm--56'],
        indexedAccountId: 'fixture-index',
        filterNetworksWithoutAccount: true,
      });
      expect(
        result.compatibleNetworksWithoutAccount.map((item) => item.id),
      ).toEqual(mergeDeriveAssetsEnabled ? [] : ['evm--1', 'evm--56']);
    },
  );

  it('returns per-network derive info alongside account filtering', async () => {
    const { service, serviceNetwork, accountsById, deriveById } = setup();
    deriveById['evm--1'] = 'alternate';
    accountsById['evm--1'] = [{ deriveType: 'alternate' }];
    const result = await service.getEnabledNetworksAccountCompatibility({
      walletId: 'fixture-wallet',
      enabledNetworkIds: ['evm--1', 'evm--56'],
      indexedAccountId: 'fixture-index',
      filterNetworksWithoutAccount: true,
      withNetworksInfo: true,
    });
    expect(result.compatibleNetworksWithoutAccount).toEqual([]);
    expect(result.networkInfoMap).toEqual({
      'evm--1': {
        deriveType: 'alternate',
        mergeDeriveAssetsEnabled: false,
        suffixToDeriveType: { alternate: 'alternate' },
      },
      'evm--56': {
        deriveType: 'default',
        mergeDeriveAssetsEnabled: false,
        suffixToDeriveType: { alternate: 'alternate' },
      },
    });
    // Two derive-info reads plus one per implementation group for filtering.
    expect(serviceNetwork.getVaultSettings).toHaveBeenCalledTimes(3);
    expect(serviceNetwork.getGlobalDeriveTypeOfNetwork).toHaveBeenCalledTimes(
      3,
    );
  });

  it('does not read accounts when the indexed account is absent', async () => {
    const { service, serviceAccount } = setup();
    const result = await service.getEnabledNetworksAccountCompatibility({
      walletId: 'fixture-wallet',
      filterNetworksWithoutAccount: true,
    });
    expect(serviceAccount.getAllAccounts).not.toHaveBeenCalled();
    expect(result.compatibleNetworksWithoutAccount).toEqual([]);
  });
});

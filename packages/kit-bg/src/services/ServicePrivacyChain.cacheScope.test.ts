import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import type { ILocalWalletCapability } from '../vaults/localWallet/types';

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
jest.mock('../states/jotai/atoms', () => ({
  privacyChainAtom: { set: jest.fn(async () => undefined) },
}));
const mockGetVaultSettings = jest.fn();
jest.mock('../vaults/settings', () => ({
  getVaultSettings: (params: { networkId: string }) =>
    mockGetVaultSettings(params) as Promise<{ localWallet?: unknown }>,
}));

const ServicePrivacyChain = require('./ServicePrivacyChain')
  .default as typeof import('./ServicePrivacyChain').default;

// What the lifecycle executor needs on a service made without its
// constructor, plus a background api whose writes are recorded.
function lifecycleHarness() {
  const calls: string[] = [];
  const record =
    (name: string) =>
    async (params?: unknown): Promise<undefined> => {
      calls.push(`${name}:${JSON.stringify(params ?? {})}`);
      return undefined;
    };
  return {
    calls,
    fields: {
      backfillActiveByAccount: {},
      boostPausedByNetwork: {},
      syncFailureBackoff: new Map(),
      orphanCleanupGeneration: new Map(),
      scheduleBackgroundSync: jest.fn(),
    },
    backgroundApi: {
      serviceAccount: {
        getDBAccountSafe: async ({ accountId }: { accountId: string }) => ({
          id: accountId,
        }),
        getWalletSafe: async () => ({ isTemp: false }),
        getAccount: async ({ accountId }: { accountId: string }) => ({
          address: `addr-${accountId}`,
        }),
        getAccountAddressForApi: async () => 'addr',
        getAccountXpub: async () => undefined,
      },
      simpleDb: {
        privacyChainState: {
          rotateAccountEpochs: record('rotate'),
          listScanDataAccountIds: async () => ['paused', 'on'],
        },
        privacyChainCache: {
          removeLastBalances: record('removeLastBalances'),
        },
        localHistory: {
          clearAccountLocalHistory: record('clearHistory'),
        },
        localTokens: { removeAccountTokenList: record('removeTokens') },
        accountValue: { removeAccountNetworkValue: record('removeValue') },
      },
    },
  };
}

describe('Local wallet cache reset scope', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it.each([true, false])(
    'limits a network reset and preserves global cache clearing (scoped: %s)',
    async (scoped) => {
      const selectedNetworkId = 'zec--0';
      const otherNetworkId = 'another-local-network';
      const getLocalWalletNetworkIds = jest.fn(async () => [
        selectedNetworkId,
        otherNetworkId,
      ]);
      mockGetChainOnlyVault.mockResolvedValue({
        getLocalWalletCapability: (): Partial<ILocalWalletCapability> => ({
          listAccounts: async () => ({ accounts: [], cleanupAccountIds: [] }),
        }),
      });
      const harness = lifecycleHarness();
      const service = Object.assign(
        Object.create(ServicePrivacyChain.prototype) as InstanceType<
          typeof ServicePrivacyChain
        >,
        {
          ...harness.fields,
          backgroundApi: harness.backgroundApi,
          getLocalWalletNetworkIds,
        },
      );

      await service.clearTransactionHistoryCache(
        scoped ? { networkId: selectedNetworkId } : undefined,
      );

      expect(mockGetChainOnlyVault.mock.calls).toEqual(
        (scoped
          ? [selectedNetworkId]
          : [selectedNetworkId, otherNetworkId]
        ).map((networkId) => [{ networkId }]),
      );
      expect(getLocalWalletNetworkIds).toHaveBeenCalledTimes(scoped ? 0 : 1);
    },
  );
});

describe('Privacy transaction history cache clear', () => {
  it('leaves paused accounts and their resume position alone', async () => {
    const rewindAccount = jest.fn(async () => undefined);
    mockGetChainOnlyVault.mockResolvedValue({
      getLocalWalletCapability: (): Partial<ILocalWalletCapability> => ({
        listAccounts: async () => ({
          accounts: [
            {
              accountId: 'on',
              runtimeKey: 'main',
              accountRuntimeKey: 'k-on',
              syncEnabled: true,
              slotEnabled: true,
            },
            {
              accountId: 'on-alias',
              runtimeKey: 'main',
              accountRuntimeKey: 'k-on',
              syncEnabled: true,
              slotEnabled: true,
            },
            {
              accountId: 'paused',
              runtimeKey: 'main',
              accountRuntimeKey: 'k-paused',
              syncEnabled: false,
              slotEnabled: false,
            },
          ],
          cleanupAccountIds: [],
        }),
        getAccountAliases: async ({ accountId }) =>
          accountId === 'on' ? ['on', 'on-alias'] : [accountId],
        rewindAccount,
      }),
    });
    const harness = lifecycleHarness();
    const service = Object.assign(
      Object.create(ServicePrivacyChain.prototype) as InstanceType<
        typeof ServicePrivacyChain
      >,
      { ...harness.fields, backgroundApi: harness.backgroundApi },
    );

    await service.clearTransactionHistoryCache({ networkId: 'zec--0' });

    // One rewind per identity; the alias shares it.
    expect(rewindAccount.mock.calls).toEqual([[{ accountId: 'on' }]]);
    expect(harness.calls).toContain('rotate:{"accountIds":["on","on-alias"]}');
    expect(harness.calls.join('\n')).not.toContain('paused');
  });
});

// A database that cannot be opened is exactly when Settings must offer a reset.
describe('Privacy storage reset when the database cannot be read', () => {
  function createService(capability: Partial<ILocalWalletCapability>) {
    mockGetChainOnlyVault.mockResolvedValue({
      getLocalWalletCapability: () => capability,
    });
    return Object.create(ServicePrivacyChain.prototype) as InstanceType<
      typeof ServicePrivacyChain
    >;
  }

  it('reports the size as unknown instead of hiding it', async () => {
    const service = createService({
      getStorageUsage: async () => {
        throw new OneKeyLocalError('DATABASE_ERROR');
      },
    });
    await expect(
      service.getLocalWalletNetworkInfo({ networkId: 'xmr--0' }),
    ).resolves.toMatchObject({ storageBytes: null });
  });

  it('rebuilds the whole database for every account holding scan data', async () => {
    const harness = lifecycleHarness();
    const resetStorage = jest.fn(async () => {
      harness.calls.push('resetStorage');
    });
    const service = createService({
      resetStorage,
      listAccounts: async () => ({ accounts: [], cleanupAccountIds: [] }),
    });
    Object.assign(service, {
      ...harness.fields,
      backgroundApi: harness.backgroundApi,
    });
    await service.clearTransactionHistoryCache({ networkId: 'xmr--0' });
    expect(resetStorage).toHaveBeenCalledTimes(1);
    // Paused accounts lose their scan data too, so no saved balance survives;
    // their epochs move before the database goes, and once more after, for a
    // read that took the first new epoch.
    expect(harness.calls.slice(0, 4)).toEqual([
      'rotate:{"accountIds":["paused","on"]}',
      'resetStorage',
      'rotate:{"accountIds":["paused","on"]}',
      'removeLastBalances:{"accountIds":["paused","on"]}',
    ]);
  });
});

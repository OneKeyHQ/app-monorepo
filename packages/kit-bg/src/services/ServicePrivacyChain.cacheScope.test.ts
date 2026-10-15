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
      const service = Object.assign(
        Object.create(ServicePrivacyChain.prototype) as InstanceType<
          typeof ServicePrivacyChain
        >,
        { getLocalWalletNetworkIds },
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
              accountId: 'paused',
              runtimeKey: 'main',
              accountRuntimeKey: 'k-paused',
              syncEnabled: false,
              slotEnabled: false,
            },
          ],
          cleanupAccountIds: [],
        }),
      }),
    });
    const repairLocalChainDataImpl = jest.fn(async () => undefined);
    const service = Object.assign(
      Object.create(ServicePrivacyChain.prototype) as {
        clearTransactionHistoryCache: (params: {
          networkId: string;
        }) => Promise<void>;
      },
      {
        repairLocalChainDataImpl,
        backgroundApi: {
          serviceAccount: {
            getDBAccountSafe: async ({ accountId }: { accountId: string }) => ({
              id: accountId,
            }),
          },
        },
      },
    );

    await service.clearTransactionHistoryCache({ networkId: 'zec--0' });

    expect(repairLocalChainDataImpl).toHaveBeenCalledTimes(1);
    expect(repairLocalChainDataImpl).toHaveBeenCalledWith(
      expect.objectContaining({ accountId: 'on' }),
    );
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

  it('rebuilds the whole database before the per-account reset', async () => {
    const resetStorage = jest.fn(async () => undefined);
    const removeNetworkLastBalances = jest.fn(async () => undefined);
    const service = createService({
      resetStorage,
      listAccounts: async () => ({ accounts: [], cleanupAccountIds: [] }),
    });
    Object.assign(service, {
      backgroundApi: {
        simpleDb: { privacyChainCache: { removeNetworkLastBalances } },
      },
    });
    await service.clearTransactionHistoryCache({ networkId: 'xmr--0' });
    expect(resetStorage).toHaveBeenCalledTimes(1);
    // Paused accounts lose their scan data too, so no saved balance survives.
    expect(removeNetworkLastBalances).toHaveBeenCalledWith({
      networkId: 'xmr--0',
    });
  });
});

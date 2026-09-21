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

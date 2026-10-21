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

const ServicePrivacyChain = require('./ServicePrivacyChain')
  .default as typeof import('./ServicePrivacyChain').default;

const ZEC = 'zec--0';
const XMR = 'xmr--0';

describe('clear pending sends for the selected account', () => {
  function createService(
    accountsByNetwork: Record<string, { account?: { id: string } }[]> = {},
  ) {
    const clearPendingSends = jest.fn(async () => undefined);
    mockGetChainOnlyVault.mockImplementation(
      async ({ networkId }: { networkId: string }) => ({
        getLocalWalletCapability: () =>
          // XMR keeps no local send locks.
          networkId === ZEC ? { clearPendingSends } : {},
      }),
    );
    const getNetworkAccountsInSameIndexedAccountIdWithDeriveTypes = jest.fn(
      async ({ networkId }: { networkId: string }) => ({
        networkAccounts: accountsByNetwork[networkId] ?? [],
      }),
    );
    const service = Object.assign(
      Object.create(ServicePrivacyChain.prototype) as InstanceType<
        typeof ServicePrivacyChain
      >,
      {
        getLocalWalletNetworkIds: async () => [ZEC, XMR],
        backgroundApi: {
          serviceAccount: {
            getNetworkAccountsInSameIndexedAccountIdWithDeriveTypes,
          },
        },
      },
    );
    return {
      service,
      clearPendingSends,
      getNetworkAccountsInSameIndexedAccountIdWithDeriveTypes,
    };
  }

  afterEach(() => {
    mockGetChainOnlyVault.mockReset();
  });

  it('clears only the selected privacy-chain account', async () => {
    const { service, clearPendingSends } = createService();
    await service.clearSelectedAccountLocalWalletPendingSends({
      networkId: ZEC,
      accountId: 'hd-1--zec-0',
      indexedAccountId: 'hd-1--0',
    });
    expect(clearPendingSends).toHaveBeenCalledTimes(1);
    expect(clearPendingSends).toHaveBeenCalledWith({
      networkId: ZEC,
      accountId: 'hd-1--zec-0',
    });
  });

  it('leaves privacy chains alone when another chain is selected', async () => {
    const { service, clearPendingSends } = createService();
    await service.clearSelectedAccountLocalWalletPendingSends({
      networkId: 'evm--1',
      accountId: 'hd-1--evm-0',
      indexedAccountId: 'hd-1--0',
    });
    expect(mockGetChainOnlyVault).not.toHaveBeenCalled();
    expect(clearPendingSends).not.toHaveBeenCalled();
  });

  it('clears the selected account on each privacy chain under All Networks', async () => {
    const {
      service,
      clearPendingSends,
      getNetworkAccountsInSameIndexedAccountIdWithDeriveTypes,
    } = createService({
      [ZEC]: [{ account: { id: 'hd-1--zec-0' } }, {}],
      [XMR]: [{ account: { id: 'hd-1--xmr-0' } }],
    });
    await service.clearSelectedAccountLocalWalletPendingSends({
      networkId: 'onekeyall--0',
      accountId: 'hd-1--all-0',
      indexedAccountId: 'hd-1--0',
    });
    expect(
      getNetworkAccountsInSameIndexedAccountIdWithDeriveTypes,
    ).toHaveBeenCalledWith(
      expect.objectContaining({ networkId: ZEC, indexedAccountId: 'hd-1--0' }),
    );
    expect(clearPendingSends).toHaveBeenCalledTimes(1);
    expect(clearPendingSends).toHaveBeenCalledWith({
      networkId: ZEC,
      accountId: 'hd-1--zec-0',
    });
  });
});

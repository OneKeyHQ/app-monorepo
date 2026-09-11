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

describe('Local wallet receive addresses', () => {
  const networkId = 'zec--0';
  const accountId = "hd-1--m/44'/133'/0'";

  afterEach(() => {
    jest.resetAllMocks();
  });

  function createService(enabled: boolean) {
    mockGetVaultSettings.mockResolvedValue({ localWallet: {} });
    const getAccountAddresses = jest.fn(async () => ({
      publicAddress: 't1-address',
      privateAddress: 'u1-address',
    }));
    mockGetChainOnlyVault.mockResolvedValue({
      getLocalWalletCapability: (): Partial<ILocalWalletCapability> => ({
        getAccountAddresses,
        getAccountState: async () => ({ enabled, preferPublicSends: false }),
      }),
    });
    return Object.assign(
      Object.create(ServicePrivacyChain.prototype) as {
        getLocalWalletAccountAddresses: (params: {
          networkId: string;
          accountId: string;
        }) => Promise<{ publicAddress: string; privateAddress?: string }>;
      },
      { backgroundApi: {} },
    );
  }

  it('exposes both forms while the account is enabled', async () => {
    const service = createService(true);

    await expect(
      service.getLocalWalletAccountAddresses({ networkId, accountId }),
    ).resolves.toEqual({
      publicAddress: 't1-address',
      privateAddress: 'u1-address',
    });
  });

  it('withholds the private form once scanning is paused', async () => {
    const service = createService(false);

    await expect(
      service.getLocalWalletAccountAddresses({ networkId, accountId }),
    ).resolves.toEqual({
      publicAddress: 't1-address',
      privateAddress: undefined,
    });
  });
});

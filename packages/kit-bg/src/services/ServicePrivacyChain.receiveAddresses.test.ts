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
        getAccountState: async () => ({
          enabled,
          paused: false,
        }),
      }),
    });
    return Object.assign(
      Object.create(ServicePrivacyChain.prototype) as {
        getLocalWalletAccountAddresses: (params: {
          networkId: string;
          accountId: string;
        }) => Promise<{ publicAddress: string; privateAddress?: string }>;
      },
      {
        backgroundApi: {
          serviceAccount: { getWalletSafe: async () => ({ isTemp: false }) },
        },
      },
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

describe('Local wallet send readiness', () => {
  const networkId = 'xmr--0';
  const accountId = 'account';

  afterEach(() => {
    jest.resetAllMocks();
  });

  function createService(
    progress: unknown,
    syncPolicy: { sendMaxBlocksLeft?: number } = { sendMaxBlocksLeft: 100 },
    accountState: { enabled: boolean; paused: boolean } = {
      enabled: true,
      paused: false,
    },
  ) {
    mockGetVaultSettings.mockResolvedValue({ localWallet: {} });
    mockGetChainOnlyVault.mockResolvedValue({
      getLocalWalletCapability: () => ({ syncPolicy }),
    });
    return Object.assign(
      Object.create(ServicePrivacyChain.prototype) as {
        getLocalWalletSendReadiness: (params: {
          networkId: string;
          accountId: string;
        }) => Promise<
          { blocksLeft: number | null; canSend: boolean } | undefined
        >;
      },
      {
        getLocalWalletSyncProgress: async () => progress,
        getLocalWalletAccountState: async () => accountState,
      },
    );
  }

  const behind = (backfill: number, tipLag: number) => ({
    isBackfillComplete: backfill === 0,
    backfillScannedHeight: 1000 - backfill,
    backfillTargetHeight: 1000,
    tipLag,
  });

  it('blocks sending at the threshold', async () => {
    await expect(
      createService(behind(60, 40)).getLocalWalletSendReadiness({
        networkId,
        accountId,
      }),
    ).resolves.toEqual({ blocksLeft: 100, canSend: false });
  });

  it('allows sending below it', async () => {
    await expect(
      createService(behind(0, 99)).getLocalWalletSendReadiness({
        networkId,
        accountId,
      }),
    ).resolves.toEqual({ blocksLeft: 99, canSend: true });
  });

  it('says nothing on a chain that never waits for the scan', async () => {
    await expect(
      createService(behind(5000, 0), {}).getLocalWalletSendReadiness({
        networkId: 'zec--0',
        accountId,
      }),
    ).resolves.toBeUndefined();
  });

  it('says nothing for an account that never scanned', async () => {
    await expect(
      createService(undefined, undefined, {
        enabled: false,
        paused: false,
      }).getLocalWalletSendReadiness({ networkId, accountId }),
    ).resolves.toBeUndefined();
  });

  it('blocks sending while the account is paused', async () => {
    await expect(
      createService(undefined, undefined, {
        enabled: false,
        paused: true,
      }).getLocalWalletSendReadiness({ networkId, accountId }),
    ).resolves.toEqual({ blocksLeft: null, canSend: false });
  });
});

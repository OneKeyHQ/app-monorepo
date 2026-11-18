jest.mock('@onekeyhq/shared/src/background/backgroundDecorators');
const mockGetLatestHeight = jest.fn<Promise<number | null>, []>();
let mockHasHeightSource = true;
jest.mock('../vaults/factory', () => ({
  vaultFactory: {
    getChainOnlyVault: jest.fn(async () => ({
      getLocalWalletCapability: () =>
        mockHasHeightSource ? { getLatestHeight: mockGetLatestHeight } : {},
    })),
  },
}));
jest.mock('../vaults/settings', () => ({
  getVaultSettings: jest.fn(async () => ({ localWallet: {} })),
}));

const ServicePrivacyChain = require('./ServicePrivacyChain')
  .default as typeof import('./ServicePrivacyChain').default;

function createService(paused = false) {
  return Object.assign(
    Object.create(ServicePrivacyChain.prototype) as InstanceType<
      typeof ServicePrivacyChain
    >,
    {
      backgroundApi: {},
      boostPausedByNetwork: paused ? { 'zec--0': true } : {},
    },
  );
}

describe('local wallet latest height for the sync start dialog', () => {
  beforeEach(() => {
    mockGetLatestHeight.mockReset();
    mockHasHeightSource = true;
  });

  it('returns the height the chain source reports', async () => {
    mockGetLatestHeight.mockResolvedValue(3_600_000);
    await expect(
      createService().getLocalWalletLatestHeight({ networkId: 'zec--0' }),
    ).resolves.toBe(3_600_000);
  });

  // A cached tip trails the chain and would reject real heights.
  it.each([
    [
      'fails',
      () => mockGetLatestHeight.mockRejectedValue(new Error('offline')),
    ],
    ['has no tip', () => mockGetLatestHeight.mockResolvedValue(null)],
  ])('sets no bound when the source %s', async (_label, set) => {
    set();
    await expect(
      createService().getLocalWalletLatestHeight({ networkId: 'zec--0' }),
    ).resolves.toBeNull();
  });

  it('makes no request and sets no bound for a paused chain', async () => {
    await expect(
      createService(true).getLocalWalletLatestHeight({ networkId: 'zec--0' }),
    ).resolves.toBeNull();
    expect(mockGetLatestHeight).not.toHaveBeenCalled();
  });

  it('sets no bound for a chain without a height source', async () => {
    mockHasHeightSource = false;
    await expect(
      createService().getLocalWalletLatestHeight({ networkId: 'zec--0' }),
    ).resolves.toBeNull();
  });
});

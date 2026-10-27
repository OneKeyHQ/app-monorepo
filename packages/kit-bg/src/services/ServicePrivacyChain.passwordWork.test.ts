jest.mock('@onekeyhq/shared/src/background/backgroundDecorators');

const mockGetVault = jest.fn();
jest.mock('../vaults/factory', () => ({
  vaultFactory: { getVault: mockGetVault },
}));
jest.mock('../states/jotai/atoms', () => ({
  privacyChainAtom: { set: jest.fn(async () => undefined) },
}));

const ServicePrivacyChain = require('./ServicePrivacyChain')
  .default as typeof import('./ServicePrivacyChain').default;

describe('Privacy password verification on request', () => {
  const params = { networkId: 'xmr--0', accountId: 'account' };

  afterEach(() => {
    jest.resetAllMocks();
  });

  function createService(hasWork: boolean) {
    const localWalletDoPasswordWork = jest.fn(async () => true);
    mockGetVault.mockResolvedValue({
      localWalletHasDeviceWork: async () => false,
      localWalletHasPasswordWork: async () => hasWork,
      localWalletDoPasswordWork,
    });
    const promptPasswordVerifyByAccount = jest.fn(async () => ({
      password: 'synthetic-test-password',
    }));
    const service = Object.assign(
      Object.create(ServicePrivacyChain.prototype) as {
        verifyLocalWalletWithPassword: (p: typeof params) => Promise<void>;
      },
      { backgroundApi: { servicePassword: { promptPasswordVerifyByAccount } } },
    );
    return {
      service,
      localWalletDoPasswordWork,
      promptPasswordVerifyByAccount,
    };
  }

  it('asks for the password and uses it, cached or not', async () => {
    const {
      service,
      localWalletDoPasswordWork,
      promptPasswordVerifyByAccount,
    } = createService(true);

    await service.verifyLocalWalletWithPassword(params);

    expect(promptPasswordVerifyByAccount).toHaveBeenCalledTimes(1);
    expect(localWalletDoPasswordWork).toHaveBeenCalledWith({
      password: 'synthetic-test-password',
    });
  });

  it('does not ask when nothing needs the password', async () => {
    const { service, promptPasswordVerifyByAccount } = createService(false);

    await service.verifyLocalWalletWithPassword(params);

    expect(promptPasswordVerifyByAccount).not.toHaveBeenCalled();
  });
});

describe('Privacy device verification on request', () => {
  const params = { networkId: 'xmr--0', accountId: 'hw-1--account' };
  const deviceParams = { dbDevice: { connectId: 'c', deviceId: 'd' } };

  afterEach(() => {
    jest.resetAllMocks();
  });

  function createService(found: typeof deviceParams | undefined) {
    const localWalletDoDeviceWork = jest.fn(async () => true);
    mockGetVault.mockResolvedValue({
      localWalletHasDeviceWork: async () => true,
      localWalletDoDeviceWork,
      localWalletHasPasswordWork: async () => false,
    });
    const promptPasswordVerifyByAccount = jest.fn();
    const getWalletDeviceParams = jest.fn(async () => found);
    const withHardwareProcessing = jest.fn(async (fn: () => Promise<unknown>) =>
      fn(),
    );
    const service = Object.assign(
      Object.create(ServicePrivacyChain.prototype) as {
        verifyLocalWalletWithPassword: (p: typeof params) => Promise<void>;
      },
      {
        backgroundApi: {
          servicePassword: { promptPasswordVerifyByAccount },
          serviceAccount: { getWalletDeviceParams },
          serviceHardwareUI: { withHardwareProcessing },
        },
      },
    );
    return {
      service,
      localWalletDoDeviceWork,
      promptPasswordVerifyByAccount,
      getWalletDeviceParams,
      withHardwareProcessing,
    };
  }

  it('syncs key images with the device instead of asking for a password', async () => {
    const {
      service,
      localWalletDoDeviceWork,
      promptPasswordVerifyByAccount,
      getWalletDeviceParams,
      withHardwareProcessing,
    } = createService(deviceParams);

    await service.verifyLocalWalletWithPassword(params);

    expect(getWalletDeviceParams).toHaveBeenCalledWith(
      expect.objectContaining({ walletId: 'hw-1' }),
    );
    expect(withHardwareProcessing).toHaveBeenCalledTimes(1);
    expect(localWalletDoDeviceWork).toHaveBeenCalledWith({ deviceParams });
    expect(promptPasswordVerifyByAccount).not.toHaveBeenCalled();
  });

  it('does nothing without a device for the wallet', async () => {
    const { service, localWalletDoDeviceWork } = createService(undefined);

    await service.verifyLocalWalletWithPassword(params);

    expect(localWalletDoDeviceWork).not.toHaveBeenCalled();
  });
});

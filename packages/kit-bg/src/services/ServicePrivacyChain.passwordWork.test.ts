import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';

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

describe('Privacy password verification on entering a send', () => {
  const params = { networkId: 'xmr--0', accountId: 'account' };

  afterEach(() => {
    jest.restoreAllMocks();
    jest.resetAllMocks();
  });

  function createService({
    enabled,
    hasWork = async () => true,
  }: {
    enabled: boolean;
    hasWork?: () => Promise<boolean>;
  }) {
    const localWalletHasPasswordWork = jest.fn(hasWork);
    const localWalletDoPasswordWork = jest.fn(async () => true);
    mockGetVault.mockResolvedValue({
      localWalletHasDeviceWork: async () => false,
      localWalletHasPasswordWork,
      localWalletDoPasswordWork,
    });
    const promptPasswordVerifyByAccount = jest.fn(async () => ({
      password: 'synthetic-test-password',
    }));
    const service = Object.assign(
      Object.create(ServicePrivacyChain.prototype) as {
        maybeVerifyLocalWalletOnSend: (p: typeof params) => Promise<void>;
      },
      {
        backgroundApi: { servicePassword: { promptPasswordVerifyByAccount } },
        getLocalWalletAccountState: jest.fn(async () => ({
          enabled,
          paused: !enabled,
        })),
      },
    );
    const toast = jest.spyOn(errorToastUtils, 'toastIfError');
    return {
      service,
      localWalletHasPasswordWork,
      localWalletDoPasswordWork,
      promptPasswordVerifyByAccount,
      toast,
    };
  }

  it('leaves an account that does not scan alone', async () => {
    const {
      service,
      localWalletHasPasswordWork,
      promptPasswordVerifyByAccount,
      toast,
    } = createService({ enabled: false });

    await service.maybeVerifyLocalWalletOnSend(params);

    expect(mockGetVault).not.toHaveBeenCalled();
    expect(localWalletHasPasswordWork).not.toHaveBeenCalled();
    expect(promptPasswordVerifyByAccount).not.toHaveBeenCalled();
    expect(toast).not.toHaveBeenCalled();
  });

  it('asks for the password for a scanning account, as a tap does', async () => {
    const {
      service,
      localWalletDoPasswordWork,
      promptPasswordVerifyByAccount,
    } = createService({ enabled: true });

    await service.maybeVerifyLocalWalletOnSend(params);

    expect(promptPasswordVerifyByAccount).toHaveBeenCalledTimes(1);
    expect(localWalletDoPasswordWork).toHaveBeenCalledWith({
      password: 'synthetic-test-password',
    });
  });

  it('logs a runtime failure instead of raising or toasting it', async () => {
    const { service, promptPasswordVerifyByAccount, toast } = createService({
      enabled: true,
      hasWork: async () => {
        throw new OneKeyLocalError('xmr: runtime unavailable');
      },
    });
    const log = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    await expect(
      service.maybeVerifyLocalWalletOnSend(params),
    ).resolves.toBeUndefined();

    expect(promptPasswordVerifyByAccount).not.toHaveBeenCalled();
    expect(toast).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(
      '[privacy-chain] send verification skipped',
      expect.objectContaining({ message: 'xmr: runtime unavailable' }),
    );
  });
});

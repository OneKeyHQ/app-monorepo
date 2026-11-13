import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

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
        maybeVerifyLocalWalletOnSend: (p: typeof params) => Promise<void>;
        getLocalWalletVerifyAmount: (
          p: typeof params,
        ) => Promise<string | undefined>;
      },
      {
        backgroundApi: {
          servicePassword: {
            promptPasswordVerifyByAccount,
            hasCachedPassword: async () => true,
          },
          serviceAccount: { getWalletDeviceParams },
          serviceHardwareUI: { withHardwareProcessing },
        },
        getLocalWalletAccountState: jest.fn(async () => ({ enabled: true })),
        getLocalWalletAccountBalance: jest.fn(async () => ({
          frozen: [{ reason: 'needsPassword', amountParsed: '0.35' }],
        })),
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

  // The send page explains and asks the device once the user sends.
  it('does not ask the device on entering a send', async () => {
    const {
      service,
      localWalletDoDeviceWork,
      getWalletDeviceParams,
      promptPasswordVerifyByAccount,
    } = createService(deviceParams);

    await service.maybeVerifyLocalWalletOnSend(params);

    expect(getWalletDeviceParams).not.toHaveBeenCalled();
    expect(localWalletDoDeviceWork).not.toHaveBeenCalled();
    expect(promptPasswordVerifyByAccount).not.toHaveBeenCalled();
  });

  it('tells the send page how much the device must verify', async () => {
    const { service } = createService(deviceParams);

    await expect(service.getLocalWalletVerifyAmount(params)).resolves.toBe(
      '0.35',
    );

    mockGetVault.mockResolvedValue({
      localWalletHasDeviceWork: async () => false,
      localWalletHasPasswordWork: async () => false,
    });
    await expect(
      service.getLocalWalletVerifyAmount(params),
    ).resolves.toBeUndefined();
  });

  it('tells the send page how much an unlock must verify', async () => {
    const { service } = createService(deviceParams);
    mockGetVault.mockResolvedValue({
      localWalletHasDeviceWork: async () => false,
      localWalletHasPasswordWork: async () => true,
    });

    await expect(service.getLocalWalletVerifyAmount(params)).resolves.toBe(
      '0.35',
    );
  });
});

describe('Privacy password verification on entering a send', () => {
  const params = { networkId: 'xmr--0', accountId: 'account' };

  afterEach(() => {
    jest.restoreAllMocks();
    jest.resetAllMocks();
  });

  const cached = 'synthetic-test-password';

  function createService({
    enabled,
    cachedPassword,
    alwaysReenter = false,
    hasWork = async () => true,
  }: {
    enabled: boolean;
    cachedPassword?: string;
    alwaysReenter?: boolean;
    hasWork?: () => Promise<boolean>;
  }) {
    const localWalletHasPasswordWork = jest.fn(hasWork);
    const localWalletDoPasswordWork = jest.fn(async () => true);
    mockGetVault.mockResolvedValue({
      localWalletHasDeviceWork: async () => false,
      localWalletHasPasswordWork,
      localWalletDoPasswordWork,
    });
    const promptPasswordVerifyByAccount = jest.fn();
    const service = Object.assign(
      Object.create(ServicePrivacyChain.prototype) as {
        maybeVerifyLocalWalletOnSend: (p: typeof params) => Promise<void>;
      },
      {
        backgroundApi: {
          servicePassword: {
            promptPasswordVerifyByAccount,
            hasCachedPassword: async () => Boolean(cachedPassword),
            getCachedPassword: async () => cachedPassword,
            isAlwaysReenterPassword: async () => alwaysReenter,
          },
        },
        getLocalWalletAccountState: jest.fn(async () => ({
          enabled,
          paused: !enabled,
        })),
      },
    );
    const toast = jest.spyOn(errorToastUtils, 'toastIfError');
    const emit = jest.spyOn(appEventBus, 'emit');
    return {
      service,
      localWalletHasPasswordWork,
      localWalletDoPasswordWork,
      promptPasswordVerifyByAccount,
      toast,
      emit,
    };
  }

  it('leaves an account that does not scan alone', async () => {
    const {
      service,
      localWalletHasPasswordWork,
      promptPasswordVerifyByAccount,
      toast,
    } = createService({ enabled: false, cachedPassword: cached });

    await service.maybeVerifyLocalWalletOnSend(params);

    expect(mockGetVault).not.toHaveBeenCalled();
    expect(localWalletHasPasswordWork).not.toHaveBeenCalled();
    expect(promptPasswordVerifyByAccount).not.toHaveBeenCalled();
    expect(toast).not.toHaveBeenCalled();
  });

  it('verifies with a cached password without asking', async () => {
    const {
      service,
      localWalletDoPasswordWork,
      promptPasswordVerifyByAccount,
      emit,
    } = createService({ enabled: true, cachedPassword: cached });

    await service.maybeVerifyLocalWalletOnSend(params);

    expect(promptPasswordVerifyByAccount).not.toHaveBeenCalled();
    expect(localWalletDoPasswordWork).toHaveBeenCalledWith({
      password: cached,
    });
    expect(emit).toHaveBeenCalledWith(EAppEventBusNames.RefreshTokenList, {
      accounts: [params],
    });
  });

  // The send page explains and asks once the user sends.
  it.each([
    { when: 'without a cached password', cachedPassword: undefined },
    {
      when: 'when every transaction needs the password',
      cachedPassword: cached,
      alwaysReenter: true,
    },
  ])(
    'never asks for the password $when',
    async ({ cachedPassword, alwaysReenter }) => {
      const {
        service,
        localWalletDoPasswordWork,
        promptPasswordVerifyByAccount,
      } = createService({ enabled: true, cachedPassword, alwaysReenter });

      await service.maybeVerifyLocalWalletOnSend(params);

      expect(promptPasswordVerifyByAccount).not.toHaveBeenCalled();
      expect(localWalletDoPasswordWork).not.toHaveBeenCalled();
    },
  );

  it('logs a runtime failure instead of raising or toasting it', async () => {
    const { service, promptPasswordVerifyByAccount, toast } = createService({
      enabled: true,
      cachedPassword: cached,
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
      '[privacy-chain] password work failed',
      expect.objectContaining({ message: 'xmr: runtime unavailable' }),
    );
  });
});

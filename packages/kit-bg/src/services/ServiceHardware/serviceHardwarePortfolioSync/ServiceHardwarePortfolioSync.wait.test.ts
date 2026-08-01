import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import { currencyPersistAtom } from '../../../states/jotai/atoms';

import ServiceHardwarePortfolioSync from './ServiceHardwarePortfolioSync';

import type { IPortfolioSyncSettledPayload } from './serviceHardwarePortfolioSyncUtils';
import type { IBackgroundApi } from '../../../apis/IBackgroundApi';

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => (target: unknown) => target,
  backgroundMethod:
    () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) =>
      descriptor,
  backgroundMethodForDev:
    () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) =>
      descriptor,
}));

jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: {
    AllNetworksTokenListSettled: 'AllNetworksTokenListSettled',
  },
  appEventBus: { on: jest.fn(), off: jest.fn() },
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isDev: false, isJest: true },
}));

jest.mock('@onekeyhq/shared/src/utils/accountUtils', () => ({
  __esModule: true,
  default: {
    isHwWallet: jest.fn(),
    shortenAddress: jest.fn(({ address }: { address: string }) => address),
  },
}));

jest.mock('../../../states/jotai/atoms', () => ({
  currencyPersistAtom: { get: jest.fn() },
  settingsPersistAtom: { get: jest.fn() },
}));

jest.mock('../../../states/jotai/atoms/devSettings', () => ({
  devSettingsPersistAtom: {
    get: jest.fn().mockResolvedValue({
      enabled: true,
      settings: {
        enablePortfolioSyncDev: true,
        enablePro2TestMode: true,
      },
    }),
  },
  isPro2DebugModuleEnabled: jest.fn().mockReturnValue(true),
}));

describe('ServiceHardwarePortfolioSync.waitForActivePortfolioSync', () => {
  test('waits for the active upload instead of cancelling it', async () => {
    const service = new ServiceHardwarePortfolioSync({
      backgroundApi: {} as IBackgroundApi,
    });
    let resolveUpload:
      | ((value: { portfolioUpdated: boolean }) => void)
      | undefined;
    const uploadPromise = new Promise<{ portfolioUpdated: boolean }>(
      (resolve) => {
        resolveUpload = resolve;
      },
    );
    const activeUploads = new Map([['PRO2_CONNECT_ID', uploadPromise]]);
    (
      service as unknown as {
        activeUploadByConnectId: Map<
          string,
          Promise<{ portfolioUpdated: boolean }>
        >;
      }
    ).activeUploadByConnectId = activeUploads;

    let completed = false;
    const waiting = service
      .waitForActivePortfolioSync({ connectId: 'PRO2_CONNECT_ID' })
      .then((result) => {
        completed = true;
        return result;
      });

    await Promise.resolve();
    expect(completed).toBe(false);

    resolveUpload?.({ portfolioUpdated: true });
    await expect(waiting).resolves.toBe(true);
  });

  test('returns immediately when the device has no active upload', async () => {
    const service = new ServiceHardwarePortfolioSync({
      backgroundApi: {} as IBackgroundApi,
    });

    await expect(
      service.waitForActivePortfolioSync({ connectId: 'PRO2_CONNECT_ID' }),
    ).resolves.toBe(false);
  });
});

describe('ServiceHardwarePortfolioSync settled event debounce', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  test('debounces each sync target independently', () => {
    const service = new ServiceHardwarePortfolioSync({
      backgroundApi: {} as IBackgroundApi,
    });
    const serviceInternals = service as unknown as {
      handleAllNetworksTokenListSettled: (
        eventPayload: IPortfolioSyncSettledPayload,
      ) => void;
      syncSettledPortfolio: jest.Mock<
        Promise<void>,
        [IPortfolioSyncSettledPayload]
      >;
    };
    serviceInternals.syncSettledPortfolio = jest
      .fn<Promise<void>, [IPortfolioSyncSettledPayload]>()
      .mockResolvedValue(undefined);
    const buildPayload = ({
      connectId,
      totalFiat,
    }: {
      connectId: string;
      totalFiat: string;
    }) =>
      ({
        aggregateTokenMap: {},
        deviceConnectId: connectId,
        totalFiat,
        totalTokenCount: 0,
        tokenMap: {},
        tokens: [],
        walletId: `hw-${connectId}`,
        walletType: 'hw',
      }) as IPortfolioSyncSettledPayload;

    serviceInternals.handleAllNetworksTokenListSettled(
      buildPayload({ connectId: 'PRO2_A', totalFiat: '1' }),
    );
    serviceInternals.handleAllNetworksTokenListSettled(
      buildPayload({ connectId: 'PRO2_B', totalFiat: '2' }),
    );
    serviceInternals.handleAllNetworksTokenListSettled(
      buildPayload({ connectId: 'PRO2_A', totalFiat: '3' }),
    );

    jest.advanceTimersByTime(1000);

    expect(serviceInternals.syncSettledPortfolio).toHaveBeenCalledTimes(2);
    expect(serviceInternals.syncSettledPortfolio).toHaveBeenCalledWith(
      expect.objectContaining({
        deviceConnectId: 'PRO2_A',
        totalFiat: '3',
      }),
    );
    expect(serviceInternals.syncSettledPortfolio).toHaveBeenCalledWith(
      expect.objectContaining({
        deviceConnectId: 'PRO2_B',
        totalFiat: '2',
      }),
    );
  });

  test('cancels an older hardware-busy retry as soon as a newer event arrives', async () => {
    const service = new ServiceHardwarePortfolioSync({
      backgroundApi: {} as IBackgroundApi,
    });
    const retry = jest.fn().mockResolvedValue(undefined);
    const serviceInternals = service as unknown as {
      handleAllNetworksTokenListSettled: (
        eventPayload: IPortfolioSyncSettledPayload,
      ) => void;
      scheduleHardwareBusyRetry: (params: {
        deviceConnectId: string;
        retry: () => Promise<void>;
      }) => void;
      syncSettledPortfolio: jest.Mock;
    };
    serviceInternals.syncSettledPortfolio = jest
      .fn()
      .mockResolvedValue(undefined);
    serviceInternals.scheduleHardwareBusyRetry({
      deviceConnectId: 'PRO2_A',
      retry,
    });

    serviceInternals.handleAllNetworksTokenListSettled({
      aggregateTokenMap: {},
      deviceConnectId: 'PRO2_A',
      totalFiat: '2',
      totalTokenCount: 0,
      tokenMap: {},
      tokens: [],
      walletId: 'hw-PRO2_A',
      walletType: 'hw',
    } as IPortfolioSyncSettledPayload);

    await jest.advanceTimersByTimeAsync(1000);

    expect(retry).not.toHaveBeenCalled();
    expect(serviceInternals.syncSettledPortfolio).toHaveBeenCalledTimes(1);
  });
});

describe('ServiceHardwarePortfolioSync.syncSettledPortfolio', () => {
  function buildHardwarePayload() {
    return {
      accountAddress: '0x1234567890abcdef',
      accountId: 'evm--1',
      aggregateTokenMap: {},
      deviceConnectId: 'PRO2_CONNECT_ID',
      totalFiat: '0.00007276',
      totalTokenCount: 1,
      tokenMap: {
        eth: {
          balance: '0.00007276',
          balanceParsed: '0.00007276',
          currency: 'usd',
          fiatValue: '0.1',
          price: 1374.38,
        },
      },
      tokens: [
        {
          $key: 'eth',
          address: '',
          decimals: 18,
          isNative: true,
          name: 'Ethereum',
          networkId: 'evm--1',
          symbol: 'ETH',
        },
      ],
      walletId: 'hw-1',
      walletType: 'hw',
    } as unknown as IPortfolioSyncSettledPayload;
  }

  function prepareHardwareSync({ busyResults }: { busyResults: boolean[] }) {
    const uploadPortfolioPackage = jest
      .fn()
      .mockResolvedValue({ portfolioUpdated: true });
    const updateTargetState = jest.fn().mockResolvedValue(undefined);
    const isHardwareChannelBusy = jest.fn();
    for (const busy of busyResults) {
      isHardwareChannelBusy.mockResolvedValueOnce(busy);
    }
    isHardwareChannelBusy.mockResolvedValue(false);
    const service = new ServiceHardwarePortfolioSync({
      backgroundApi: {
        serviceHardware: { uploadPortfolioPackage },
        serviceHardwareUI: { isHardwareChannelBusy },
        simpleDb: {
          hardwarePortfolioSync: {
            getTargetState: jest.fn().mockResolvedValue(undefined),
            updateTargetState,
          },
        },
      } as unknown as IBackgroundApi,
    });
    const serviceInternals = service as unknown as {
      getCurrencyMapForBuild: () => Promise<{
        currencyMap: Record<string, never>;
        displayCurrency: { id: string; symbol: string };
      }>;
      getHardwareCooldownRemainingMs: () => Promise<number>;
      submitPortfolioJsonToServer: jest.Mock;
      syncSettledPortfolio: (
        eventPayload: IPortfolioSyncSettledPayload,
      ) => Promise<void>;
    };
    serviceInternals.getHardwareCooldownRemainingMs = jest
      .fn()
      .mockResolvedValue(0);
    serviceInternals.getCurrencyMapForBuild = jest.fn().mockResolvedValue({
      currencyMap: {},
      displayCurrency: { id: 'usd', symbol: '$' },
    });
    serviceInternals.submitPortfolioJsonToServer = jest.fn().mockResolvedValue({
      serverPackageBytes: new Uint8Array([1, 2, 3]).buffer,
      serverSubmit: {
        bytesLength: 3,
        contentHash: 'server-content-hash',
        serverPackageBase64Length: 4,
        serverPackageBytesLength: 3,
      },
    });
    (accountUtils.isHwWallet as jest.Mock).mockReturnValue(true);
    return {
      isHardwareChannelBusy,
      service,
      serviceInternals,
      updateTargetState,
      uploadPortfolioPackage,
    };
  }

  test('short-circuits an empty portfolio before build or upload', async () => {
    const service = new ServiceHardwarePortfolioSync({
      backgroundApi: {} as IBackgroundApi,
    });
    const payload: IPortfolioSyncSettledPayload = {
      accountAddress: '0x1234567890abcdef',
      accountId: 'evm--1',
      aggregateTokenMap: {},
      deviceConnectId: 'PRO2_CONNECT_ID',
      totalFiat: '0',
      totalTokenCount: 0,
      tokenMap: {},
      tokens: [],
      walletId: 'hw-1',
      walletType: 'hw',
    };

    await (
      service as unknown as {
        syncSettledPortfolio: (
          eventPayload: IPortfolioSyncSettledPayload,
        ) => Promise<void>;
      }
    ).syncSettledPortfolio(payload);

    expect(currencyPersistAtom.get).not.toHaveBeenCalled();
    expect(accountUtils.isHwWallet).not.toHaveBeenCalled();
    await expect(service.getLastPortfolioSyncResultForDev()).resolves.toEqual(
      expect.objectContaining({
        deviceConnectId: 'PRO2_CONNECT_ID',
        status: 'empty',
        totalTokenCount: 0,
        walletId: 'hw-1',
      }),
    );
  });

  test('does not build or submit portfolio data for a software wallet', async () => {
    const service = new ServiceHardwarePortfolioSync({
      backgroundApi: {} as IBackgroundApi,
    });
    const serviceInternals = service as unknown as {
      getCurrencyMapForBuild: jest.Mock;
      submitPortfolioJsonToServer: jest.Mock;
      syncSettledPortfolio: (
        eventPayload: IPortfolioSyncSettledPayload,
      ) => Promise<void>;
    };
    serviceInternals.getCurrencyMapForBuild = jest.fn();
    serviceInternals.submitPortfolioJsonToServer = jest.fn();
    (accountUtils.isHwWallet as jest.Mock).mockReturnValue(false);

    await serviceInternals.syncSettledPortfolio({
      ...buildHardwarePayload(),
      walletId: 'hd-1',
      walletType: 'hd',
    });

    expect(serviceInternals.getCurrencyMapForBuild).not.toHaveBeenCalled();
    expect(serviceInternals.submitPortfolioJsonToServer).not.toHaveBeenCalled();
    await expect(service.getLastPortfolioSyncResultForDev()).resolves.toEqual(
      expect.objectContaining({
        status: 'disabled',
        walletId: 'hd-1',
      }),
    );
  });

  test('uses the real upload result instead of a cached connection flag', async () => {
    const uploadPortfolioPackage = jest
      .fn()
      .mockResolvedValue({ portfolioUpdated: true });
    const updateTargetState = jest.fn().mockResolvedValue(undefined);
    const service = new ServiceHardwarePortfolioSync({
      backgroundApi: {
        serviceHardware: {
          uploadPortfolioPackage,
        },
        serviceHardwareUI: {
          isHardwareChannelBusy: jest.fn().mockResolvedValue(false),
        },
        simpleDb: {
          hardwarePortfolioSync: {
            getTargetState: jest.fn().mockResolvedValue(undefined),
            updateTargetState,
          },
        },
      } as unknown as IBackgroundApi,
    });
    const serviceInternals = service as unknown as {
      getCurrencyMapForBuild: () => Promise<{
        currencyMap: Record<string, never>;
        displayCurrency: { id: string; symbol: string };
      }>;
      getHardwareCooldownRemainingMs: () => Promise<number>;
      submitPortfolioJsonToServer: () => Promise<{
        serverPackageBytes: ArrayBuffer;
        serverSubmit: {
          bytesLength: number;
          contentHash: string;
          serverPackageBase64Length: number;
          serverPackageBytesLength: number;
        };
      }>;
      syncSettledPortfolio: (
        eventPayload: IPortfolioSyncSettledPayload,
      ) => Promise<void>;
    };
    serviceInternals.getHardwareCooldownRemainingMs = jest
      .fn()
      .mockResolvedValue(0);
    serviceInternals.getCurrencyMapForBuild = jest.fn().mockResolvedValue({
      currencyMap: {},
      displayCurrency: { id: 'usd', symbol: '$' },
    });
    serviceInternals.submitPortfolioJsonToServer = jest.fn().mockResolvedValue({
      serverPackageBytes: new Uint8Array([1, 2, 3]).buffer,
      serverSubmit: {
        bytesLength: 3,
        contentHash: 'server-content-hash',
        serverPackageBase64Length: 4,
        serverPackageBytesLength: 3,
      },
    });
    (accountUtils.isHwWallet as jest.Mock).mockReturnValue(true);

    const payload = {
      accountAddress: '0x1234567890abcdef',
      accountId: 'evm--1',
      aggregateTokenMap: {},
      deviceConnectId: 'PRO2_CONNECT_ID',
      totalFiat: '0.00007276',
      totalTokenCount: 1,
      tokenMap: {
        eth: {
          balance: '0.00007276',
          balanceParsed: '0.00007276',
          currency: 'usd',
          fiatValue: '0.1',
          price: 1374.38,
        },
      },
      tokens: [
        {
          $key: 'eth',
          address: '',
          decimals: 18,
          isNative: true,
          name: 'Ethereum',
          networkId: 'evm--1',
          symbol: 'ETH',
        },
      ],
      walletId: 'hw-1',
      walletType: 'hw',
    } as unknown as IPortfolioSyncSettledPayload;

    await serviceInternals.syncSettledPortfolio(payload);

    expect(uploadPortfolioPackage).toHaveBeenCalledWith({
      connectId: 'PRO2_CONNECT_ID',
      packageBytes: expect.any(ArrayBuffer),
    });
    expect(updateTargetState).toHaveBeenCalled();
    await expect(service.getLastPortfolioSyncResultForDev()).resolves.toEqual(
      expect.objectContaining({
        status: 'uploaded',
        upload: { portfolioUpdated: true },
      }),
    );
  });

  test('retries the latest snapshot when hardware is busy before server packing', async () => {
    jest.useFakeTimers();
    const { serviceInternals, uploadPortfolioPackage } = prepareHardwareSync({
      busyResults: [true, false, false],
    });

    await serviceInternals.syncSettledPortfolio(buildHardwarePayload());
    expect(uploadPortfolioPackage).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(1000);
    expect(uploadPortfolioPackage).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  test('retries an already-packed snapshot without another server request', async () => {
    jest.useFakeTimers();
    const { serviceInternals, updateTargetState, uploadPortfolioPackage } =
      prepareHardwareSync({
        busyResults: [false, true, false],
      });

    await serviceInternals.syncSettledPortfolio(buildHardwarePayload());
    expect(uploadPortfolioPackage).not.toHaveBeenCalled();
    expect(serviceInternals.submitPortfolioJsonToServer).toHaveBeenCalledTimes(
      1,
    );

    await jest.advanceTimersByTimeAsync(1000);
    expect(serviceInternals.submitPortfolioJsonToServer).toHaveBeenCalledTimes(
      1,
    );
    expect(uploadPortfolioPackage).toHaveBeenCalledTimes(1);
    expect(updateTargetState).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });
});

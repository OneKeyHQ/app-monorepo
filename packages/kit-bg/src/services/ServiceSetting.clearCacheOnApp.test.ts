import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import type { IClearCacheOnAppState } from '@onekeyhq/shared/types/setting';

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => {
  const actual = jest.requireActual<
    typeof import('@onekeyhq/shared/src/background/backgroundDecorators')
  >('@onekeyhq/shared/src/background/backgroundDecorators');
  const passthroughDecorator =
    () =>
    (
      _target: unknown,
      _propertyKey?: string,
      descriptor?: PropertyDescriptor,
    ) =>
      descriptor;

  return {
    ...actual,
    backgroundClass: passthroughDecorator,
    backgroundMethod: passthroughDecorator,
    backgroundMethodForDev: passthroughDecorator,
  };
});

const ServiceSetting = require('./ServiceSetting')
  .default as typeof import('./ServiceSetting').default;

const oneKeyIdOnlyValues: IClearCacheOnAppState = {
  oneKeyId: true,
  tokenAndNFT: false,
  transactionHistory: false,
  swapHistory: false,
  browserCache: false,
  appUpdateCache: false,
  browserHistory: false,
  customToken: false,
  customRpc: false,
  customNetworkFee: false,
  serverNetworks: false,
  connectSites: false,
  signatureRecord: false,
};

describe('ServiceSetting.clearCacheOnApp', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('clears only local custom networks and refreshes the network list', async () => {
    const clearRawData = jest.fn().mockResolvedValue(undefined);
    const clearAllNetworksCache = jest.fn().mockResolvedValue(undefined);
    const clearCustomRpc = jest.fn();
    const clearServerNetworks = jest.fn();
    const clearOneKeyIdLocalAuthCache = jest.fn();
    const saveLocalSyncItem = jest.fn();
    const emit = jest.spyOn(appEventBus, 'emit').mockReturnValue(true);
    const service = new ServiceSetting({
      backgroundApi: {
        simpleDb: {
          appStatus: {},
          customNetwork: { clearRawData },
          customRpc: { clearRawData: clearCustomRpc },
          serverNetwork: { clearRawData: clearServerNetworks },
        },
        serviceNetwork: { clearAllNetworksCache },
        servicePrime: { clearOneKeyIdLocalAuthCache },
        servicePrimeCloudSync: { saveLocalSyncItem },
      },
    });

    await service.clearCacheOnApp({
      ...oneKeyIdOnlyValues,
      oneKeyId: false,
      customNetwork: true,
    });

    expect(clearRawData).toHaveBeenCalledTimes(1);
    expect(clearAllNetworksCache).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith(
      EAppEventBusNames.AddedCustomNetwork,
      undefined,
    );
    expect(clearRawData.mock.invocationCallOrder[0]).toBeLessThan(
      clearAllNetworksCache.mock.invocationCallOrder[0],
    );
    expect(clearAllNetworksCache.mock.invocationCallOrder[0]).toBeLessThan(
      emit.mock.invocationCallOrder[0],
    );
    expect(clearCustomRpc).not.toHaveBeenCalled();
    expect(clearServerNetworks).not.toHaveBeenCalled();
    expect(clearOneKeyIdLocalAuthCache).not.toHaveBeenCalled();
    expect(saveLocalSyncItem).not.toHaveBeenCalled();
  });

  it('preserves custom networks when the clear option is not selected', async () => {
    const clearRawData = jest.fn();
    const service = new ServiceSetting({
      backgroundApi: {
        simpleDb: {
          appStatus: {},
          customNetwork: { clearRawData },
        },
      },
    });

    await service.clearCacheOnApp({ ...oneKeyIdOnlyValues, oneKeyId: false });

    expect(clearRawData).not.toHaveBeenCalled();
  });

  it('marks OneKey ID logout failures for automatic toast and preserves the error', async () => {
    const error = new OneKeyLocalError('OneKey ID session read failed');
    const clearOneKeyIdLocalAuthCache = jest.fn().mockRejectedValue(error);
    const service = new ServiceSetting({
      backgroundApi: {
        simpleDb: {
          appStatus: {},
        },
        servicePrime: {
          clearOneKeyIdLocalAuthCache,
        },
      },
    });

    await expect(service.clearCacheOnApp(oneKeyIdOnlyValues)).rejects.toBe(
      error,
    );
    expect(error.autoToast).toBe(true);
    expect(clearOneKeyIdLocalAuthCache).toHaveBeenCalledTimes(1);
  });
});

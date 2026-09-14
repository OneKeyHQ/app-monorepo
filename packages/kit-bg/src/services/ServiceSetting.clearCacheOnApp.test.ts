import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
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

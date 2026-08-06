import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { cleanupHardwareSDKInstance, getHardwareSDKInstance } from './instance';
import { importHardwareSDK, importHardwareSDKLowLevel } from './sdk-loader';

jest.mock('@onekeyhq/shared/src/config/appConfig', () => ({
  HARDWARE_SDK_IFRAME_SRC_ONEKEYSO: 'https://example.com',
  HARDWARE_SDK_VERSION: 'test',
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isDesktop: true,
    isNative: false,
    isExtensionBackgroundServiceWorker: false,
  },
}));

jest.mock('./configFetcher', () => ({
  createConfigFetcher: jest.fn().mockResolvedValue(jest.fn()),
}));

jest.mock('./sdk-loader', () => ({
  importHardwareSDK: jest.fn(),
  importHardwareSDKLowLevel: jest.fn(),
}));

const mockedPlatformEnv = platformEnv as unknown as {
  isDesktop: boolean;
  isNative: boolean;
  isExtensionBackgroundServiceWorker: boolean;
};

describe('hardware SDK instance initialization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.assign(mockedPlatformEnv, {
      isDesktop: true,
      isNative: false,
      isExtensionBackgroundServiceWorker: false,
    });
  });

  afterEach(async () => {
    getHardwareSDKInstance.clear();
    await cleanupHardwareSDKInstance();
  });

  it('rejects instead of exposing an SDK instance when init returns false', async () => {
    const sdk = {
      init: jest.fn().mockResolvedValue(false),
      emit: jest.fn(),
      removeAllListeners: jest.fn(),
      dispose: jest.fn().mockResolvedValue(undefined),
    };
    const lowLevelSdk = {
      addHardwareGlobalEventListener: jest.fn(),
      removeAllListeners: jest.fn(),
      dispose: jest.fn().mockResolvedValue(undefined),
    };
    jest.mocked(importHardwareSDK).mockResolvedValue(sdk as never);
    jest
      .mocked(importHardwareSDKLowLevel)
      .mockResolvedValue(lowLevelSdk as never);

    await expect(
      getHardwareSDKInstance({
        isPreRelease: false,
      }),
    ).rejects.toThrow('HardwareSDK initialization failed');
  });
});

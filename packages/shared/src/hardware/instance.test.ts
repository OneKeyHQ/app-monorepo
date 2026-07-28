import { EHardwareTransportType } from '../../types';
import platformEnv from '../platformEnv';

import {
  getHardwareSDKInstance,
  isDirectFirmwareHostBindingTransport,
  resetHardwareSDKInstance,
} from './instance';
import { importHardwareSDK, importHardwareSDKLowLevel } from './sdk-loader';

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isDesktop: false,
    isNative: false,
  },
}));

jest.mock('./configFetcher', () => ({
  createConfigFetcher: jest.fn(async () => undefined),
}));

jest.mock('./sdk-loader', () => ({
  importHardwareSDK: jest.fn(),
  importHardwareSDKLowLevel: jest.fn(),
}));

describe('isDirectFirmwareHostBindingTransport', () => {
  const mockedPlatformEnv = platformEnv as {
    isDesktop: boolean;
    isNative: boolean;
  };

  beforeEach(() => {
    mockedPlatformEnv.isDesktop = false;
    mockedPlatformEnv.isNative = false;
  });

  it('uses the external host binding for native transports', () => {
    mockedPlatformEnv.isNative = true;

    expect(
      isDirectFirmwareHostBindingTransport(EHardwareTransportType.BLE),
    ).toBe(true);
  });

  it('uses the external host binding only for direct desktop transports', () => {
    mockedPlatformEnv.isDesktop = true;

    expect(
      isDirectFirmwareHostBindingTransport(EHardwareTransportType.WEBUSB),
    ).toBe(true);
    expect(
      isDirectFirmwareHostBindingTransport(
        EHardwareTransportType.DesktopWebBle,
      ),
    ).toBe(true);
    expect(
      isDirectFirmwareHostBindingTransport(EHardwareTransportType.Bridge),
    ).toBe(false);
  });

  it('keeps browser transports on the SDK-managed path', () => {
    expect(
      isDirectFirmwareHostBindingTransport(EHardwareTransportType.WEBUSB),
    ).toBe(false);
  });
});

describe('hardware SDK firmware config settings', () => {
  const mockedPlatformEnv = platformEnv as {
    isDesktop: boolean;
    isNative: boolean;
    isExtensionBackgroundServiceWorker?: boolean;
  };
  const mockedImportHardwareSDK = importHardwareSDK as jest.Mock;
  const mockedImportHardwareSDKLowLevel =
    importHardwareSDKLowLevel as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    getHardwareSDKInstance.clear();
    mockedPlatformEnv.isDesktop = true;
    mockedPlatformEnv.isNative = false;
    mockedPlatformEnv.isExtensionBackgroundServiceWorker = false;
  });

  afterEach(async () => {
    await resetHardwareSDKInstance();
  });

  it('keeps a direct desktop SDK instance on the legacy managed manifest path', async () => {
    const init = jest.fn(
      async (
        _settings: Record<string, unknown>,
        _lowLevel: unknown,
      ): Promise<void> => undefined,
    );
    mockedImportHardwareSDK.mockResolvedValue({
      init,
      emit: jest.fn(),
      dispose: jest.fn(async () => undefined),
      removeAllListeners: jest.fn(),
    });
    mockedImportHardwareSDKLowLevel.mockResolvedValue({
      addHardwareGlobalEventListener: jest.fn(),
      dispose: jest.fn(async () => undefined),
      removeAllListeners: jest.fn(),
    });
    await getHardwareSDKInstance({
      isPreRelease: false,
      hardwareTransportType: EHardwareTransportType.WEBUSB,
    });

    const settings = init.mock.calls[0]?.[0];
    expect(settings).toEqual(expect.objectContaining({ fetchConfig: true }));
    expect(settings).not.toHaveProperty('firmwareManifestMode');
    expect(settings).not.toHaveProperty('preloadedConfig');
  });
});

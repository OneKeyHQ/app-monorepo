import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { EHardwareTransportType } from '../../types';

import {
  getHardwareSDKInstance,
  isDirectFirmwareHostBindingTransport,
  resetHardwareSDKInstance,
} from './instance';
import { importHardwareSDK, importHardwareSDKLowLevel } from './sdk-loader';

import type { RemoteConfigResponse } from '@onekeyfe/hd-core';

jest.mock('@onekeyhq/shared/src/config/appConfig', () => ({
  HARDWARE_SDK_IFRAME_SRC_ONEKEYSO: 'https://example.com',
  HARDWARE_SDK_VERSION: 'test',
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isDesktop: false,
    isNative: false,
    isExtensionBackgroundServiceWorker: false,
  },
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
  const firmwareConfig = {
    bridge: {},
    classic: { firmware: [], ble: [] },
    classic1s: { firmware: [], ble: [] },
    classicpure: { firmware: [], ble: [] },
    mini: { firmware: [], ble: [] },
    touch: { firmware: [], ble: [] },
    pro: { firmware: [], ble: [] },
    pro2: { firmware: [], ble: [] },
  } as unknown as RemoteConfigResponse;

  const mockSdkLoaders = () => {
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
    return init;
  };

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

  it('initializes desktop with the App-managed manifest snapshot', async () => {
    const init = mockSdkLoaders();
    const loadFirmwareConfig = jest.fn(async () => firmwareConfig);
    await getHardwareSDKInstance({
      isPreRelease: false,
      hardwareTransportType: EHardwareTransportType.WEBUSB,
      loadFirmwareConfig,
    });

    const settings = init.mock.calls[0]?.[0];
    expect(loadFirmwareConfig).toHaveBeenCalledTimes(1);
    expect(settings).toEqual(
      expect.objectContaining({
        fetchConfig: false,
        firmwareManifestMode: 'external-only',
        preloadedConfig: firmwareConfig,
      }),
    );
  });

  it('keeps external-only SDK initialization offline when the manifest is unavailable', async () => {
    const init = mockSdkLoaders();
    const loadFirmwareConfig = jest.fn(
      async (): Promise<RemoteConfigResponse | undefined> => undefined,
    );

    await getHardwareSDKInstance({
      isPreRelease: false,
      hardwareTransportType: EHardwareTransportType.WEBUSB,
      loadFirmwareConfig,
    });

    const settings = init.mock.calls[0]?.[0];
    expect(loadFirmwareConfig).toHaveBeenCalledTimes(1);
    expect(settings).toEqual(
      expect.objectContaining({
        fetchConfig: false,
        firmwareManifestMode: 'external-only',
      }),
    );
    expect(settings).not.toHaveProperty('preloadedConfig');
  });

  it('fails closed when the App-managed manifest loader is missing', async () => {
    await expect(
      getHardwareSDKInstance({
        isPreRelease: false,
        hardwareTransportType: EHardwareTransportType.WEBUSB,
      }),
    ).rejects.toThrow('App-managed firmware config loader is required');
    expect(mockedImportHardwareSDK).not.toHaveBeenCalled();
  });

  it('keeps web and extension platforms on the SDK-managed path', async () => {
    mockedPlatformEnv.isDesktop = false;
    const init = mockSdkLoaders();
    const loadFirmwareConfig = jest.fn(async () => firmwareConfig);
    await getHardwareSDKInstance({
      isPreRelease: false,
      hardwareTransportType: EHardwareTransportType.WEBUSB,
      loadFirmwareConfig,
    });

    const settings = init.mock.calls[0]?.[0];
    expect(loadFirmwareConfig).not.toHaveBeenCalled();
    expect(settings).toEqual(
      expect.objectContaining({
        fetchConfig: true,
        firmwareManifestMode: 'sdk-managed',
      }),
    );
    expect(settings).not.toHaveProperty('preloadedConfig');
  });

  it('rejects instead of exposing an SDK instance when init returns false', async () => {
    const init = mockSdkLoaders();
    init.mockResolvedValue(false as never);

    await expect(
      getHardwareSDKInstance({
        isPreRelease: false,
        hardwareTransportType: EHardwareTransportType.WEBUSB,
        loadFirmwareConfig: jest.fn(async () => firmwareConfig),
      }),
    ).rejects.toThrow('HardwareSDK initialization failed');
  });
});

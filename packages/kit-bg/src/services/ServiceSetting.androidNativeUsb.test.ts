import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EHardwareTransportType } from '@onekeyhq/shared/types';

import { settingsPersistAtom } from '../states/jotai/atoms/settings';

import ServiceSetting from './ServiceSetting';

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isJest: true,
    isNative: true,
    isNativeAndroid: true,
    isNativeIOS: false,
    isDesktop: false,
    isWeb: false,
    isExtension: false,
  },
}));

const mutablePlatformEnv = platformEnv as unknown as {
  isNativeAndroid: boolean;
  isNativeIOS: boolean;
};

function createService(dev: {
  enabled?: boolean;
  settings?: { androidNativeUsbTransport?: boolean };
}) {
  return new ServiceSetting({
    backgroundApi: {
      simpleDb: { appStatus: {} },
      serviceDevSetting: { getDevSetting: jest.fn().mockResolvedValue(dev) },
    },
  });
}

describe('ServiceSetting experimental Android USB transport', () => {
  const originalIsInBackground = globalThis.$onekeyIsInBackground;

  beforeAll(() => {
    globalThis.$onekeyIsInBackground = true;
  });

  afterAll(() => {
    globalThis.$onekeyIsInBackground = originalIsInBackground;
  });

  beforeEach(() => {
    Object.assign(mutablePlatformEnv, {
      isNativeAndroid: true,
      isNativeIOS: false,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each([
    { name: 'dev mode on + flag on', enabled: true, flag: true, ok: true },
    { name: 'dev mode off', enabled: false, flag: true, ok: false },
    { name: 'flag off', enabled: true, flag: false, ok: false },
  ])('getHardwareTransportType with $name', async ({ enabled, flag, ok }) => {
    jest.spyOn(settingsPersistAtom, 'get').mockResolvedValue({
      hardwareTransportType: EHardwareTransportType.NativeUsb,
    } as never);
    const service = createService({
      enabled,
      settings: { androidNativeUsbTransport: flag },
    });

    await expect(service.getHardwareTransportType()).resolves.toBe(
      ok ? EHardwareTransportType.NativeUsb : EHardwareTransportType.BLE,
    );
  });

  it('does not persist NativeUsb when the dev flag is off', async () => {
    const setSpy = jest
      .spyOn(settingsPersistAtom, 'set')
      .mockResolvedValue(undefined as never);
    const service = createService({
      enabled: true,
      settings: { androidNativeUsbTransport: false },
    });

    await service.setHardwareTransportType(EHardwareTransportType.NativeUsb);

    const updater = setSpy.mock.calls[0]?.[0] as (prev: object) => {
      hardwareTransportType: EHardwareTransportType;
    };
    expect(updater({}).hardwareTransportType).toBe(EHardwareTransportType.BLE);
  });

  it('persists NativeUsb when the dev flag is on', async () => {
    const setSpy = jest
      .spyOn(settingsPersistAtom, 'set')
      .mockResolvedValue(undefined as never);
    const service = createService({
      enabled: true,
      settings: { androidNativeUsbTransport: true },
    });

    await service.setHardwareTransportType(EHardwareTransportType.NativeUsb);

    const updater = setSpy.mock.calls[0]?.[0] as (prev: object) => {
      hardwareTransportType: EHardwareTransportType;
    };
    expect(updater({}).hardwareTransportType).toBe(
      EHardwareTransportType.NativeUsb,
    );
  });

  it('never enables NativeUsb on iOS', async () => {
    Object.assign(mutablePlatformEnv, {
      isNativeAndroid: false,
      isNativeIOS: true,
    });
    const service = createService({
      enabled: true,
      settings: { androidNativeUsbTransport: true },
    });

    await expect(service.isAndroidNativeUsbTransportEnabled()).resolves.toBe(
      false,
    );
  });
});

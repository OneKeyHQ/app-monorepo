import { isAndroidCombinedTransportSupported } from '@onekeyhq/shared/src/hardware/sdk-loader';
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

jest.mock('@onekeyhq/shared/src/hardware/sdk-loader', () => ({
  isAndroidCombinedTransportSupported: jest.fn(async () => true),
}));

const mockedCombinedSupported = jest.mocked(
  isAndroidCombinedTransportSupported,
);

const mutablePlatformEnv = platformEnv as unknown as {
  isNativeAndroid: boolean;
  isNativeIOS: boolean;
};

function createService(dev?: {
  enabled?: boolean;
  settings?: { disableAndroidNativeUsb?: boolean };
}) {
  return new ServiceSetting({
    backgroundApi: {
      simpleDb: { appStatus: {} },
      serviceDevSetting: { getDevSetting: jest.fn().mockResolvedValue(dev) },
    },
  });
}

describe('ServiceSetting Android automatic USB + kill-switch', () => {
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
    {
      name: 'default (dev mode off, kill-switch unset)',
      dev: undefined,
      autoEnabled: true,
      disabled: false,
      expectedTransport: EHardwareTransportType.NativeUsb,
    },
    {
      name: 'dev mode off with stale disableAndroidNativeUsb flag',
      dev: { enabled: false, settings: { disableAndroidNativeUsb: true } },
      autoEnabled: true,
      disabled: false,
      expectedTransport: EHardwareTransportType.NativeUsb,
    },
    {
      name: 'dev mode on + kill-switch off',
      dev: { enabled: true, settings: { disableAndroidNativeUsb: false } },
      autoEnabled: true,
      disabled: false,
      expectedTransport: EHardwareTransportType.NativeUsb,
    },
    {
      name: 'dev mode on + kill-switch on',
      dev: { enabled: true, settings: { disableAndroidNativeUsb: true } },
      autoEnabled: false,
      disabled: true,
      expectedTransport: EHardwareTransportType.BLE,
    },
  ])(
    'Android resolves $name cleanly without requiring dev mode',
    async ({ dev, autoEnabled, disabled, expectedTransport }) => {
      jest.spyOn(settingsPersistAtom, 'get').mockResolvedValue({
        hardwareTransportType: EHardwareTransportType.BLE,
      } as never);
      const service = createService(dev);

      await expect(service.isAndroidUsbAutoEnabled()).resolves.toBe(
        autoEnabled,
      );
      await expect(service.isAndroidNativeUsbTransportDisabled()).resolves.toBe(
        disabled,
      );
      await expect(service.getHardwareTransportType()).resolves.toBe(
        expectedTransport,
      );
    },
  );

  it('stays on BLE when the bundled SDK lacks react-native-combined (pinned 1.2.10)', async () => {
    mockedCombinedSupported.mockResolvedValueOnce(false);
    const service = createService({ enabled: false });

    await expect(service.getHardwareTransportType()).resolves.toBe(
      EHardwareTransportType.BLE,
    );
  });

  it('refuses to persist NativeUsb when kill-switch is on', async () => {
    const setSpy = jest
      .spyOn(settingsPersistAtom, 'set')
      .mockResolvedValue(undefined);
    const service = createService({
      enabled: true,
      settings: { disableAndroidNativeUsb: true },
    });

    await service.setHardwareTransportType(EHardwareTransportType.NativeUsb);

    const updater = setSpy.mock.calls[0]?.[0] as (prev: object) => {
      hardwareTransportType: EHardwareTransportType;
    };
    expect(updater({}).hardwareTransportType).toBe(EHardwareTransportType.BLE);
  });

  it('persists NativeUsb when auto USB is enabled (kill-switch off)', async () => {
    const setSpy = jest
      .spyOn(settingsPersistAtom, 'set')
      .mockResolvedValue(undefined);
    const service = createService({
      enabled: false,
    });

    await service.setHardwareTransportType(EHardwareTransportType.NativeUsb);

    const updater = setSpy.mock.calls[0]?.[0] as (prev: object) => {
      hardwareTransportType: EHardwareTransportType;
    };
    expect(updater({}).hardwareTransportType).toBe(
      EHardwareTransportType.NativeUsb,
    );
  });

  it('never enables NativeUsb on iOS even if kill-switch is off or NativeUsb was persisted', async () => {
    Object.assign(mutablePlatformEnv, {
      isNativeAndroid: false,
      isNativeIOS: true,
    });
    jest.spyOn(settingsPersistAtom, 'get').mockResolvedValue({
      hardwareTransportType: EHardwareTransportType.NativeUsb,
    } as never);
    const setSpy = jest
      .spyOn(settingsPersistAtom, 'set')
      .mockResolvedValue(undefined);
    const service = createService({
      enabled: false,
      settings: { disableAndroidNativeUsb: false },
    });

    await expect(service.isAndroidUsbAutoEnabled()).resolves.toBe(false);
    await expect(service.isAndroidNativeUsbTransportDisabled()).resolves.toBe(
      false,
    );
    await expect(service.getHardwareTransportType()).resolves.toBe(
      EHardwareTransportType.BLE,
    );

    await service.setHardwareTransportType(EHardwareTransportType.NativeUsb);
    const updater = setSpy.mock.calls[0]?.[0] as (prev: object) => {
      hardwareTransportType: EHardwareTransportType;
    };
    expect(updater({}).hardwareTransportType).toBe(EHardwareTransportType.BLE);
  });
});

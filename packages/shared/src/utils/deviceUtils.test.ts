import { EDeviceType } from '@onekeyfe/hd-shared';

import deviceUtils, { ESupportSettings } from './deviceUtils';

const mockGetAutoLockOptions = jest.fn();
const mockGetAutoShutDownOptions = jest.fn();

jest.mock('../hardware/instance', () => ({
  CoreSDKLoader: jest.fn(async () => ({
    getDeviceBootloaderVersion: jest.fn(() => []),
    getDeviceFirmwareVersion: jest.fn(() => []),
    getDeviceLabel: jest.fn(
      (features: { bleName?: string; deviceType?: string; label?: string }) =>
        features.label || features.bleName || `OneKey ${features.deviceType}`,
    ),
    getDeviceType: jest.fn(
      (features: { deviceType?: string }) =>
        features.deviceType || EDeviceType.Unknown,
    ),
    getAutoLockOptions: mockGetAutoLockOptions,
    getAutoShutDownOptions: mockGetAutoShutDownOptions,
  })),
}));

describe('deviceUtils', () => {
  it('reads the visible name and versions from canonical DeviceState sections', () => {
    const state = {
      identity: {
        label: 'Renamed Pro 2',
        bleName: 'Pro2 6136',
        deviceType: EDeviceType.Pro2,
      },
      versions: {
        firmware: '1.2.3',
        bootloader: '0.2.0',
        ble: '3.4.5',
      },
    } as never;

    expect(deviceUtils.getDeviceDisplayName({ state })).toBe('Renamed Pro 2');
    expect(deviceUtils.getDeviceVersionsFromState({ state })).toEqual({
      firmwareVersion: '1.2.3',
      bootloaderVersion: '0.2.0',
      bleVersion: '3.4.5',
    });
  });

  it('prefers persisted DeviceState versions over stale legacy Features', async () => {
    await expect(
      deviceUtils.getDeviceVersion({
        device: {
          deviceStateInfo: {
            versions: {
              firmware: '1.2.3',
              bootloader: '0.2.0',
              ble: '3.4.5',
            },
          },
          featuresInfo: {
            firmwareVersion: '9.9.9',
            bootloaderVersion: '9.9.9',
            bleVersion: '9.9.9',
          },
        } as never,
        features: {
          firmwareVersion: '8.8.8',
          bootloaderVersion: '8.8.8',
          bleVersion: '8.8.8',
        } as never,
      }),
    ).resolves.toEqual({
      firmwareVersion: '1.2.3',
      bootloaderVersion: '0.2.0',
      bleVersion: '3.4.5',
    });
  });

  it('uses the user label as display name before the BLE connection name', async () => {
    await expect(
      deviceUtils.buildDeviceName({
        device: {
          connectId: 'connect-id',
          uuid: 'uuid',
          deviceId: 'device-id',
          deviceType: EDeviceType.Pro2,
          name: 'Pro2 6136',
        },
        features: {
          label: 'Renamed Pro 2',
          bleName: 'Pro2 6136',
          deviceType: EDeviceType.Pro2,
        } as never,
      }),
    ).resolves.toBe('Renamed Pro 2');
  });

  it.each([
    ['normal', null, 'normal'],
    ['notInitialized', false, 'notInitialized'],
    ['backupMode', true, 'backupMode'],
    ['bootloader', null, 'bootloader'],
    ['romloader', null, 'bootloader'],
  ])(
    'prefers canonical %s mode when initialized is %s',
    async (mode, initialized, expected) => {
      await expect(
        deviceUtils.getDeviceModeFromFeatures({
          features: {
            mode,
            initialized,
            bootloaderMode: false,
            noBackup: false,
          } as never,
        }),
      ).resolves.toBe(expected);
    },
  );

  it('exposes a stable product model name independently from the user label', () => {
    expect(deviceUtils.getDefaultDeviceLabel(EDeviceType.Pro2)).toBe(
      'OneKey Pro 2',
    );
    expect(deviceUtils.getDefaultDeviceLabel(EDeviceType.Classic1s)).toBe(
      'OneKey Classic 1S',
    );
  });

  it('temporarily skips every firmware verification flow for Pro 2', () => {
    expect(deviceUtils.isFirmwareVerifySupported(EDeviceType.Pro2)).toBe(false);
    expect(deviceUtils.isFirmwareVerifySupported(EDeviceType.Pro)).toBe(true);
  });

  it.each(['ble', 'webble', 'electron-ble'] as const)(
    'recognizes %s discovery results as Bluetooth without a deviceId',
    (commType) => {
      expect(
        deviceUtils.isBluetoothSearchDevice({
          commType,
        }),
      ).toBe(true);
    },
  );

  it.each(['usb', 'webusb', 'bridge', 'emulator'] as const)(
    'does not classify %s discovery results as Bluetooth',
    (commType) => {
      expect(
        deviceUtils.isBluetoothSearchDevice({
          commType,
        }),
      ).toBe(false);
    },
  );

  it('uses commType instead of deviceId to classify initialized Bluetooth devices', () => {
    const initializedBluetoothDevice = {
      commType: 'electron-ble' as const,
      deviceId: 'initialized-device-id',
    };

    expect(
      deviceUtils.isBluetoothSearchDevice(initializedBluetoothDevice),
    ).toBe(true);
  });

  it.each([
    ESupportSettings.Language,
    ESupportSettings.Brightness,
    ESupportSettings.AutoLock,
    ESupportSettings.AutoShutDown,
    ESupportSettings.HapticFeedback,
  ])('enables the %s setting for Pro 2', (setting) => {
    expect(
      deviceUtils.supportSettings({
        deviceType: EDeviceType.Pro2,
        firmwareVersion: '1.0.0',
        setting,
      }),
    ).toBe(true);
  });

  it.each([
    ['getAutoLockOptions', mockGetAutoLockOptions],
    ['getAutoShutDownOptions', mockGetAutoShutDownOptions],
  ] as const)('forwards the detected protocol to %s', async (method, mock) => {
    mock.mockReturnValueOnce([{ label: 'Never', valueMs: 0 }]);

    await expect(
      deviceUtils[method]({
        deviceType: EDeviceType.Pro,
        protocol: 'V1',
      }),
    ).resolves.toEqual([{ label: 'Never', valueMs: 0 }]);
    expect(mock).toHaveBeenCalledWith(EDeviceType.Pro, 'V1');
  });

  it.each([
    ['en-US', 'en'],
    ['zh-Hans-CN', 'zh_cn'],
    ['zh-Hant-HK', 'zh_hk'],
    ['pt-BR', 'pt_br'],
    ['zh-Hant-TW', 'zh-Hant-TW'],
  ])(
    'maps the DeviceState language %s to the supported device code %s',
    (language, expected) => {
      expect(
        deviceUtils.resolveDeviceLanguageCode({
          language,
          supportedCodes: ['en', 'zh_cn', 'zh_hk', 'pt_br', 'zh-Hant-TW'],
        }),
      ).toBe(expected);
    },
  );

  it('does not read third-party firmware versions from OneKey device helpers', async () => {
    await expect(
      deviceUtils.getDeviceVersion({
        device: undefined,
        features: {
          vendor: 'trezor',
          third_party_firmware_version: '2.8.0',
        } as never,
      }),
    ).resolves.toMatchObject({
      firmwareVersion: '',
    });
  });
});

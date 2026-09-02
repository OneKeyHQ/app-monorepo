import { EDeviceType } from '@onekeyfe/hd-shared';

import { EHardwareTransportType } from '../../types';

import deviceUtils, { ESupportSettings } from './deviceUtils';
import {
  NEO_DEVICE_TYPE,
  isProtocolV2ProductType,
  resolveQrWalletDeviceType,
  supportsHardwareQrWallet,
} from './hardwareDeviceTypes';

const mockGetAutoLockOptions = jest.fn();
const mockGetAutoShutDownOptions = jest.fn();
const PROTOCOL_V2_NEVER_TIMEOUT_MS = 0x10_00_00_00;

describe('getFixedUpdatingConnectId', () => {
  const device = {
    connectId: 'USB_SERIAL',
    usbConnectId: 'USB_SERIAL',
    bleConnectId: 'BLE_PERIPHERAL_ID',
  };

  it('uses the persisted BLE peripheral for desktop BLE updates', () => {
    expect(
      deviceUtils.getFixedUpdatingConnectId({
        updatingConnectId: 'STALE_CONNECT_ID',
        currentTransportType: EHardwareTransportType.DesktopWebBle,
        device,
      }),
    ).toBe('BLE_PERIPHERAL_ID');
  });

  it('keeps the transport-derived connect ID for non-BLE updates', () => {
    expect(
      deviceUtils.getFixedUpdatingConnectId({
        updatingConnectId: undefined,
        currentTransportType: EHardwareTransportType.WEBUSB,
        device,
      }),
    ).toBeUndefined();
  });

  it('rejects a BLE value that only aliases the USB serial', () => {
    expect(
      deviceUtils.getFixedUpdatingConnectId({
        updatingConnectId: 'CURRENT_BLE_ID',
        currentTransportType: EHardwareTransportType.DesktopWebBle,
        device: { ...device, bleConnectId: 'USB_SERIAL' },
      }),
    ).toBe('CURRENT_BLE_ID');
  });
});

jest.mock('../hardware/instance', () => ({
  CoreSDKLoader: jest.fn(async () => ({
    getDeviceBootloaderVersion: jest.fn(() => []),
    getDeviceFirmwareVersion: jest.fn(() => []),
    getDeviceBLEFirmwareVersion: jest.fn(
      (features: {
        bleVersion?: string;
        ble_ver?: string;
        onekey_ble_version?: string;
      }) => {
        const version =
          features.bleVersion ||
          features.onekey_ble_version ||
          features.ble_ver;
        return version?.split('.').map(Number) ?? [];
      },
    ),
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
    PROTOCOL_V2_NEVER_TIMEOUT_MS,
  })),
}));

describe('deviceUtils', () => {
  it('prefers the live device state ID after the device is reset', () => {
    expect(
      deviceUtils.getRawDeviceId({
        device: { deviceId: 'OLD_DEVICE_ID' } as never,
        features: { deviceId: 'OLD_DEVICE_ID' } as never,
        deviceState: {
          identity: { deviceId: 'NEW_DEVICE_ID' },
        } as never,
      }),
    ).toBe('NEW_DEVICE_ID');
  });

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

  it('canonicalizes compact Pro2 BLE names for display', () => {
    const state = {
      identity: {
        label: null,
        bleName: 'Pro2 6136',
        deviceType: EDeviceType.Pro2,
      },
    } as never;

    expect(deviceUtils.getDeviceDisplayName({ state })).toBe('Pro 2 6136');
  });

  it('does not rewrite OneKey Pro BLE names whose suffix starts with 2', () => {
    const state = {
      identity: {
        label: null,
        bleName: 'Pro 22D8',
        deviceType: EDeviceType.Pro,
      },
    } as never;

    expect(deviceUtils.getDeviceDisplayName({ state })).toBe('Pro 22D8');
  });
});

describe('buildDeviceStageName', () => {
  it('wears the Bluetooth name even when the device carries a label', () => {
    // The bug this rule exists for: IDBDevice.name is a display name the
    // label wins, so a renamed device wore its label on the stage badge
    // where the design asks for the fixed Bluetooth name.
    expect(
      deviceUtils.buildDeviceStageName({
        features: {
          label: 'Renamed Pro 2',
          bleName: 'Pro2 6136',
          deviceType: EDeviceType.Pro2,
        } as never,
        fallbackName: 'Renamed Pro 2',
      }),
    ).toBe('Pro 2 6136');
  });

  it('leaves a non-Pro2 Bluetooth name exactly as advertised', () => {
    expect(
      deviceUtils.buildDeviceStageName({
        features: {
          label: 'My Pro',
          ble_name: 'Pro 22D8',
          deviceType: EDeviceType.Pro,
        } as never,
        fallbackName: 'My Pro',
      }),
    ).toBe('Pro 22D8');
  });

  it('keeps the display name for a device that advertises none', () => {
    // Third-party vendors have no Bluetooth name at all — their badge
    // must keep the product name it already showed, never blank.
    expect(
      deviceUtils.buildDeviceStageName({
        features: { label: 'Ledger Nano X' } as never,
        fallbackName: 'Ledger Nano X',
      }),
    ).toBe('Ledger Nano X');
  });

  it('treats an empty advertised name as no name', () => {
    expect(
      deviceUtils.buildDeviceStageName({
        features: { onekey_ble_name: '', bleName: null } as never,
        fallbackName: 'OneKey Classic',
      }),
    ).toBe('OneKey Classic');
  });

  it('names nothing when nothing is known', () => {
    expect(
      deviceUtils.buildDeviceStageName({
        features: undefined,
        fallbackName: undefined,
      }),
    ).toBeUndefined();
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

  it.each(['ble_ver', 'onekey_ble_version'] as const)(
    'reads the BLE version from a legacy %s DB record',
    async (field) => {
      await expect(
        deviceUtils.getDeviceVersion({
          device: undefined,
          features: { [field]: '2.1.0' } as never,
        }),
      ).resolves.toMatchObject({ bleVersion: '2.1.0' });
    },
  );

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
    expect(deviceUtils.getDefaultDeviceLabel(NEO_DEVICE_TYPE)).toBe(
      'OneKey Neo',
    );
  });

  it('supports firmware verification for Protocol V2 products', () => {
    expect(deviceUtils.isFirmwareVerifySupported(EDeviceType.Pro2)).toBe(true);
    expect(deviceUtils.isFirmwareVerifySupported(EDeviceType.Pro)).toBe(true);
    expect(deviceUtils.isFirmwareVerifySupported(NEO_DEVICE_TYPE)).toBe(true);
  });

  it('classifies only Neo and Pro 2 as Protocol V2 products', () => {
    expect(NEO_DEVICE_TYPE).toBe('neo');
    expect(
      Object.values(EDeviceType).filter((deviceType) =>
        isProtocolV2ProductType(deviceType),
      ),
    ).toEqual([EDeviceType.Pro2, EDeviceType.Neo]);
  });

  test('keeps Neo out of camera-dependent QR wallet onboarding', () => {
    expect(supportsHardwareQrWallet(EDeviceType.Pro)).toBe(true);
    expect(supportsHardwareQrWallet(EDeviceType.Pro2)).toBe(true);
    expect(supportsHardwareQrWallet(NEO_DEVICE_TYPE)).toBe(false);
  });

  test.each([
    ['OneKey Pro2', EDeviceType.Pro2],
    ['OneKey Pro2:SERIAL:universal', EDeviceType.Pro2],
    ['OneKey Pro 2', EDeviceType.Pro2],
    ['OneKey Pro 2:SERIAL', EDeviceType.Pro2],
    ['OneKey Pro', EDeviceType.Pro],
    ['QR Wallet', EDeviceType.Pro],
    [undefined, EDeviceType.Pro],
  ])('resolves QR wallet device name %s to %s', (deviceName, expected) => {
    expect(resolveQrWalletDeviceType({ deviceName })).toBe(expected);
  });

  it('prefers an explicit Pro 2 QR wallet device type', () => {
    expect(
      resolveQrWalletDeviceType({
        deviceName: 'Legacy device name',
        deviceType: EDeviceType.Pro2,
      }),
    ).toBe(EDeviceType.Pro2);
  });

  it('preserves an explicit legacy Pro QR wallet device type', () => {
    expect(
      resolveQrWalletDeviceType({
        deviceName: 'OneKey Pro 2',
        deviceType: EDeviceType.Pro,
      }),
    ).toBe(EDeviceType.Pro);
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
    expect(
      deviceUtils.supportSettings({
        deviceType: NEO_DEVICE_TYPE,
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
    ).resolves.toEqual([{ isNever: true, label: 'Never', valueMs: 0 }]);
    expect(mock).toHaveBeenCalledWith(EDeviceType.Pro, 'V1');
  });

  it('keeps auto-shutdown options unchanged for other device models', async () => {
    mockGetAutoShutDownOptions.mockReturnValueOnce([
      { label: '30 minutes', valueMs: 1_800_000 },
    ]);

    await expect(
      deviceUtils.getAutoShutDownOptions({
        deviceType: EDeviceType.Pro,
        protocol: 'V1',
      }),
    ).resolves.toEqual([
      { isNever: false, label: '30 minutes', valueMs: 1_800_000 },
    ]);
  });

  it.each([
    ['getAutoLockOptions', mockGetAutoLockOptions],
    ['getAutoShutDownOptions', mockGetAutoShutDownOptions],
  ] as const)(
    'marks the Protocol V2 never timeout returned by %s',
    async (method, mock) => {
      mock.mockReturnValueOnce([
        { label: 'Never', valueMs: PROTOCOL_V2_NEVER_TIMEOUT_MS },
      ]);

      await expect(
        deviceUtils[method]({
          deviceType: EDeviceType.Pro2,
          protocol: 'V2',
        }),
      ).resolves.toEqual([
        {
          isNever: true,
          label: 'Never',
          valueMs: PROTOCOL_V2_NEVER_TIMEOUT_MS,
        },
      ]);
    },
  );

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

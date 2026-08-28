import { EFirmwareType } from '@onekeyfe/hd-shared';
// Test-only import (node env, never bundled): the SDK original is the source
// of truth the local copy must stay in parity with.
import { isTrezorBleSupportedModel as isSdkTrezorBleSupportedModel } from '@onekeyfe/hwk-trezor-adapter';

import { EHardwareVendor } from '../../types/device';

import thirdPartyDeviceUtils from './thirdPartyDeviceUtils';

describe('thirdPartyDeviceUtils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('keeps only persisted third-party feature fields', () => {
    expect(
      thirdPartyDeviceUtils.buildPersistedFeatures({
        vendor: EHardwareVendor.trezor,
        features: {
          vendor: 'trezor.io',
          major_version: 2,
          minor_version: 12,
          patch_version: 0,
          build_version: 0,
          device_id: 'DEVICE-1',
          label: 'n',
          model: 'Safe 7',
          internal_model: 'T3W1',
          fw_vendor: 'Trezor',
          language: 'en-US',
          haptic_feedback: false,
          auto_lock_delay_ms: 600_000,
          auto_lock_delay_battery_ms: 40_000,
          passphrase_protection: true,
          provider_product: 'Trezor Safe 7',
          unit_color: 3,
          unit_btconly: true,
          usb_connected: true,
          wireless_connected: false,
          capabilities: ['Capability_BLE'],
        },
        label: 'n',
        model: 'Safe 7',
        internalModel: 'T3W1',
        firmwareVersion: '2.12.0',
        serialNumber: 'SN-1',
      }),
    ).toEqual({
      vendor: EHardwareVendor.trezor,
      major_version: 2,
      minor_version: 12,
      patch_version: 0,
      build_version: 0,
      device_id: 'DEVICE-1',
      label: 'n',
      model: 'Safe 7',
      internal_model: 'T3W1',
      fw_vendor: 'Trezor',
      language: 'en-US',
      haptic_feedback: false,
      auto_lock_delay_ms: 600_000,
      auto_lock_delay_battery_ms: 40_000,
      passphrase_protection: true,
      provider_product: 'Trezor Safe 7',
      unit_color: 3,
      unit_btconly: true,
      usb_connected: true,
      wireless_connected: false,
      serial_no: 'SN-1',
      third_party_firmware_version: '2.12.0',
    });
  });

  it('reads persisted Trezor identity and settings from snake_case features', () => {
    const utils = thirdPartyDeviceUtils as unknown as {
      getDeviceId?: (features: Record<string, unknown>) => string | undefined;
      getDeviceState?: (params: {
        features: Record<string, unknown>;
      }) => Record<string, unknown>;
    };
    const features = {
      device_id: 'TREZOR-DEVICE-ID',
      auto_lock_delay_ms: 600_000,
      haptic_feedback: true,
      initialized: true,
      passphrase_protection: true,
      unlocked: false,
    };

    expect(utils.getDeviceId?.(features)).toBe('TREZOR-DEVICE-ID');
    expect(utils.getDeviceState?.({ features })).toEqual({
      autoLockDelayMs: 600_000,
      autoShutDownDelayMs: 600_000,
      hapticFeedback: true,
      initialized: true,
      passphraseProtection: true,
      unlocked: false,
    });
  });

  it('keeps camelCase compatibility for already-normalized features', () => {
    const utils = thirdPartyDeviceUtils as unknown as {
      getDeviceId?: (features: Record<string, unknown>) => string | undefined;
      getDeviceState?: (params: {
        features: Record<string, unknown>;
      }) => Record<string, unknown>;
    };
    const features = {
      deviceId: 'NORMALIZED-DEVICE-ID',
      autoLockDelayMs: 30_000,
      autoShutdownDelayMs: 60_000,
      hapticFeedback: false,
      initialized: false,
      passphraseProtection: false,
      unlocked: true,
    };

    expect(utils.getDeviceId?.(features)).toBe('NORMALIZED-DEVICE-ID');
    expect(utils.getDeviceState?.({ features })).toEqual({
      autoLockDelayMs: 30_000,
      autoShutDownDelayMs: 60_000,
      hapticFeedback: false,
      initialized: false,
      passphraseProtection: false,
      unlocked: true,
    });
  });

  it('reads third-party firmware versions from settings before features', () => {
    expect(
      thirdPartyDeviceUtils.getDeviceVersion({
        device: {
          settings: {
            vendorFirmwareVersion: '2.12.0',
          },
        },
        features: {
          third_party_firmware_version: '2.8.0',
        },
      }),
    ).toMatchObject({
      firmwareVersion: '2.12.0',
    });
  });

  it('reads third-party firmware versions from persisted settingsRaw', () => {
    expect(
      thirdPartyDeviceUtils.getDeviceVersion({
        device: {
          settingsRaw: JSON.stringify({
            vendorFirmwareVersion: '2.12.0',
          }),
        },
        features: {
          third_party_firmware_version: '2.8.0',
        },
      }),
    ).toMatchObject({
      firmwareVersion: '2.12.0',
    });
  });

  it('ignores unknown third-party firmware versions and falls back to version parts', () => {
    expect(
      thirdPartyDeviceUtils.getDeviceVersion({
        features: {
          third_party_firmware_version: 'unknown',
          major_version: 2,
          minor_version: 10,
          patch_version: 0,
        },
      }),
    ).toMatchObject({
      firmwareVersion: '2.10.0',
    });
  });

  it('detects Trezor Bitcoin-only firmware using Trezor Suite firmware rules', () => {
    expect(
      thirdPartyDeviceUtils.getFirmwareType({
        features: {
          fw_vendor: 'Trezor Bitcoin-only',
        },
      }),
    ).toBe(EFirmwareType.BitcoinOnly);
    expect(
      thirdPartyDeviceUtils.getFirmwareType({
        features: {
          fw_vendor: 'Trezor',
          unit_btconly: false,
        },
      }),
    ).toBe(EFirmwareType.Universal);
    expect(
      thirdPartyDeviceUtils.getFirmwareType({
        features: {
          fw_vendor: 'Trezor',
          unit_btconly: true,
        },
      }),
    ).toBe(EFirmwareType.Universal);
    expect(
      thirdPartyDeviceUtils.getFirmwareType({
        features: {
          capabilities: ['Capability_Bitcoin'],
          bootloader_mode: null,
          initialized: true,
        },
      }),
    ).toBe(EFirmwareType.BitcoinOnly);
    expect(
      thirdPartyDeviceUtils.getFirmwareType({
        features: {
          capabilities: ['Capability_Bitcoin', 'Capability_Bitcoin_like'],
          bootloader_mode: null,
          initialized: true,
        },
      }),
    ).toBe(EFirmwareType.Universal);
    expect(
      thirdPartyDeviceUtils.getFirmwareType({
        features: {
          bootloader_mode: true,
          unit_btconly: true,
        },
      }),
    ).toBe(EFirmwareType.BitcoinOnly);
  });

  it('checks Trezor Bitcoin-only firmware from third-party features', () => {
    expect(
      thirdPartyDeviceUtils.isBtcOnlyFirmware({
        features: {
          fw_vendor: 'Trezor Bitcoin-only',
        },
      }),
    ).toBe(true);
    expect(
      thirdPartyDeviceUtils.isBtcOnlyFirmware({
        features: {
          unit_btconly: false,
        },
      }),
    ).toBe(false);
  });

  it('detects Trezor BLE support by model name', () => {
    expect(thirdPartyDeviceUtils.isTrezorBleSupportedModel('T3W1')).toBe(true);
    expect(thirdPartyDeviceUtils.isTrezorBleSupportedModel('t3w1')).toBe(true);
    expect(thirdPartyDeviceUtils.isTrezorBleSupportedModel('Safe 7')).toBe(
      true,
    );
    expect(
      thirdPartyDeviceUtils.isTrezorBleSupportedModel('  Trezor   Safe 7  '),
    ).toBe(true);
    expect(thirdPartyDeviceUtils.isTrezorBleSupportedModel('T2T1')).toBe(false);
    expect(thirdPartyDeviceUtils.isTrezorBleSupportedModel('')).toBe(false);
    expect(thirdPartyDeviceUtils.isTrezorBleSupportedModel(undefined)).toBe(
      false,
    );
  });

  it('stays in parity with the SDK isTrezorBleSupportedModel', () => {
    // The local copy exists so UI bundles skip the adapter graph. If the SDK
    // model list or normalization changes, this matrix fails and the local
    // copy must be updated to match.
    const samples = [
      undefined,
      '',
      'T3W1',
      't3w1',
      ' T3W1 ',
      'Safe 7',
      'safe   7',
      'Trezor Safe 7',
      'TREZOR SAFE 7',
      'T2T1',
      'T2B1',
      'model t',
      'Safe 5',
    ];
    for (const sample of samples) {
      expect({
        sample,
        supported: thirdPartyDeviceUtils.isTrezorBleSupportedModel(sample),
      }).toEqual({
        sample,
        supported: isSdkTrezorBleSupportedModel(sample),
      });
    }
  });
  it('detects Trezor BLE support from persisted device settings', () => {
    expect(
      thirdPartyDeviceUtils.isTrezorBleSupportedDevice({
        settings: {
          vendorModel: 'T3W1',
          vendorModelName: 'Safe 7',
        },
      }),
    ).toBe(true);

    expect(
      thirdPartyDeviceUtils.isTrezorBleSupportedDevice({
        settings: {
          vendorModel: 'T2T1',
          vendorModelName: 'Model T',
        },
      }),
    ).toBe(false);

    expect(thirdPartyDeviceUtils.isTrezorBleSupportedDevice(undefined)).toBe(
      false,
    );
  });
});

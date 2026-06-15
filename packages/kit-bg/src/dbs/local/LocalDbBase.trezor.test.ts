import { EHardwareTransportType } from '@onekeyhq/shared/types';
import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import {
  buildThirdPartyDeviceSettingsFromDevice,
  buildThirdPartyFeaturesInfoFromDevice,
  buildTrezorDesktopBleUsbConnectId,
  clearTrezorThpSettingsRaw,
} from './LocalDbBase';

describe('clearTrezorThpSettingsRaw', () => {
  it('removes Trezor THP credentials while preserving regular device settings', () => {
    const settingsRaw = JSON.stringify({
      vendor: 'trezor',
      vendorModel: 'Safe 7',
      thpCredentials: [{ credential: 'secret' }],
    });

    expect(JSON.parse(clearTrezorThpSettingsRaw(settingsRaw))).toEqual({
      vendor: 'trezor',
      vendorModel: 'Safe 7',
    });
  });

  it('returns an empty settings object for malformed settingsRaw', () => {
    expect(clearTrezorThpSettingsRaw('{')).toBe('{}');
  });
});

describe('buildThirdPartyFeaturesInfoFromDevice', () => {
  it('preserves Trezor model and firmware fields for device management', () => {
    const featuresInfo = buildThirdPartyFeaturesInfoFromDevice({
      device: {
        name: 'Trezor Safe 7',
        raw: {
          firmwareVersion: '2.8.0',
          serialNumber: 'SN-1',
        },
        vendorModel: 'T3W1',
        vendorModelName: 'Trezor Safe 7',
      } as never,
      features: {
        device_id: 'TREZOR-DEVICE-ID',
        vendor: 'trezor',
        capabilities: ['Capability_BLE'],
        pin_protection: true,
        passphrase_protection: true,
        language: 'en-US',
        haptic_feedback: false,
        auto_lock_delay_ms: 600_000,
        provider_product: 'Trezor Safe 7',
      } as never,
      vendor: EHardwareVendor.trezor,
    }) as Record<string, unknown>;

    expect(featuresInfo).toMatchObject({
      device_id: 'TREZOR-DEVICE-ID',
      vendor: EHardwareVendor.trezor,
      label: 'Trezor Safe 7',
      model: 'Trezor Safe 7',
      internal_model: 'T3W1',
      serial_no: 'SN-1',
      provider_product: 'Trezor Safe 7',
      passphrase_protection: true,
      language: 'en-US',
      haptic_feedback: false,
      auto_lock_delay_ms: 600_000,
      third_party_firmware_version: '2.8.0',
    });
    expect(featuresInfo.capabilities).toBeUndefined();
    expect(featuresInfo.pin_protection).toBe(true);
  });

  it('derives Trezor firmware version from version parts when the feature version is unknown', () => {
    const featuresInfo = buildThirdPartyFeaturesInfoFromDevice({
      device: {
        name: 'Trezor Safe 5',
        vendorModel: 'T3T1',
        vendorModelName: 'Safe 5',
      } as never,
      features: {
        device_id: 'TREZOR-DEVICE-ID',
        vendor: 'trezor',
        major_version: 2,
        minor_version: 10,
        patch_version: 0,
        model: 'Safe 5',
        internal_model: 'T3T1',
        third_party_firmware_version: 'unknown',
      } as never,
      vendor: EHardwareVendor.trezor,
    }) as Record<string, unknown>;

    expect(featuresInfo.third_party_firmware_version).toBe('2.10.0');
  });
});

describe('buildThirdPartyDeviceSettingsFromDevice', () => {
  it('stores the Trezor internal model as vendorModel and display model as vendorModelName', () => {
    expect(
      buildThirdPartyDeviceSettingsFromDevice({
        device: {
          name: 'Trezor Safe 7',
          raw: {
            firmwareVersion: '2.12.0',
          },
          vendorModel: 'Safe 7',
          vendorModelName: 'Safe 7',
        } as never,
        features: {
          device_id: 'TREZOR-DEVICE-ID',
          vendor: 'trezor',
          model: 'Safe 7',
          internal_model: 'T3W1',
        } as never,
        vendor: EHardwareVendor.trezor,
        supportsSoftwarePin: false,
      }),
    ).toEqual({
      inputPinOnSoftware: false,
      vendor: EHardwareVendor.trezor,
      vendorModel: 'T3W1',
      vendorModelName: 'Safe 7',
      vendorFirmwareVersion: '2.12.0',
    });
  });

  it('preserves existing settings while refreshing third-party model metadata', () => {
    expect(
      buildThirdPartyDeviceSettingsFromDevice({
        baseSettings: {
          chainFingerprints: {
            btc: 'abcd1234',
          },
          vendorModel: 'Safe 7',
        },
        device: {
          vendorModel: 'Safe 7',
          vendorModelName: 'Safe 7',
        } as never,
        features: {
          model: 'Safe 7',
          internal_model: 'T3W1',
          third_party_firmware_version: '2.12.0',
        } as never,
        vendor: EHardwareVendor.trezor,
        supportsSoftwarePin: false,
      }),
    ).toEqual({
      chainFingerprints: {
        btc: 'abcd1234',
      },
      inputPinOnSoftware: false,
      vendor: EHardwareVendor.trezor,
      vendorModel: 'T3W1',
      vendorModelName: 'Safe 7',
      vendorFirmwareVersion: '2.12.0',
    });
  });

  it('does not store unknown third-party firmware version in settings', () => {
    expect(
      buildThirdPartyDeviceSettingsFromDevice({
        device: {
          vendorModel: 'T3T1',
          vendorModelName: 'Safe 5',
        } as never,
        features: {
          major_version: 2,
          minor_version: 10,
          patch_version: 0,
          model: 'Safe 5',
          internal_model: 'T3T1',
          third_party_firmware_version: 'unknown',
        } as never,
        vendor: EHardwareVendor.trezor,
        supportsSoftwarePin: false,
      }),
    ).toEqual({
      inputPinOnSoftware: false,
      vendor: EHardwareVendor.trezor,
      vendorModel: 'T3T1',
      vendorModelName: 'Safe 5',
      vendorFirmwareVersion: '2.10.0',
    });
  });
});

describe('buildTrezorDesktopBleUsbConnectId', () => {
  it('uses firmware device_id as usbConnectId only for Trezor Desktop BLE', () => {
    expect(
      buildTrezorDesktopBleUsbConnectId({
        vendor: EHardwareVendor.trezor,
        transportType: EHardwareTransportType.DesktopWebBle,
        rawDeviceId: 'TREZOR-FEATURES-DEVICE-ID',
      }),
    ).toBe('TREZOR-FEATURES-DEVICE-ID');
  });

  it('does not set usbConnectId for Trezor native BLE', () => {
    expect(
      buildTrezorDesktopBleUsbConnectId({
        vendor: EHardwareVendor.trezor,
        transportType: EHardwareTransportType.BLE,
        rawDeviceId: 'TREZOR-FEATURES-DEVICE-ID',
      }),
    ).toBeUndefined();
  });

  it('does not affect non-Trezor hardware', () => {
    expect(
      buildTrezorDesktopBleUsbConnectId({
        vendor: EHardwareVendor.onekey,
        transportType: EHardwareTransportType.DesktopWebBle,
        rawDeviceId: 'ONEKEY-DEVICE-ID',
      }),
    ).toBeUndefined();
  });
});

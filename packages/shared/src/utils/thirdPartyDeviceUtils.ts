import { EFirmwareType } from '@onekeyfe/hd-shared';
import { isTrezorBleSupportedModel as isSdkTrezorBleSupportedModel } from '@onekeyfe/hwk-trezor-adapter';

import type { EHardwareVendor } from '../../types/device';

type IThirdPartyDeviceSettingsLike = {
  vendor?: EHardwareVendor;
  vendorModel?: string;
  vendorModelName?: string;
  vendorFirmwareVersion?: string;
};

type IThirdPartyDeviceLike = {
  name?: string;
  settings?: IThirdPartyDeviceSettingsLike;
  settingsRaw?: string;
};

type IThirdPartyFeaturesLike = Record<string, unknown> | undefined;

const PERSISTED_FEATURE_FIELD_ALLOWLIST = [
  'major_version',
  'minor_version',
  'patch_version',
  'build_version',
  'device_id',
  'fw_vendor',
  'provider',
  'product',
  'provider_product',
  'language',
  'language_version_matches',
  'pin_protection',
  'passphrase_protection',
  'initialized',
  'unlocked',
  'passphrase_always_on_device',
  'safety_checks',
  'auto_lock_delay_ms',
  'auto_lock_delay_battery_ms',
  'display_rotation',
  'experimental_features',
  'busy',
  'homescreen_format',
  'hide_passphrase_from_host',
  'unit_color',
  'unit_btconly',
  'unit_packaging',
  'haptic_feedback',
  'homescreen_width',
  'homescreen_height',
  'bootloader_locked',
  'optiga_sec',
  'soc',
  'led',
  'usb_connected',
  'wireless_connected',
] as const;

function isTrezorBleSupportedModel(model?: string): boolean {
  return isSdkTrezorBleSupportedModel(model);
}

function getDeviceSettings(
  device?: IThirdPartyDeviceLike,
): IThirdPartyDeviceSettingsLike | undefined {
  if (device?.settings) {
    return device.settings;
  }
  if (!device?.settingsRaw) {
    return undefined;
  }
  try {
    return JSON.parse(device.settingsRaw) as IThirdPartyDeviceSettingsLike;
  } catch {
    return undefined;
  }
}

function getStringField(
  source: IThirdPartyFeaturesLike,
  field: string,
): string | undefined {
  const value = source?.[field];
  return typeof value === 'string' && value ? value : undefined;
}

function getKnownStringField(
  source: IThirdPartyFeaturesLike,
  field: string,
): string | undefined {
  const value = getStringField(source, field);
  return value && value.toLowerCase() !== 'unknown' ? value : undefined;
}

function isPersistedFeatureValue(
  value: unknown,
): value is string | number | boolean {
  return (
    (typeof value === 'string' && value.length > 0) ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  );
}

function copyAllowedFeatureFields(
  target: Record<string, string | number | boolean>,
  source: IThirdPartyFeaturesLike,
) {
  for (const field of PERSISTED_FEATURE_FIELD_ALLOWLIST) {
    const value = source?.[field];
    if (isPersistedFeatureValue(value)) {
      target[field] = value;
    }
  }
}

function buildFirmwareVersionFromParts(
  features: IThirdPartyFeaturesLike,
): string | undefined {
  const major = features?.major_version;
  const minor = features?.minor_version;
  const patch = features?.patch_version;
  if (
    typeof major === 'number' &&
    typeof minor === 'number' &&
    typeof patch === 'number'
  ) {
    return `${major}.${minor}.${patch}`;
  }
  return undefined;
}

function buildPersistedFeatures({
  features,
  vendor,
  label,
  model,
  internalModel,
  firmwareVersion,
  serialNumber,
}: {
  features: IThirdPartyFeaturesLike;
  vendor: EHardwareVendor;
  label?: string;
  model?: string;
  internalModel?: string;
  firmwareVersion?: string;
  serialNumber?: string;
}): Record<string, string | number | boolean> {
  const result: Record<string, string | number | boolean> = {
    vendor,
  };

  copyAllowedFeatureFields(result, features);

  if (label) {
    result.label = label;
  }
  if (model) {
    result.model = model;
  }
  if (internalModel) {
    result.internal_model = internalModel;
  }
  if (serialNumber) {
    result.serial_no = serialNumber;
  }
  if (firmwareVersion) {
    result.third_party_firmware_version = firmwareVersion;
  }

  return result;
}

function getDeviceVersion({
  device,
  features,
}: {
  device?: IThirdPartyDeviceLike;
  features?: IThirdPartyFeaturesLike;
}): {
  bleVersion: string;
  firmwareVersion: string;
  bootloaderVersion: string;
} {
  return {
    bleVersion: '',
    bootloaderVersion: '',
    firmwareVersion:
      getDeviceSettings(device)?.vendorFirmwareVersion ||
      getKnownStringField(features, 'third_party_firmware_version') ||
      getKnownStringField(features, 'firmware_version') ||
      buildFirmwareVersionFromParts(features) ||
      '',
  };
}

function getFirmwareType({
  features,
}: {
  features?: IThirdPartyFeaturesLike;
}): EFirmwareType {
  const fwVendor = getStringField(features, 'fw_vendor');
  if (fwVendor === 'Trezor Bitcoin-only') {
    return EFirmwareType.BitcoinOnly;
  }
  if (fwVendor === 'Trezor') {
    return EFirmwareType.Universal;
  }

  if (features?.bootloader_mode === true) {
    return features.unit_btconly === true
      ? EFirmwareType.BitcoinOnly
      : EFirmwareType.Universal;
  }

  const capabilities = features?.capabilities;
  if (Array.isArray(capabilities) && capabilities.length > 0) {
    return capabilities.includes('Capability_Bitcoin_like')
      ? EFirmwareType.Universal
      : EFirmwareType.BitcoinOnly;
  }

  return EFirmwareType.Universal;
}

function isBtcOnlyFirmware({
  features,
}: {
  features?: IThirdPartyFeaturesLike;
}): boolean {
  return getFirmwareType({ features }) === EFirmwareType.BitcoinOnly;
}

function isTrezorBleSupportedDevice(device?: IThirdPartyDeviceLike): boolean {
  return isTrezorBleSupportedModel(getDeviceSettings(device)?.vendorModel);
}

function isTrezorBleBindingSupportedPlatform({
  isDesktop,
  isSupportDesktopBle,
}: {
  isDesktop?: boolean;
  isSupportDesktopBle?: boolean;
}): boolean {
  if (typeof isSupportDesktopBle === 'boolean') {
    return isSupportDesktopBle;
  }
  return isDesktop === true;
}

function getDeviceModelName({
  device,
  features,
  defaultDeviceName,
}: {
  device?: IThirdPartyDeviceLike;
  features?: IThirdPartyFeaturesLike;
  defaultDeviceName?: string;
}): string {
  return (
    device?.settings?.vendorModelName ||
    getStringField(features, 'model') ||
    device?.settings?.vendorModel ||
    getStringField(features, 'internal_model') ||
    defaultDeviceName ||
    ''
  );
}

function getDeviceName({
  device,
  features,
  defaultDeviceName,
}: {
  device?: IThirdPartyDeviceLike;
  features?: IThirdPartyFeaturesLike;
  defaultDeviceName?: string;
}): string {
  return (
    device?.name ||
    getStringField(features, 'label') ||
    getDeviceModelName({ device, features, defaultDeviceName })
  );
}

function getSerialNo(features: IThirdPartyFeaturesLike): string | undefined {
  return getStringField(features, 'serial_no');
}

export default {
  buildPersistedFeatures,
  getDeviceModelName,
  getDeviceName,
  getDeviceVersion,
  getFirmwareType,
  getSerialNo,
  isBtcOnlyFirmware,
  isTrezorBleBindingSupportedPlatform,
  isTrezorBleSupportedDevice,
  isTrezorBleSupportedModel,
};

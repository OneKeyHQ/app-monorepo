import { EDeviceType, EFirmwareType } from '@onekeyfe/hd-shared';
import semver from 'semver';

import type { IBackgroundApi } from '@onekeyhq/kit-bg/src/apis/IBackgroundApi';
import type { IDBDevice } from '@onekeyhq/kit-bg/src/dbs/local/types';
import type { IHardwareUiState } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import { EHardwareTransportType } from '../../types';
import {
  EFirmwareUpdateTipMessages,
  EFirmwareVerifyType,
  EOneKeyDeviceMode,
} from '../../types/device';
import { CoreSDKLoader } from '../hardware/instance';
import platformEnv from '../platformEnv';

import { DeviceScannerUtils } from './DeviceScannerUtils';

import type {
  IAllDeviceVerifyVersions,
  IDeviceVerifyRawVersions,
  IDeviceVerifyVersions,
  IFetchFirmwareVerifyHashParams,
  IFirmwareVerifyInfo,
  IOneKeyDeviceFeatures,
  IOneKeyDeviceFeaturesWithAppParams,
  IOneKeyDeviceType,
} from '../../types/device';
import type {
  Features,
  IDeviceType,
  KnownDevice,
  OnekeyFeatures,
  SearchDevice,
} from '@onekeyfe/hd-core';

export enum EHardwareUiStateAction {
  DeviceChecking = 'DeviceChecking',
  EnterPinOnDevice = 'EnterPinOnDevice',
  ProcessLoading = 'ProcessLoading',

  // @onekeyfe/hd-core UI_REQUEST const map ----------------------------------------------

  REQUEST_PIN = 'ui-request_pin',
  REQUEST_PIN_TYPE_PIN_ENTRY = 'ButtonRequest_PinEntry',
  REQUEST_PIN_TYPE_ATTACH_PIN = 'ButtonRequest_AttachPin',
  INVALID_PIN = 'ui-invalid_pin',
  REQUEST_BUTTON = 'ui-button',
  REQUEST_PASSPHRASE = 'ui-request_passphrase',
  REQUEST_PASSPHRASE_ON_DEVICE = 'ui-request_passphrase_on_device',
  REQUEST_DEVICE_IN_BOOTLOADER_FOR_WEB_DEVICE = 'ui-request_select_device_in_bootloader_for_web_device',
  REQUEST_DEVICE_FOR_SWITCH_FIRMWARE_WEB_DEVICE = 'ui-request_select_device_for_switch_firmware_web_device',

  CLOSE_UI_WINDOW = 'ui-close_window',
  CLOSE_UI_PIN_WINDOW = 'ui-close_pin_window',
  DEVICE_PROGRESS = 'ui-device_progress',

  BLUETOOTH_PERMISSION = 'ui-bluetooth_permission',
  BLUETOOTH_CHARACTERISTIC_NOTIFY_CHANGE_FAILURE = 'ui-bluetooth_characteristic_notify_change_failure',
  LOCATION_PERMISSION = 'ui-location_permission',
  LOCATION_SERVICE_PERMISSION = 'ui-location_service_permission',

  FIRMWARE_PROCESSING = 'ui-firmware-processing',
  FIRMWARE_PROGRESS = 'ui-firmware-progress',
  FIRMWARE_TIP = 'ui-firmware-tip',

  PREVIOUS_ADDRESS = 'ui-previous_address_result',

  WEB_DEVICE_PROMPT_ACCESS_PERMISSION = 'ui-web_device_prompt_access_permission',
  DESKTOP_REQUEST_BLUETOOTH_PERMISSION = 'ui-desktop_request_bluetooth_permission',
  BLUETOOTH_PERMISSION_UNAUTHORIZED = 'ui-bluetooth_permission_unauthorized',
  BLUETOOTH_DEVICE_PAIRING = 'ui-bluetooth_device_pairing',
  BLUETOOTH_UNSUPPORTED = 'ui-bluetooth_unsupported',
  BLUETOOTH_POWERED_OFF = 'ui-bluetooth_powered_off',
}

type IGetDeviceVersionParams = {
  device: IDBDevice | Omit<SearchDevice, 'commType'> | undefined;
  features: IOneKeyDeviceFeatures | undefined;
};

// TODO move to db converter
function dbDeviceToSearchDevice(device: IDBDevice) {
  const result: Omit<SearchDevice, 'commType'> = {
    ...device,
    connectId: device.connectId,
    uuid: device.uuid,
    deviceId: device.deviceId,
    deviceType: device.deviceType,
    name: device.name,
  };
  return result;
}

function getDeviceSerialNoFromFeatures(
  features: IOneKeyDeviceFeatures | undefined,
) {
  return (
    features?.onekey_serial_no ?? features?.onekey_serial ?? features?.serial_no
  );
}

// web sdk return KnownDevice
// ble sdk return SearchDevice
// db return IDBDevice
async function getDeviceVersion(params: IGetDeviceVersionParams): Promise<{
  bleVersion: string;
  firmwareVersion: string;
  bootloaderVersion: string;
}> {
  const { getDeviceBootloaderVersion, getDeviceFirmwareVersion } =
    await CoreSDKLoader();
  const { device, features } = params;
  const knownDevice = device as KnownDevice | undefined;
  const dbDevice = device as IDBDevice | undefined;
  const usedFeatures =
    features || dbDevice?.featuresInfo || knownDevice?.features;

  const bootloaderVersion = usedFeatures
    ? (getDeviceBootloaderVersion(usedFeatures) || []).join('.') ||
      usedFeatures?.bootloader_version ||
      ''
    : '';

  const bleVersion =
    (knownDevice?.bleFirmwareVersion || []).join('.') ||
    usedFeatures?.ble_ver ||
    '';

  const firmwareVersion = usedFeatures
    ? (getDeviceFirmwareVersion(usedFeatures) || []).join('.') ||
      (knownDevice?.firmwareVersion || []).join('.') ||
      usedFeatures?.onekey_firmware_version ||
      ''
    : '';

  return {
    bleVersion,
    firmwareVersion,
    bootloaderVersion,
  };
}

async function getDeviceVersionStr(params: IGetDeviceVersionParams) {
  const { bleVersion, firmwareVersion, bootloaderVersion } =
    await getDeviceVersion(params);
  // keep empty if version not found
  return `${bootloaderVersion}--${bleVersion}--${firmwareVersion}`;
}

function isTouchDevice(deviceType: IDeviceType) {
  return [EDeviceType.Touch, EDeviceType.Pro].includes(deviceType);
}

async function getDeviceTypeFromFeatures({
  features,
}: {
  features: IOneKeyDeviceFeatures;
}): Promise<IDeviceType> {
  const { getDeviceType } = await CoreSDKLoader();
  return Promise.resolve(getDeviceType(features));
}

let scanner: DeviceScannerUtils | undefined;
function getDeviceScanner({
  backgroundApi,
}: {
  backgroundApi: IBackgroundApi;
}) {
  if (!scanner) {
    scanner = new DeviceScannerUtils({ backgroundApi });
  }
  return scanner;
}

async function getDeviceModeFromFeatures({
  features,
}: {
  features: IOneKeyDeviceFeatures;
}): Promise<EOneKeyDeviceMode> {
  // https://github.com/OneKeyHQ/hardware-js-sdk/blob/onekey/packages/core/src/device/Device.ts#L503
  // if (features?.bootloader_mode) return EOneKeyDeviceMode.bootloader;
  // if (!features?.initialized) return EOneKeyDeviceMode.initialize;
  // if (features?.no_backup) return EOneKeyDeviceMode.seedless;
  // return EOneKeyDeviceMode.normal;

  if (features?.bootloader_mode) {
    // bootloader mode
    return EOneKeyDeviceMode.bootloader;
  }
  if (!features?.initialized) {
    // not initialized
    return EOneKeyDeviceMode.notInitialized;
  }

  if (features?.no_backup) {
    // backup mode
    return EOneKeyDeviceMode.backupMode;
  }

  // normal mode
  return EOneKeyDeviceMode.normal;
}

async function isBootloaderModeByFeatures({
  features,
}: {
  features: IOneKeyDeviceFeatures;
}) {
  return (
    (await getDeviceModeFromFeatures({ features })) ===
    EOneKeyDeviceMode.bootloader
  );
}

async function existsFirmwareByFeatures({
  features,
}: {
  features: IOneKeyDeviceFeatures;
}) {
  return features?.firmware_present === true;
}

async function isBootloaderModeFromSearchDevice({
  device,
}: {
  device: { mode?: string };
}) {
  return device?.mode === 'bootloader';
}

async function existsFirmwareFromSearchDevice({
  device,
}: {
  device: { features?: { firmware_present?: boolean } };
}) {
  return device?.features?.firmware_present === true;
}

function isConfirmOnDeviceAction(state: IHardwareUiState | undefined) {
  return (
    state?.action === EHardwareUiStateAction.REQUEST_PIN ||
    state?.action === EHardwareUiStateAction.REQUEST_BUTTON ||
    state?.payload?.firmwareTipData?.message ===
      EFirmwareUpdateTipMessages.ConfirmOnDevice
  );
}

function getUpdatingConnectId({
  connectId,
  currentTransportType,
}: {
  connectId: string | undefined;
  currentTransportType: EHardwareTransportType;
}) {
  if (platformEnv.isSupportDesktopBle) {
    if (currentTransportType === EHardwareTransportType.DesktopWebBle) {
      return connectId;
    }
    return undefined;
  }
  return platformEnv.isNative ? connectId : undefined;
}

function getFixedUpdatingConnectId({
  updatingConnectId,
  currentTransportType,
  device,
}: {
  updatingConnectId: string | undefined;
  currentTransportType: EHardwareTransportType;
  device: IDBDevice | undefined;
}) {
  if (
    platformEnv.isSupportDesktopBle &&
    currentTransportType === EHardwareTransportType.DesktopWebBle &&
    device?.connectId
  ) {
    return device?.connectId || updatingConnectId;
  }
  return updatingConnectId;
}

async function buildDeviceLabel({
  features,
  buildModelName,
}: {
  features: IOneKeyDeviceFeatures;
  buildModelName?: boolean;
}): Promise<string | ''> {
  if (features.label && !buildModelName) {
    return features.label;
  }
  const defaultLabelsByDeviceType: Record<IOneKeyDeviceType, string> = {
    [EDeviceType.Classic]: 'OneKey Classic',
    [EDeviceType.Classic1s]: 'OneKey Classic 1S',
    [EDeviceType.ClassicPure]: 'OneKey Classic 1S Pure',
    [EDeviceType.Mini]: 'OneKey Mini',
    [EDeviceType.Touch]: 'OneKey Touch',
    [EDeviceType.Pro]: 'OneKey Pro',
    [EDeviceType.Unknown]: '',
  };
  const deviceType = await getDeviceTypeFromFeatures({
    features,
  });
  return defaultLabelsByDeviceType[deviceType] || '';
}

async function buildDeviceName({
  device,
  features,
}: {
  device?: Omit<SearchDevice, 'commType'>;
  features: IOneKeyDeviceFeatures;
}): Promise<string> {
  const label = await buildDeviceLabel({ features });
  if (label) {
    return label;
  }
  const { getDeviceUUID } = await CoreSDKLoader();
  const deviceUUID = device?.uuid || getDeviceUUID(features);
  return (
    features.label || features.ble_name || `OneKey ${deviceUUID.slice(-4)}`
  );
}

function buildDeviceBleName({
  features,
}: {
  features: IOneKeyDeviceFeatures | undefined;
}): string | undefined {
  if (!features) {
    return undefined;
  }
  return features.ble_name;
}

async function getDeviceVerifyVersionsFromFeatures({
  deviceType,
  features,
}: {
  deviceType?: IDeviceType;
  features: OnekeyFeatures | IOneKeyDeviceFeatures;
}): Promise<IFetchFirmwareVerifyHashParams | null> {
  let finalDeviceType = deviceType;
  if (!deviceType) {
    finalDeviceType = await getDeviceTypeFromFeatures({
      features: features as IOneKeyDeviceFeatures,
    });
  }
  if (!finalDeviceType || finalDeviceType === 'unknown') {
    return null;
  }

  // eslint-disable-next-line @typescript-eslint/no-use-before-define
  const firmwareType = await getFirmwareType({
    features: features as IOneKeyDeviceFeatures,
  });

  const {
    onekey_firmware_version: onekeyFirmwareVersion,
    onekey_ble_version: onekeyBleVersion,
    onekey_boot_version: onekeyBootVersion,
  } = features;
  if (!onekeyFirmwareVersion || !onekeyBleVersion || !onekeyBootVersion) {
    return null;
  }

  return {
    deviceType: finalDeviceType,
    firmwareVersion: onekeyFirmwareVersion,
    bluetoothVersion: onekeyBleVersion,
    bootloaderVersion: onekeyBootVersion,
    firmwareType,
  };
}

function formatVersionWithHash(
  rawVersion: IDeviceVerifyRawVersions,
): IDeviceVerifyVersions {
  const { version, checksum, commitId, releaseUrl } = rawVersion;

  if (!version) {
    return {
      raw: { version, checksum, commitId },
      formatted: '',
    };
  }

  if (!checksum || !commitId) {
    return {
      raw: { version, checksum, commitId },
      formatted: '-',
    };
  }

  let validatedReleaseUrl: string | undefined;

  try {
    if (releaseUrl) {
      // eslint-disable-next-line no-new
      new URL(releaseUrl);
      validatedReleaseUrl = releaseUrl;
    }
  } catch {
    // ignore
  }

  return {
    raw: { version, checksum, commitId },
    releaseUrl: validatedReleaseUrl,
    formatted: `${version} (${commitId}-${checksum.slice(0, 7)})`,
  };
}

export function parseLocalDeviceVersions({
  onekeyFeatures,
}: {
  onekeyFeatures: OnekeyFeatures;
}): IAllDeviceVerifyVersions {
  return {
    firmware: formatVersionWithHash({
      version: onekeyFeatures.onekey_firmware_version,
      checksum: onekeyFeatures.onekey_firmware_hash,
      commitId: onekeyFeatures.onekey_firmware_build_id,
    }),
    bluetooth: formatVersionWithHash({
      version: onekeyFeatures.onekey_ble_version,
      checksum: onekeyFeatures.onekey_ble_hash,
      commitId: onekeyFeatures.onekey_ble_build_id,
    }),
    bootloader: formatVersionWithHash({
      version: onekeyFeatures.onekey_boot_version,
      checksum: onekeyFeatures.onekey_boot_hash,
      commitId: onekeyFeatures.onekey_boot_build_id,
    }),
  };
}

export function parseServerVersionInfos({
  serverVerifyInfos,
}: {
  serverVerifyInfos: IFirmwareVerifyInfo[];
}): IAllDeviceVerifyVersions {
  const defaultVersion: IDeviceVerifyVersions = {
    raw: { version: '', checksum: '', commitId: '' },
    formatted: '',
  };

  const result: IAllDeviceVerifyVersions = {
    firmware: defaultVersion,
    bluetooth: defaultVersion,
    bootloader: defaultVersion,
  };

  // loop through server verify infos
  serverVerifyInfos.forEach((item) => {
    switch (item.type) {
      case EFirmwareVerifyType.System:
        result.firmware = formatVersionWithHash(item);
        break;
      case EFirmwareVerifyType.Bluetooth:
        result.bluetooth = formatVersionWithHash(item);
        break;
      case EFirmwareVerifyType.Bootloader:
        result.bootloader = formatVersionWithHash(item);
        break;
      default:
        break;
    }
  });

  return result;
}

export function compareDeviceVersions({
  local,
  remote,
}: {
  local: IDeviceVerifyRawVersions;
  remote: IDeviceVerifyRawVersions;
}): boolean {
  return (
    local.version === remote.version &&
    local.checksum === remote.checksum &&
    local.commitId === remote.commitId
  );
}

async function shouldUseV2FirmwareUpdateFlow({
  features,
}: {
  features: IOneKeyDeviceFeatures | undefined;
}) {
  if (!features) {
    return false;
  }

  const { getDeviceBootloaderVersion, getDeviceType } = await CoreSDKLoader();
  const deviceType = getDeviceType(features);
  if (deviceType !== EDeviceType.Pro) {
    return false;
  }
  const bootloaderVersion = getDeviceBootloaderVersion(features)?.join('.');
  return !!(
    semver.valid(bootloaderVersion) &&
    // TODO: use constant
    semver.gte(bootloaderVersion, '2.8.0')
  );
}

function getRawDeviceId({
  device,
  features,
}: {
  device: Omit<SearchDevice, 'commType'>;
  features: IOneKeyDeviceFeatures;
}) {
  // SearchDevice.deviceId is undefined when BLE connecting
  // const rawDeviceId = device.deviceId || features.device_id || '';
  const rawDeviceId = device.deviceId || features.device_id || '';
  return rawDeviceId;
}

/**
 * Get the appropriate connectId based on transport type
 * @param device - The device object
 * @param transportType - The transport type (USB, BLE, etc.)
 * @returns The appropriate connectId for the transport type
 */
function getDeviceConnectId(
  device: IDBDevice,
  transportType: EHardwareTransportType,
): string {
  switch (transportType) {
    case EHardwareTransportType.WEBUSB:
    case EHardwareTransportType.Bridge:
      return device.usbConnectId || device.connectId;

    case EHardwareTransportType.BLE:
    case EHardwareTransportType.DesktopWebBle:
      return device.bleConnectId || device.connectId;

    default:
      return device.connectId;
  }
}

function getDefaultHardwareTransportType(): EHardwareTransportType {
  if (platformEnv.isNative) {
    return EHardwareTransportType.BLE;
  }
  // Because of uDev rules, using http bridge in linux desktop
  if (platformEnv.isDesktopLinux) {
    return EHardwareTransportType.Bridge;
  }
  if (platformEnv.isSupportWebUSB) {
    return EHardwareTransportType.WEBUSB;
  }
  return EHardwareTransportType.Bridge;
}

function getFirmwareTypeByCachedFeatures({
  features,
}: {
  features:
    | (IOneKeyDeviceFeatures & { $app_firmware_type?: EFirmwareType })
    | undefined;
}) {
  if (!features) {
    return EFirmwareType.Universal;
  }

  return features.$app_firmware_type;
}

async function getFirmwareType({
  features,
}: {
  features:
    | (IOneKeyDeviceFeatures & { $app_firmware_type?: EFirmwareType })
    | undefined;
}) {
  if (!features) {
    return EFirmwareType.Universal;
  }

  if (
    features.$app_firmware_type &&
    features.$app_firmware_type === EFirmwareType.BitcoinOnly
  ) {
    return EFirmwareType.BitcoinOnly;
  }

  const { getFirmwareType: sdkGetFirmwareType } = await CoreSDKLoader();
  return sdkGetFirmwareType(features);
}

function getFirmwareTypeLabelByFirmwareType({
  firmwareType,
  returnUniversal,
  displayFormat,
}: {
  firmwareType: EFirmwareType | undefined;
  returnUniversal?: boolean;
  displayFormat?: 'withSpace' | 'withoutSpace';
}) {
  const space = displayFormat === 'withSpace' ? ' ' : '';

  if (!firmwareType) {
    if (returnUniversal) {
      return `Universal${space}`;
    }
    return '';
  }

  if (firmwareType === EFirmwareType.BitcoinOnly) {
    return `Bitcoin-Only${space}`;
  }

  if (!!returnUniversal && firmwareType === EFirmwareType.Universal) {
    return `Universal${space}`;
  }
  return '';
}

async function getFirmwareTypeLabel({
  features,
  returnUniversal,
  displayFormat,
}: {
  features: IOneKeyDeviceFeatures | undefined;
  returnUniversal?: boolean;
  displayFormat?: 'withSpace' | 'withoutSpace';
}) {
  if (!features) {
    return getFirmwareTypeLabelByFirmwareType({
      firmwareType: undefined,
      returnUniversal,
      displayFormat,
    });
  }

  const { getFirmwareType: sdkGetFirmwareType } = await CoreSDKLoader();
  const firmwareType = sdkGetFirmwareType(features);
  return getFirmwareTypeLabelByFirmwareType({
    firmwareType,
    returnUniversal,
    displayFormat,
  });
}

async function isBtcOnlyFirmware({
  features,
}: {
  features: IOneKeyDeviceFeatures | undefined;
}) {
  if (!features) {
    return false;
  }
  const firmwareType = await getFirmwareType({ features });
  return firmwareType === EFirmwareType.BitcoinOnly;
}

async function buildDeviceUSBConnectId({
  features,
}: {
  features: Features | undefined;
}): Promise<string | null> {
  if (!features) {
    return null;
  }
  const { getDeviceUUID } = await CoreSDKLoader();
  return getDeviceUUID(features);
}

async function attachAppParamsToFeatures({
  features,
}: {
  features: IOneKeyDeviceFeatures;
}): Promise<IOneKeyDeviceFeaturesWithAppParams> {
  const firmwareType = await getFirmwareType({
    features,
  });
  return { ...features, $app_firmware_type: firmwareType };
}

export default {
  dbDeviceToSearchDevice,
  getDeviceVersion,
  getDeviceSerialNoFromFeatures,
  getDeviceVersionStr,
  getDeviceTypeFromFeatures,
  getDeviceModeFromFeatures,
  isBootloaderModeByFeatures,
  isBootloaderModeFromSearchDevice,
  existsFirmwareByFeatures,
  existsFirmwareFromSearchDevice,
  getDeviceScanner,
  getUpdatingConnectId,
  getFixedUpdatingConnectId,
  isConfirmOnDeviceAction,
  buildDeviceLabel,
  buildDeviceName,
  buildDeviceBleName,
  getDeviceVerifyVersionsFromFeatures,
  formatVersionWithHash,
  parseLocalDeviceVersions,
  parseServerVersionInfos,
  compareDeviceVersions,
  shouldUseV2FirmwareUpdateFlow,
  getRawDeviceId,
  getDeviceConnectId,
  getDefaultHardwareTransportType,
  isBtcOnlyFirmware,
  getFirmwareTypeByCachedFeatures,
  getFirmwareType,
  getFirmwareTypeLabel,
  getFirmwareTypeLabelByFirmwareType,
  isTouchDevice,
  buildDeviceUSBConnectId,
  attachAppParamsToFeatures,
};

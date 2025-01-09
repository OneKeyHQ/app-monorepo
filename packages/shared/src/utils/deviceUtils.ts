import type { IBackgroundApi } from '@onekeyhq/kit-bg/src/apis/IBackgroundApi';
import type { IDBDevice } from '@onekeyhq/kit-bg/src/dbs/local/types';
import type { IHardwareUiState } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { EHardwareUiStateAction } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import {
  EFirmwareUpdateTipMessages,
  EFirmwareVerifyType,
  EOneKeyDeviceMode,
} from '../../types/device';
import bleManagerInstance from '../hardware/bleManager';
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
  IOneKeyDeviceType,
} from '../../types/device';
import type {
  IDeviceType,
  KnownDevice,
  OnekeyFeatures,
  SearchDevice,
} from '@onekeyfe/hd-core';

type IGetDeviceVersionParams = {
  device: SearchDevice | undefined;
  features: IOneKeyDeviceFeatures | undefined;
};

// TODO move to db converter
function dbDeviceToSearchDevice(device: IDBDevice) {
  const result: SearchDevice = {
    ...device,
    connectId: device.connectId,
    uuid: device.uuid,
    deviceId: device.deviceId,
    deviceType: device.deviceType,
    name: device.name,
  };
  return result;
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
}: {
  connectId: string | undefined;
}) {
  return platformEnv.isNative ? connectId : undefined;
}

async function checkDeviceBonded(connectId: string) {
  return bleManagerInstance.checkDeviceBonded(connectId);
}

async function buildDeviceLabel({
  features,
}: {
  features: IOneKeyDeviceFeatures;
}): Promise<string | ''> {
  if (features.label) {
    return features.label;
  }
  const defaultLabelsByDeviceType: Record<IOneKeyDeviceType, string> = {
    'classic': 'OneKey Classic',
    'classic1s': 'OneKey Classic 1S',
    'mini': 'OneKey Mini',
    'touch': 'OneKey Touch',
    'pro': 'OneKey Pro',
    'unknown': '',
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
  device?: SearchDevice;
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

export default {
  dbDeviceToSearchDevice,
  getDeviceVersion,
  getDeviceVersionStr,
  getDeviceTypeFromFeatures,
  getDeviceModeFromFeatures,
  isBootloaderModeByFeatures,
  isBootloaderModeFromSearchDevice,
  existsFirmwareByFeatures,
  existsFirmwareFromSearchDevice,
  getDeviceScanner,
  getUpdatingConnectId,
  isConfirmOnDeviceAction,
  checkDeviceBonded,
  buildDeviceLabel,
  buildDeviceName,
  getDeviceVerifyVersionsFromFeatures,
  formatVersionWithHash,
  parseLocalDeviceVersions,
  parseServerVersionInfos,
  compareDeviceVersions,
};

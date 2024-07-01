import type { IBackgroundApi } from '@onekeyhq/kit-bg/src/apis/IBackgroundApi';
import type { IDBDevice } from '@onekeyhq/kit-bg/src/dbs/local/types';
import type { IHardwareUiState } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { EHardwareUiStateAction } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import {
  EFirmwareUpdateTipMessages,
  EOneKeyDeviceMode,
} from '../../types/device';
import bleManagerInstance from '../hardware/bleManager';
import { CoreSDKLoader } from '../hardware/instance';
import platformEnv from '../platformEnv';

import { DeviceScannerUtils } from './DeviceScannerUtils';

import type { IOneKeyDeviceFeatures } from '../../types/device';
import type { IDeviceType, KnownDevice, SearchDevice } from '@onekeyfe/hd-core';

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
};

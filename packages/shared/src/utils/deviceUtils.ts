import {
  getDeviceBootloaderVersion,
  getDeviceFirmwareVersion,
} from '@onekeyfe/hd-core';

import type { IDBDevice } from '@onekeyhq/kit-bg/src/dbs/local/types';

import type { IOneKeyDeviceFeatures } from '../../types';
import type { KnownDevice, SearchDevice } from '@onekeyfe/hd-core';

type IGetDeviceVersionParams = {
  device: SearchDevice;
  features: IOneKeyDeviceFeatures;
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
function getDeviceVersion(params: IGetDeviceVersionParams): {
  bleVersion: string;
  firmwareVersion: string;
  bootloaderVersion: string;
} {
  const { device, features } = params;
  const knownDevice = device as KnownDevice;
  const dbDevice = device as IDBDevice;
  const usedFeatures =
    features || dbDevice?.featuresInfo || knownDevice?.features;

  const bootloaderVersion =
    (getDeviceBootloaderVersion(usedFeatures) || []).join('.') ||
    usedFeatures?.bootloader_version ||
    '';

  const bleVersion =
    (knownDevice?.bleFirmwareVersion || []).join('.') ||
    usedFeatures?.ble_ver ||
    '';

  const firmwareVersion =
    (getDeviceFirmwareVersion(usedFeatures) || []).join('.') ||
    (knownDevice?.firmwareVersion || []).join('.') ||
    usedFeatures?.onekey_firmware_version ||
    '';

  return {
    bleVersion,
    firmwareVersion,
    bootloaderVersion,
  };
}

function getDeviceVersionStr(params: IGetDeviceVersionParams) {
  const { bleVersion, firmwareVersion, bootloaderVersion } =
    getDeviceVersion(params);
  // keep empty if version not found
  return `${bootloaderVersion}--${bleVersion}--${firmwareVersion}`;
}

export default {
  dbDeviceToSearchDevice,
  getDeviceVersion,
  getDeviceVersionStr,
};

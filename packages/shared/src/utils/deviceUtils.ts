import type { IDBDevice } from '@onekeyhq/kit-bg/src/dbs/local/types';

import type { KnownDevice, SearchDevice } from '@onekeyfe/hd-core';

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
function getDeviceVersion(device: SearchDevice | KnownDevice | IDBDevice) {
  const deviceFull = device as KnownDevice;
  let bleVersion = (deviceFull.bleFirmwareVersion || []).join('.');
  let firmwareVersion = (deviceFull.firmwareVersion || []).join('.');

  if (!bleVersion) {
    bleVersion = (device as IDBDevice)?.featuresInfo?.ble_ver || '';
  }
  if (!firmwareVersion) {
    firmwareVersion =
      (device as IDBDevice)?.featuresInfo?.onekey_firmware_version || '';
  }
  return {
    bleVersion,
    firmwareVersion,
  };
}

function getDeviceVersionStr(device: SearchDevice) {
  const { bleVersion, firmwareVersion } = getDeviceVersion(device);
  return `${bleVersion}--${firmwareVersion}`;
}

export default {
  dbDeviceToSearchDevice,
  getDeviceVersion,
  getDeviceVersionStr,
};

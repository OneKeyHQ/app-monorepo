import type { IDBDevice } from '@onekeyhq/kit-bg/src/dbs/local/types';

import type { IDeviceType, KnownDevice, SearchDevice } from '@onekeyfe/hd-core';

// TODO move to db converter
function dbDeviceToSearchDevice(device: IDBDevice) {
  const result: SearchDevice = {
    ...device,
    connectId: device.connectId,
    uuid: device.uuid,
    deviceId: device.deviceId,
    deviceType: device.deviceType as IDeviceType,
    name: device.name,
  };
  return result;
}

function getDeviceVersion(device: SearchDevice) {
  const deviceFull = device as KnownDevice;
  const bleVersion = (deviceFull.bleFirmwareVersion || []).join('.');
  const firmwareVersion = (deviceFull.firmwareVersion || []).join('.');
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

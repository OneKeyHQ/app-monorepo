import type { IDBDevice } from '@onekeyhq/kit-bg/src/dbs/local/types';

import type { IDeviceType, SearchDevice } from '@onekeyfe/hd-core';

// TODO move to db converter
function dbDeviceToSearchDevice(device: IDBDevice) {
  const result: SearchDevice = {
    ...device,
    connectId: device.connectId || device.mac,
    uuid: device.uuid,
    deviceId: device.deviceId,
    deviceType: device.deviceType as IDeviceType,
    name: device.name,
  };
  return result;
}

export default {
  dbDeviceToSearchDevice,
};

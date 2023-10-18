import type { DBDevice, Device } from '../types/device';

function fromDBDeviceToDevice(device: DBDevice): Device {
  let payload: any = {};

  try {
    payload = JSON.parse(device.payloadJson);
  } catch (error) {
    // ignore
  }

  return {
    ...device,
    payload,
  };
}

function fromDeviceToDBDevice(device: Device): DBDevice {
  let payloadJson = '{}';
  try {
    if (typeof device.payload === 'object') {
      payloadJson = JSON.stringify(device.payload);
    }
  } catch (error) {
    // ignore
  }

  return {
    ...device,
    payloadJson,
  };
}

export { fromDBDeviceToDevice, fromDeviceToDBDevice };

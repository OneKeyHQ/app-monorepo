import { DBDevice, Device } from '../types/device';

function fromDBDeviceToDevice(device: DBDevice): Device {
  let payload: any = {};

  try {
    payload = JSON.parse(device.payloadJson);
  } catch (error) {
    // do nothing
  }

  return {
    ...device,
    payload,
  };
}

function fromDeviceToDBDevice(device: Device): DBDevice {
  return {
    ...device,
    payloadJson: JSON.stringify(device.payload) ?? '{}',
  };
}

export { fromDBDeviceToDevice, fromDeviceToDBDevice };

import type { HasName } from './base';

export type DBDevice = HasName & {
  features: string;
  mac: string;
  name: string;
  uuid: string;
  deviceId: string;
  deviceType: string;
  payloadJson: string;
  createdAt: number;
  updatedAt: number;
};

export type DevicePayload = {
  onDeviceInputPin?: boolean;
};

export type Device = Omit<DBDevice, 'payloadJson'> & {
  payload: DevicePayload;
};

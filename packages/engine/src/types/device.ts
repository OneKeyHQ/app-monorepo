import { HasName } from './base';

export type Device = HasName & {
  features: string;
  mac: string;
  name: string;
  uuid: string;
  deviceId: string;
  deviceType: string;
  createdAt: number;
  updatedAt: number;
};

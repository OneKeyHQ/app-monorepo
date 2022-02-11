import { HasName } from './base';

export type Device = HasName & {
  features: string;
  mac: string;
  createdAt: number;
  updatedAt: number;
};

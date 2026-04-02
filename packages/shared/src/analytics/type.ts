export interface IDeviceInfo {
  deviceId?: string;
  manufacturer?: string;
  model?: string;
  os?: string;
  osVersion?: string;
  screenWidth?: number;
  screenHeight?: number;
  arch?: string;
}

export type IGetDeviceInfo = () => Promise<IDeviceInfo>;

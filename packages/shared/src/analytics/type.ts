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

export interface IAnalyticsUserProfile {
  walletCount?: number;
  appWalletCount?: number;
  hwWalletCount?: number;
  keylessWalletCount?: number;
  hwVendors?: string[];
  primaryHwVendor?: string;
}

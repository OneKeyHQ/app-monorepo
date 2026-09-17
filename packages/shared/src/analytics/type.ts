export interface IDeviceInfo {
  deviceId?: string;
  deviceTimeZone?: string;
  deviceUtcOffsetMinutes?: number;
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
  // OneKey ID / Prime membership dimensions, reported for every user
  // (false for users who never logged in) so analytics can segment any
  // event stream by membership without joining subscription events.
  isOneKeyIdLoggedIn?: boolean;
  isPrimeActive?: boolean;
}

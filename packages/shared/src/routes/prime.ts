export enum EPrimePages {
  PrimeDashboard = 'PrimeDashboard',
  PrimeDeviceLimit = 'PrimeDeviceLimit',
  PrimeCloudSync = 'PrimeCloudSync',
}

export type IPrimeParamList = {
  [EPrimePages.PrimeDashboard]: undefined;
  [EPrimePages.PrimeDeviceLimit]: {
    isExceedDeviceLimit?: boolean;
  };
  [EPrimePages.PrimeCloudSync]: undefined;
};

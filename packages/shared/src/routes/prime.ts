export enum EPrimePages {
  PrimeDashboard = 'PrimeDashboard',
  PrimeDeviceLimit = 'PrimeDeviceLimit',
}

export type IPrimeParamList = {
  [EPrimePages.PrimeDashboard]: undefined;
  [EPrimePages.PrimeDeviceLimit]: undefined;
};

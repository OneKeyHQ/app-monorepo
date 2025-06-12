import type { ISubscriptionPeriod } from '@onekeyhq/kit/src/views/Prime/hooks/usePrimePaymentTypes';

export enum EPrimePages {
  PrimeDashboard = 'PrimeDashboard',
  PrimeDeviceLimit = 'PrimeDeviceLimit',
  PrimeCloudSync = 'PrimeCloudSync',
  PrimeCloudSyncDebug = 'PrimeCloudSyncDebug',
  PrimeFeatures = 'PrimeFeatures',
}

export enum EPrimeFeatures {
  OneKeyCloud = 'OneKeyCloud',
  BulkCopyAddresses = 'BulkCopyAddresses',
  DeviceManagement = 'DeviceManagement',
}

export type IPrimeParamList = {
  [EPrimePages.PrimeDashboard]: undefined;
  [EPrimePages.PrimeDeviceLimit]: {
    isExceedDeviceLimit?: boolean;
  };
  [EPrimePages.PrimeCloudSync]: undefined;
  [EPrimePages.PrimeCloudSyncDebug]: undefined;
  [EPrimePages.PrimeFeatures]: {
    selectedFeature?: EPrimeFeatures;
    selectedSubscriptionPeriod?: ISubscriptionPeriod;
    showAllFeatures?: boolean;
  };
};

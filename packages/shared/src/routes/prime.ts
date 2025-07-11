import type { ISubscriptionPeriod } from '@onekeyhq/kit/src/views/Prime/hooks/usePrimePaymentTypes';

export enum EPrimePages {
  PrimeDashboard = 'PrimeDashboard',
  PrimeDeviceLimit = 'PrimeDeviceLimit',
  PrimeCloudSync = 'PrimeCloudSync',
  PrimeCloudSyncDebug = 'PrimeCloudSyncDebug',
  PrimeFeatures = 'PrimeFeatures',
  PrimeDeleteAccount = 'PrimeDeleteAccount',
}

export enum EPrimeFeatures {
  OneKeyCloud = 'OneKeyCloud',
  BulkCopyAddresses = 'BulkCopyAddresses',
  BulkRevoke = 'BulkRevoke',
}

export type IPrimeParamList = {
  [EPrimePages.PrimeDashboard]: {
    networkId?: string;
  };
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
  [EPrimePages.PrimeDeleteAccount]: undefined;
};

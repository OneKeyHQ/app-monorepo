import type { ISubscriptionPeriod } from '@onekeyhq/kit/src/views/Prime/hooks/usePrimePaymentTypes';

// eslint-disable-next-line import/order
import type {
  IE2EESocketUserInfo,
  IPrimeTransferData,
} from '../../types/prime/primeTransferTypes';
import type { IPrimeServerUserInfo } from '../../types/prime/primeTypes';

export enum EPrimePages {
  PrimeDashboard = 'PrimeDashboard',
  PrimeDeviceLimit = 'PrimeDeviceLimit',
  PrimeCloudSync = 'PrimeCloudSync',
  PrimeCloudSyncDebug = 'PrimeCloudSyncDebug',
  PrimeCloudSyncInfo = 'PrimeCloudSyncInfo',
  PrimeFeatures = 'PrimeFeatures',
  PrimeDeleteAccount = 'PrimeDeleteAccount',
  PrimeTransfer = 'PrimeTransfer',
  PrimeTransferPreview = 'PrimeTransferPreview',
}

export enum EPrimeFeatures {
  OneKeyCloud = 'OneKeyCloud',
  BulkCopyAddresses = 'BulkCopyAddresses',
  BulkRevoke = 'BulkRevoke',
  DeviceManagement = 'DeviceManagement',
  CloudTransfer = 'CloudTransfer',
}

export type IPrimeParamList = {
  [EPrimePages.PrimeDashboard]: {
    networkId?: string;
  };
  [EPrimePages.PrimeDeviceLimit]: {
    isExceedDeviceLimit?: boolean;
  };
  [EPrimePages.PrimeCloudSync]: {
    selectedSubscriptionPeriod?: ISubscriptionPeriod;
    serverUserInfo?: IPrimeServerUserInfo;
  };
  [EPrimePages.PrimeCloudSyncDebug]: undefined;
  [EPrimePages.PrimeCloudSyncInfo]: undefined;
  [EPrimePages.PrimeFeatures]: {
    selectedFeature?: EPrimeFeatures;
    selectedSubscriptionPeriod?: ISubscriptionPeriod;
    showAllFeatures?: boolean;
    serverUserInfo?: IPrimeServerUserInfo;
  };
  [EPrimePages.PrimeDeleteAccount]: undefined;
  [EPrimePages.PrimeTransfer]: undefined;
  [EPrimePages.PrimeTransferPreview]: {
    directionUserInfo:
      | {
          fromUser: IE2EESocketUserInfo;
          toUser: IE2EESocketUserInfo;
        }
      | undefined;
    transferData: IPrimeTransferData;
  };
};

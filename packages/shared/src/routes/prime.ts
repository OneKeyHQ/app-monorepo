/* cspell:ignore Infini */
import type { ISubscriptionPeriod } from '@onekeyhq/kit/src/views/Prime/hooks/usePrimePaymentTypes';

import type {
  IE2EESocketUserInfo,
  IPrimeTransferData,
} from '../../types/prime/primeTransferTypes';
import type { IPrimeServerUserInfo } from '../../types/prime/primeTypes';
import type {
  EOneKeyDeepLinkPath,
  IEOneKeyDeepLinkParams,
} from '../consts/deeplinkConsts';

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
  OneKeyId = 'OneKeyId',
  PrimeMyOrders = 'PrimeMyOrders',
  OneKeyIdProfileEdit = 'OneKeyIdProfileEdit',
  PrimeInfiniPayment = 'PrimeInfiniPayment',
  // Infini crypto subscription management page
  PrimeInfiniSubscription = 'PrimeInfiniSubscription',
}

export enum EPrimeFeatures {
  OneKeyCloud = 'OneKeyCloud',
  BulkCopyAddresses = 'BulkCopyAddresses',
  BulkSend = 'BulkSend',
  BulkRevoke = 'BulkRevoke',
  DeviceManagement = 'DeviceManagement',
  CloudTransfer = 'CloudTransfer',
  Notifications = 'Notifications',
  HistoryExport = 'HistoryExport',
  DAppTranslate = 'DAppTranslate',
  BlockaidSiteScan = 'BlockaidSiteScan',
  TransactionSecurityCheck = 'TransactionSecurityCheck',
  ExtendedHistory = 'ExtendedHistory',
  ReceiveRiskMonitoring = 'ReceiveRiskMonitoring',
  AddressRiskCheck = 'AddressRiskCheck',
}

export type IPrimeParamList = {
  [EPrimePages.PrimeDashboard]: {
    networkId?: string;
    fromFeature?: EPrimeFeatures;
    fromDeepLink?: boolean;
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
    networkId?: string;
  };
  [EPrimePages.PrimeDeleteAccount]: undefined;
  [EPrimePages.PrimeTransfer]: IEOneKeyDeepLinkParams[EOneKeyDeepLinkPath.cross_device_transfer];
  [EPrimePages.PrimeTransferPreview]: {
    directionUserInfo:
      | {
          fromUser: IE2EESocketUserInfo;
          toUser: IE2EESocketUserInfo;
        }
      | undefined;
    transferData: IPrimeTransferData;
  };
  [EPrimePages.OneKeyId]: undefined;
  [EPrimePages.PrimeMyOrders]: undefined;
  [EPrimePages.OneKeyIdProfileEdit]: undefined;
  [EPrimePages.PrimeInfiniPayment]: {
    flowId?: string;
    selectedSubscriptionPeriod: ISubscriptionPeriod;
    featureName?: EPrimeFeatures;
    createNewPayment?: boolean;
    networkId?: string;
  };
  [EPrimePages.PrimeInfiniSubscription]: undefined;
};

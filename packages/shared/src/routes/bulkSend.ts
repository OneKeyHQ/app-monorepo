export enum EModalBulkSendRoutes {
  BulkSendAddressesInput = 'bulkSendAddressesInput',
  BulkSendAmountInput = 'BulkSendAmountInput',
  BulkSendReview = 'BulkSendReview',
  BulkSendProcess = 'BulkSendProcess',
}

export type IModalBulkSendParamList = {
  [EModalBulkSendRoutes.BulkSendAddressesInput]: {
    networkId: string;
    accountId: string;
  };
  [EModalBulkSendRoutes.BulkSendAmountInput]: {
    networkId: string;
    accountId: string;
  };
  [EModalBulkSendRoutes.BulkSendReview]: {
    networkId: string;
    accountId: string;
  };
  [EModalBulkSendRoutes.BulkSendProcess]: {
    networkId: string;
    accountId: string;
  };
};

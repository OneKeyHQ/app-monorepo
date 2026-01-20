import type { IToken } from '../../types/token';

export enum EModalBulkSendRoutes {
  BulkSendAddressesInput = 'bulkSendAddressesInput',
  BulkSendAmountInput = 'BulkSendAmountInput',
  BulkSendReview = 'BulkSendReview',
  BulkSendProcess = 'BulkSendProcess',
}

export type IModalBulkSendParamList = {
  [EModalBulkSendRoutes.BulkSendAddressesInput]: {
    networkId: string | undefined;
    accountId: string | undefined;
    indexedAccountId: string | undefined;
    tokenInfo?: IToken;
  };
  [EModalBulkSendRoutes.BulkSendAmountInput]: {
    networkId: string;
    accountId: string;
    senderAddresses: string[];
    receiverAddressesWithAmounts: Record<string, string>; // address: amount
    tokenInfo: IToken;
  };
};

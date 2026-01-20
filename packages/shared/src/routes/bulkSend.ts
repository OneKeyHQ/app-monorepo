import type { IToken } from "../../types/token";

export enum EModalBulkSendRoutes {
  BulkSendAddressesInput = "bulkSendAddressesInput",
  BulkSendAmountsInput = "BulkSendAmountsInput",
  BulkSendReview = "BulkSendReview",
  BulkSendProcess = "BulkSendProcess",
}

export type IModalBulkSendParamList = {
  [EModalBulkSendRoutes.BulkSendAddressesInput]: {
    networkId: string | undefined;
    accountId: string | undefined;
    indexedAccountId: string | undefined;
    tokenInfo?: IToken;
  };
  [EModalBulkSendRoutes.BulkSendAmountsInput]: {
    networkId: string;
    accountId: string;
    senderAddresses: string[];
    receiverAddressesWithAmounts: { address: string; amount: string }[];
    tokenInfo: IToken;
  };
};

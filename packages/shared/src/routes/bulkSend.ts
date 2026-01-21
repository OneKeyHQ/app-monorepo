import type { IToken } from "../../types/token";
import type { EBulkSendMode } from "../../types/bulkSend";

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
    accountId: string | undefined;
    senders: {
      address: string;
      amount: string | undefined;
    }[];
    receivers: { address: string; amount: string | undefined }[];
    tokenInfo: IToken;
    bulkSendMode: EBulkSendMode;
  };
};

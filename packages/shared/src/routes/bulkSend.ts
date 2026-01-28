import type { IToken, ITokenFiat } from "../../types/token";
import type { EBulkSendMode } from "../../types/bulkSend";
import type { IUnsignedTxPro } from "@onekeyhq/core/src/types";

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
    isInModal: boolean;
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
    tokenDetails: { info: IToken } & ITokenFiat;
    bulkSendMode: EBulkSendMode;
    isInModal?: boolean;
  };
  [EModalBulkSendRoutes.BulkSendReview]: {
    networkId: string;
    accountId: string | undefined;
    unsignedTxs: IUnsignedTxPro[];
  };
};

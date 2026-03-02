import type { IUnsignedTxPro } from '@onekeyhq/core/src/types';
import type {
  IApproveInfo,
  ITransferInfo,
} from '@onekeyhq/kit-bg/src/vaults/types';

import type { EBulkSendMode } from '../../types/bulkSend';
import type { IToken, ITokenFiat } from '../../types/token';
import type { ISendTxOnSuccessData } from '../../types/tx';

export enum EModalBulkSendRoutes {
  BulkSendAddressesInput = 'bulkSendAddressesInput',
  BulkSendAmountsInput = 'BulkSendAmountsInput',
  BulkSendReview = 'BulkSendReview',
  BulkSendProcess = 'BulkSendProcess',
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
    approvesInfo: IApproveInfo[];
    tokenInfo: IToken;
    transfersInfo: ITransferInfo[];
    bulkSendMode: EBulkSendMode;
    totalTokenAmount: string;
    totalFiatAmount: string;
    isInModal?: boolean;
    onSuccess?: (data: ISendTxOnSuccessData[]) => void;
    onFail?: (error: Error) => void;
  };
};

import type { IUnsignedTxPro } from '@onekeyhq/core/src/types';
import type {
  IApproveInfo,
  ITransferInfo,
} from '@onekeyhq/kit-bg/src/vaults/types';

import type { EBulkSendMode, IIntervalSettings } from '../../types/bulkSend';
import type { ISendSelectedFeeInfo } from '../../types/fee';
import type { IToken, ITokenFiat } from '../../types/token';
import type { ISendTxOnSuccessData } from '../../types/tx';

export enum EModalBulkSendRoutes {
  BulkSendAddressesInput = 'bulkSendAddressesInput',
  BulkSendAmountsInput = 'BulkSendAmountsInput',
  BulkSendIntervalInput = 'BulkSendIntervalInput',
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
    bulkSendMode?: EBulkSendMode;
  };
  [EModalBulkSendRoutes.BulkSendAmountsInput]: {
    networkId: string;
    accountId: string | undefined;
    senders: {
      address: string;
      amount: string | undefined;
      accountId: string | undefined;
    }[];
    receivers: { address: string; amount: string | undefined }[];
    tokenInfo: IToken;
    tokenDetails: { info: IToken } & ITokenFiat;
    bulkSendMode: EBulkSendMode;
    isInModal?: boolean;
  };
  [EModalBulkSendRoutes.BulkSendIntervalInput]: {
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
    isMaxMode?: boolean;
    ataCount?: number;
    intervalSettings?: IIntervalSettings;
    onConfirmIntervalSettings?: (settings: IIntervalSettings) => void;
    onSuccess?: (data: ISendTxOnSuccessData[]) => void;
    onFail?: (error: Error) => void;
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
    isMaxMode?: boolean;
    ataCount?: number;
    intervalSettings?: IIntervalSettings;
    onSuccess?: (data: ISendTxOnSuccessData[]) => void;
    onFail?: (error: Error) => void;
  };
  [EModalBulkSendRoutes.BulkSendProcess]: {
    networkId: string;
    accountId: string | undefined;
    isInModal?: boolean;
    isMaxMode?: boolean;
    unsignedTxs: IUnsignedTxPro[];
    feeInfo?: ISendSelectedFeeInfo;
    feePresetIndex?: number;
    tokenInfo: IToken;
    transfersInfo: ITransferInfo[];
    bulkSendMode: EBulkSendMode;
    totalTokenAmount: string;
    totalFiatAmount: string;
    intervalSettings?: IIntervalSettings;
    onSuccess?: (data: ISendTxOnSuccessData[]) => void;
    onFail?: (error: Error) => void;
  };
};

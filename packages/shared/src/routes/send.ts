import type { IEncodedTx, IUnsignedTxPro } from '@onekeyhq/core/src/types';
import type {
  ITransferInfo,
  ITransferPayload,
} from '@onekeyhq/kit-bg/src/vaults/types';
import type { IDappSourceInfo } from '@onekeyhq/shared/types';
import type { IAccountNFT } from '@onekeyhq/shared/types/nft';
import type { IToken } from '@onekeyhq/shared/types/token';

import type { IAccountHistoryTx } from '../../types/history';
import type {
  ILNURLAuthServiceResponse,
  ILNURLPayServiceResponse,
  ILNURLWithdrawServiceResponse,
} from '../../types/lightning';
import type { EReplaceTxType, ISendTxOnSuccessData } from '../../types/tx';

export enum EModalSendRoutes {
  SendDataInput = 'SendDataInput',
  SendConfirmFromDApp = 'SendConfirmFromDApp',
  SendConfirm = 'SendConfirm',
  SendFeedback = 'SendFeedback',
  SendReplaceTx = 'SendReplaceTx',

  // Lightning Network
  LnurlPayRequest = 'LnurlPayRequest',
  LnurlWithdraw = 'LnurlWithdraw',
  LnurlAuth = 'LnurlAuth',
  WeblnSendPayment = 'WeblnSendPayment',
}

export type IModalSendParamList = {
  [EModalSendRoutes.SendDataInput]: {
    networkId: string;
    accountId: string;
    isNFT: boolean;
    nfts?: IAccountNFT[];
    token?: IToken;
    address?: string;
    amount?: string;
  };
  [EModalSendRoutes.SendConfirm]: {
    networkId: string;
    accountId: string;
    unsignedTxs: IUnsignedTxPro[];
    sourceInfo?: IDappSourceInfo;
    signOnly?: boolean;
    useFeeInTx?: boolean;
    onSuccess?: (txs: ISendTxOnSuccessData[]) => void;
    onFail?: (error: Error) => void;
    onCancel?: () => void;
    transferPayload?: ITransferPayload;
  };
  [EModalSendRoutes.SendConfirmFromDApp]: undefined;
  [EModalSendRoutes.SendReplaceTx]: {
    networkId: string;
    accountId: string;
    replaceType: EReplaceTxType;
    replaceEncodedTx: IEncodedTx;
    historyTx: IAccountHistoryTx;
    onSuccess?: (data: ISendTxOnSuccessData) => void;
  };

  // Lightning Network
  [EModalSendRoutes.LnurlPayRequest]: {
    networkId: string;
    accountId: string;
    transfersInfo: ITransferInfo[];
    lnurlDetails: ILNURLPayServiceResponse;
    sourceInfo?: IDappSourceInfo;
    onSuccess?: (txs: ISendTxOnSuccessData[]) => void;
    onFail?: (error: Error) => void;
    onCancel?: () => void;
    isSendFlow?: boolean;
  };
  [EModalSendRoutes.LnurlWithdraw]: {
    networkId: string;
    accountId: string;
    lnurlDetails: ILNURLWithdrawServiceResponse;
    sourceInfo?: IDappSourceInfo;
    isSendFlow?: boolean;
  };
  [EModalSendRoutes.LnurlAuth]: {
    networkId: string;
    accountId: string;
    lnurlDetails: ILNURLAuthServiceResponse;
    isSendFlow: boolean;
  };
  [EModalSendRoutes.WeblnSendPayment]: undefined;
};

import type { IUnsignedTxPro } from '@onekeyhq/core/src/types';
import type { ITransferInfo } from '@onekeyhq/kit-bg/src/vaults/types';
import type { IDappSourceInfo } from '@onekeyhq/shared/types';
import type { IAccountNFT } from '@onekeyhq/shared/types/nft';
import type { IToken } from '@onekeyhq/shared/types/token';

import type {
  ILNURLAuthServiceResponse,
  ILNURLPayServiceResponse,
  ILNURLWithdrawServiceResponse,
} from '../../types/lightning';
import type { ISendTxOnSuccessData } from '../../types/tx';

export enum EModalSendRoutes {
  SendDataInput = 'SendDataInput',
  SendConfirmFromDApp = 'SendConfirmFromDApp',
  SendConfirm = 'SendConfirm',
  SendFeedback = 'SendFeedback',

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
  };
  [EModalSendRoutes.SendConfirmFromDApp]: undefined;

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

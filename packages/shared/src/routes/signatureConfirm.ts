import type {
  IEncodedTx,
  IUnsignedMessage,
  IUnsignedTxPro,
} from '@onekeyhq/core/src/types';
import type {
  IAccountDeriveInfo,
  IAccountDeriveTypes,
  ITransferInfo,
  ITransferPayload,
} from '@onekeyhq/kit-bg/src/vaults/types';
import type { IDappSourceInfo } from '@onekeyhq/shared/types';

import type { ITokenSelectorParamList } from './assetSelector';
import type { INetworkAccount } from '../../types/account';
import type { EDeriveAddressActionType } from '../../types/address';
import type { IAccountHistoryTx } from '../../types/history';
import type {
  ILNURLAuthServiceResponse,
  ILNURLPayServiceResponse,
  ILNURLWithdrawServiceResponse,
} from '../../types/lightning';
import type { IAccountNFT } from '../../types/nft';
import type { ISwapTxInfo } from '../../types/swap/types';
import type { IToken, ITokenFiat } from '../../types/token';
import type { EReplaceTxType, ISendTxOnSuccessData } from '../../types/tx';

export enum EModalSignatureConfirmRoutes {
  TxDataInput = 'TxDataInput',
  TxConfirm = 'TxConfirm',
  MessageConfirm = 'MessageConfirm',
  TxConfirmFromDApp = 'TxConfirmFromDApp',
  MessageConfirmFromDApp = 'MessageConfirmFromDApp',
  TxConfirmFromSwap = 'TxConfirmFromSwap',

  TxReplace = 'TxReplace',
  TxSelectToken = 'TxSelectToken',
  TxSelectDeriveAddress = 'TxSelectDeriveAddress',

  // Lightning Network
  LnurlPayRequest = 'LnurlPayRequest',
  LnurlWithdraw = 'LnurlWithdraw',
  LnurlAuth = 'LnurlAuth',
  WeblnSendPayment = 'WeblnSendPayment',
}

export type IModalSignatureConfirmParamList = {
  [EModalSignatureConfirmRoutes.TxSelectToken]: ITokenSelectorParamList;
  [EModalSignatureConfirmRoutes.TxDataInput]: {
    networkId: string;
    accountId: string;
    activeAccountId?: string;
    activeNetworkId?: string;
    isNFT: boolean;
    nfts?: IAccountNFT[];
    token?: IToken | null;
    address?: string;
    amount?: string;
    onSuccess?: (txs: ISendTxOnSuccessData[]) => void;
    onFail?: (error: Error) => void;
    onCancel?: () => void;
    isAllNetworks?: boolean;
  };
  [EModalSignatureConfirmRoutes.TxConfirm]: {
    networkId: string;
    accountId: string;
    unsignedTxs: IUnsignedTxPro[];
    sourceInfo?: IDappSourceInfo;
    signOnly?: boolean;
    useFeeInTx?: boolean;
    feeInfoEditable?: boolean;
    onSuccess?: (txs: ISendTxOnSuccessData[]) => void;
    onFail?: (error: Error) => void;
    onCancel?: () => void;
    transferPayload?: ITransferPayload;
    popStack?: boolean;
  };
  [EModalSignatureConfirmRoutes.MessageConfirm]: {
    accountId: string;
    networkId: string;
    unsignedMessage: IUnsignedMessage;
    walletInternalSign?: boolean;
    skipBackupCheck?: boolean; // used for bind referral code
    sourceInfo?: IDappSourceInfo;
    swapInfo?: ISwapTxInfo | undefined;
    onSuccess?: (result: string) => void;
    onFail?: (error: Error) => void;
    onCancel?: () => void;
  };
  [EModalSignatureConfirmRoutes.TxConfirmFromDApp]: undefined;
  [EModalSignatureConfirmRoutes.MessageConfirmFromDApp]: undefined;
  [EModalSignatureConfirmRoutes.TxConfirmFromSwap]: {
    networkId: string;
    accountId: string;
    unsignedTxs: IUnsignedTxPro[];
    sourceInfo?: IDappSourceInfo;
    signOnly?: boolean;
    useFeeInTx?: boolean;
    feeInfoEditable?: boolean;
    onSuccess?: (txs: ISendTxOnSuccessData[]) => void;
    onFail?: (error: Error) => void;
    onCancel?: () => void;
    transferPayload?: ITransferPayload;
  };
  [EModalSignatureConfirmRoutes.TxReplace]: {
    networkId: string;
    accountId: string;
    replaceType: EReplaceTxType;
    replaceEncodedTx: IEncodedTx;
    historyTx: IAccountHistoryTx;
    onSuccess?: (data: ISendTxOnSuccessData[]) => void;
  };

  // Lightning Network
  [EModalSignatureConfirmRoutes.LnurlPayRequest]: {
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
  [EModalSignatureConfirmRoutes.LnurlWithdraw]: {
    networkId: string;
    accountId: string;
    lnurlDetails: ILNURLWithdrawServiceResponse;
    sourceInfo?: IDappSourceInfo;
    isSendFlow?: boolean;
  };
  [EModalSignatureConfirmRoutes.LnurlAuth]: {
    networkId: string;
    accountId: string;
    lnurlDetails: ILNURLAuthServiceResponse;
    isSendFlow: boolean;
  };
  [EModalSignatureConfirmRoutes.WeblnSendPayment]: undefined;
  [EModalSignatureConfirmRoutes.TxSelectDeriveAddress]: {
    networkId: string;
    indexedAccountId: string;
    walletId: string;
    actionType?: EDeriveAddressActionType;
    onSelected?: ({
      account,
      deriveInfo,
      deriveType,
    }: {
      account: INetworkAccount;
      deriveInfo: IAccountDeriveInfo;
      deriveType: IAccountDeriveTypes;
    }) => void;
    onUnmounted?: () => void;
    tokenMap?: Record<string, ITokenFiat>;
    token?: IToken;
  };
};

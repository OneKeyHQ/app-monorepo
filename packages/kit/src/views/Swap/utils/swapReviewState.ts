import type { IEncodedTx } from '@onekeyhq/core/src/types';
import type { IApproveInfo } from '@onekeyhq/kit-bg/src/vaults/types';
import type {
  ESwapNetworkFeeLevel,
  IFetchQuoteResult,
  ISwapApproveTransaction,
  ISwapGasInfo,
  ISwapPreSwapData,
  ISwapStep,
} from '@onekeyhq/shared/types/swap/types';

export type ISwapReviewGasInfoEntry = {
  encodeTx: IEncodedTx;
  gasInfo: ISwapGasInfo;
};

export type ISwapReviewState = {
  steps: ISwapStep[];
  preSwapData: ISwapPreSwapData;
  quoteResult?: IFetchQuoteResult;
};

export type ISwapReviewBroadcastResult = {
  txHash?: string;
  orderId?: string;
  gasFeeFiatValue?: string;
  gasFeeInNative?: string;
};

export type ISwapReviewCustomPriorityFee = {
  customValue: string;
};

export type ISwapReviewApproveBroadcastResult = {
  txHash: string;
  amount: string;
};

export type ISwapReviewAdapter = {
  prepareReview: (params?: {
    fromAmount?: string;
    fromToken?: IFetchQuoteResult['fromTokenInfo'];
    toToken?: IFetchQuoteResult['toTokenInfo'];
    isWrap?: boolean;
    quoteResult?: IFetchQuoteResult;
    networkFeeLevel?: ESwapNetworkFeeLevel;
    customPriorityFee?: ISwapReviewCustomPriorityFee;
  }) => Promise<ISwapReviewState>;
  sendApproveTx: (params: {
    amount: string;
    gasInfos?: ISwapReviewGasInfoEntry[];
    isResetApprove?: boolean;
    networkFeeLevel?: ESwapNetworkFeeLevel;
    customPriorityFee?: ISwapReviewCustomPriorityFee;
    quoteResult: IFetchQuoteResult;
    onBroadcast?: (result: ISwapReviewApproveBroadcastResult) => void;
    onCancel?: () => void;
  }) => Promise<void>;
  sendSwapTx: (params?: {
    approvesInfo?: IApproveInfo[];
    gasInfos?: ISwapReviewGasInfoEntry[];
    networkFeeLevel?: ESwapNetworkFeeLevel;
    customPriorityFee?: ISwapReviewCustomPriorityFee;
    onBroadcast?: (result: ISwapReviewBroadcastResult) => void;
    onCancel?: () => void;
  }) => Promise<void>;
  sendWrappedTx: (params?: {
    gasInfos?: ISwapReviewGasInfoEntry[];
    networkFeeLevel?: ESwapNetworkFeeLevel;
    customPriorityFee?: ISwapReviewCustomPriorityFee;
    onBroadcast?: (result: ISwapReviewBroadcastResult) => void;
    onCancel?: () => void;
  }) => Promise<void>;
  sendSignMessage: (params?: {
    networkFeeLevel?: ESwapNetworkFeeLevel;
    customPriorityFee?: ISwapReviewCustomPriorityFee;
    onBroadcast?: (result: ISwapReviewBroadcastResult) => void;
    onCancel?: () => void;
  }) => Promise<void>;
  buildApproveInfos: (quoteResult?: IFetchQuoteResult) => IApproveInfo[];
};

export enum ESwapReviewApproveTransactionSource {
  None = 'none',
  Swap = 'swap',
  SpeedSwap = 'speedSwap',
}

export function getSwapReviewApproveTransaction({
  source,
  inAppNotificationAtom,
}: {
  source: ESwapReviewApproveTransactionSource;
  inAppNotificationAtom: {
    swapApprovingTransaction?: ISwapApproveTransaction;
    speedSwapApprovingTransaction?: ISwapApproveTransaction;
  };
}) {
  if (source === ESwapReviewApproveTransactionSource.SpeedSwap) {
    return inAppNotificationAtom.speedSwapApprovingTransaction;
  }

  if (source === ESwapReviewApproveTransactionSource.Swap) {
    return inAppNotificationAtom.swapApprovingTransaction;
  }

  return undefined;
}

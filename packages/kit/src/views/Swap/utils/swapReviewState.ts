import type { IEncodedTx } from '@onekeyhq/core/src/types';
import type { IApproveInfo } from '@onekeyhq/kit-bg/src/vaults/types';
import type {
  ESwapNetworkFeeLevel,
  ESwapQuoteKind,
  ESwapTabSwitchType,
  IFetchQuoteResult,
  ISwapApproveTransaction,
  ISwapGasInfo,
  ISwapPreSwapData,
  ISwapStep,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';

export type ISwapReviewGasInfoEntry = {
  encodeTx: IEncodedTx;
  gasInfo: ISwapGasInfo;
};

export type ISwapReviewState = {
  steps: ISwapStep[];
  preSwapData: ISwapPreSwapData;
  quoteResult?: IFetchQuoteResult;
  provenance?: ISwapReviewProvenance;
  executionSnapshot?: ISwapExecutionSnapshot;
};

export type ISwapReviewProvenance = Readonly<{
  executionFingerprint: string;
  quoteRequestId?: string;
  quoteIntentRevision?: number;
  quoteCommittedAt?: number;
}>;

export enum ESwapExecutionRecipientMode {
  Self = 'self',
  Account = 'account',
  Custom = 'custom',
}

export type ISwapExecutionLimitSettings = Readonly<{
  expirationTime: string;
  rate?: string;
  priceFromAmount: string;
  priceToAmount: string;
  partiallyFillable: boolean;
}>;

/**
 * Immutable execution inputs captured when the user opens Review. The build,
 * estimate, sign, and send pipeline must use this snapshot instead of mutable
 * Swap page atoms. It is optional only for legacy review adapters.
 */
export type ISwapExecutionSnapshot = Readonly<{
  reviewRevision: string;
  accountId: string;
  indexedAccountId?: string;
  dbAccountId?: string;
  networkId: string;
  senderAddress: string;
  receivingAccountId?: string;
  receivingAddress: string;
  recipientMode: ESwapExecutionRecipientMode;
  walletId?: string;
  walletType?: string;
  deriveType?: string;
  addressEncoding?: string;
  swapType: ESwapTabSwitchType;
  kind: ESwapQuoteKind;
  fromToken: ISwapToken;
  toToken: ISwapToken;
  fromTokenAmount: string;
  toTokenAmount: string;
  provider: string;
  slippage: number;
  quoteResult: IFetchQuoteResult;
  limitSettings: ISwapExecutionLimitSettings;
  provenance: ISwapReviewProvenance;
}>;

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

import { sha256 as sha256ByNoble } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';
import { cloneDeep } from 'lodash';

import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { stableStringify } from '@onekeyhq/shared/src/utils/stringUtils';
import type { ICurrencyItem } from '@onekeyhq/shared/types';
import type {
  ESwapTabSwitchType,
  IFetchQuoteResult,
  ISwapPreSwapData,
  ISwapStep,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';
import {
  EProtocolOfExchange,
  ESwapBatchTransferType,
  ESwapQuoteKind,
  ESwapStepStatus,
  ESwapStepType,
  SwapBuildUseMultiplePopoversNetworkIds,
} from '@onekeyhq/shared/types/swap/types';

import { buildSwapRateDifference } from './swapRateDifferenceUtils';

import type {
  ESwapExecutionRecipientMode,
  ISwapExecutionLimitSettings,
  ISwapExecutionSnapshot,
  ISwapReviewProvenance,
  ISwapReviewState,
} from './swapReviewState';

export type ISwapReviewStepTexts = {
  wrap: string;
  approveAndSwap: string;
  approveAndSign: string;
  revokeApprove: string;
  approveToken: string;
  approveTokenWithTarget: string;
  signAndSubmit: string;
  sign: string;
  confirmSwap: string;
  swap: string;
};

export type IBuildSwapBatchTransferTypeParams = {
  networkId?: string;
  accountId?: string;
  providerDisableBatchTransfer?: boolean;
  swapShouldSignedData?: boolean;
  needApprove?: boolean;
  batchApproveAndSwapEnabled?: boolean;
};

export function buildSwapBatchTransferType({
  networkId,
  accountId,
  providerDisableBatchTransfer,
  swapShouldSignedData,
  needApprove,
  batchApproveAndSwapEnabled,
}: IBuildSwapBatchTransferTypeParams): ESwapBatchTransferType {
  let type = ESwapBatchTransferType.NORMAL;

  if (batchApproveAndSwapEnabled && needApprove) {
    type = ESwapBatchTransferType.BATCH_APPROVE_AND_SWAP;
  }

  const isExternalAccount = accountUtils.isExternalAccount({
    accountId: accountId ?? '',
  });
  const isHDAccount = accountUtils.isHwOrQrAccount({
    accountId: accountId ?? '',
  });

  if ((isExternalAccount || isHDAccount) && needApprove) {
    type = ESwapBatchTransferType.CONTINUOUS_APPROVE_AND_SWAP;
  }

  const isUnsupportedBatchTransferNetwork =
    SwapBuildUseMultiplePopoversNetworkIds.includes(networkId ?? '');

  if (
    providerDisableBatchTransfer ||
    isUnsupportedBatchTransferNetwork ||
    !batchApproveAndSwapEnabled ||
    swapShouldSignedData
  ) {
    type = ESwapBatchTransferType.NORMAL;
  }

  return type;
}

function buildShouldSignEveryTime({
  accountId,
  needApprove,
}: {
  accountId?: string;
  needApprove?: boolean;
}) {
  const isExternalAccount = accountUtils.isExternalAccount({
    accountId: accountId ?? '',
  });
  const isHDAccount = accountUtils.isHwOrQrAccount({
    accountId: accountId ?? '',
  });

  return (isExternalAccount || isHDAccount) && Boolean(needApprove);
}

function createWrapStep(texts: ISwapReviewStepTexts): ISwapStep {
  return {
    type: ESwapStepType.WRAP_TX,
    status: ESwapStepStatus.READY,
    stepTitle: texts.wrap,
    stepActionsLabel: texts.wrap,
  };
}

function createApproveStep({
  isResetApprove,
  stepActionsLabel,
  stepTitle,
}: {
  isResetApprove: boolean;
  stepActionsLabel: string;
  stepTitle: string;
}): ISwapStep {
  return {
    type: ESwapStepType.APPROVE_TX,
    status: ESwapStepStatus.READY,
    isResetApprove,
    canRetry: true,
    stepActionsLabel,
    stepTitle,
    shouldWaitApproved: true,
  };
}

function createSignStep(texts: ISwapReviewStepTexts): ISwapStep {
  return {
    type: ESwapStepType.SIGN_MESSAGE,
    status: ESwapStepStatus.READY,
    stepTitle: texts.signAndSubmit,
    stepActionsLabel: texts.sign,
  };
}

function createBatchApproveSwapStep({
  texts,
  batchTransferType,
  shouldResetApprove,
}: {
  texts: ISwapReviewStepTexts;
  batchTransferType: ESwapBatchTransferType;
  shouldResetApprove?: boolean;
}): ISwapStep {
  return {
    type: ESwapStepType.BATCH_APPROVE_SWAP,
    status: ESwapStepStatus.READY,
    stepTitle:
      batchTransferType === ESwapBatchTransferType.CONTINUOUS_APPROVE_AND_SWAP
        ? `${texts.approveAndSwap} [ 0 / ${shouldResetApprove ? 3 : 2} ]`
        : texts.approveAndSwap,
    stepActionsLabel: texts.approveAndSwap,
  };
}

function createSendTxStep(
  texts: Pick<ISwapReviewStepTexts, 'confirmSwap' | 'swap'>,
): ISwapStep {
  return {
    type: ESwapStepType.SEND_TX,
    status: ESwapStepStatus.READY,
    stepTitle: texts.confirmSwap,
    stepActionsLabel: texts.swap,
  };
}

export function buildSwapApproveAndSendSteps({
  quoteResult,
  texts,
}: {
  quoteResult?: IFetchQuoteResult;
  texts: Pick<
    ISwapReviewStepTexts,
    | 'approveAndSwap'
    | 'revokeApprove'
    | 'approveTokenWithTarget'
    | 'confirmSwap'
    | 'swap'
  >;
}): ISwapStep[] {
  let steps: ISwapStep[] = [];

  if (quoteResult?.allowanceResult) {
    if (quoteResult.allowanceResult.shouldResetApprove) {
      steps = [
        createApproveStep({
          isResetApprove: true,
          stepActionsLabel: texts.approveAndSwap,
          stepTitle: texts.revokeApprove,
        }),
      ];
    }

    steps = [
      ...steps,
      createApproveStep({
        isResetApprove: false,
        stepActionsLabel: texts.approveAndSwap,
        stepTitle: texts.approveTokenWithTarget,
      }),
    ];
  }

  return [...steps, createSendTxStep(texts)];
}

export type IBuildSwapReviewStateInput = {
  accountId?: string;
  networkId?: string;
  batchApproveAndSwapEnabled?: boolean;
  fromToken?: ISwapToken;
  toToken?: ISwapToken;
  fromTokenAmount?: string;
  toTokenAmount?: string;
  quoteResult?: IFetchQuoteResult;
  swapType: ESwapTabSwitchType;
  shouldFallback?: boolean;
  supportPreBuild: boolean;
  slippage?: number;
  rateDifference?: ISwapPreSwapData['rateDifference'];
  defaultTokenCurrency?: string;
  currencyMap?: Record<string, ICurrencyItem>;
  quoteRequestId?: string;
  quoteIntentRevision?: number;
  quoteCommittedAt?: number;
  executionContext?: IBuildSwapExecutionContext;
  texts: ISwapReviewStepTexts;
};

export type IBuildSwapExecutionContext = {
  reviewRevision: string;
  senderAddress?: string;
  receivingAddress?: string;
  receivingAccountId?: string;
  recipientMode: ESwapExecutionRecipientMode;
  indexedAccountId?: string;
  dbAccountId?: string;
  walletId?: string;
  walletType?: string;
  deriveType?: string;
  addressEncoding?: string;
  limitSettings: ISwapExecutionLimitSettings;
};

function buildSwapReviewTokenIdentity(
  token:
    | Pick<ISwapToken, 'networkId' | 'contractAddress' | 'isNative'>
    | undefined,
) {
  if (!token) {
    return undefined;
  }

  return {
    networkId: token.networkId,
    contractAddress: token.contractAddress,
    isNative: Boolean(token.isNative),
  };
}

function encodeUtf8(value: string) {
  const encoded = encodeURIComponent(value);
  const bytes: number[] = [];
  for (let index = 0; index < encoded.length; index += 1) {
    if (encoded[index] === '%') {
      bytes.push(Number.parseInt(encoded.slice(index + 1, index + 3), 16));
      index += 2;
    } else {
      bytes.push(encoded.charCodeAt(index));
    }
  }
  return Uint8Array.from(bytes);
}

function deepFreezeSnapshotValue<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (ArrayBuffer.isView(value) || seen.has(value)) {
    return value;
  }

  seen.add(value);
  Object.values(value).forEach((child) => {
    deepFreezeSnapshotValue(child, seen);
  });
  return Object.freeze(value);
}

export function buildSwapReviewExecutionFingerprint({
  accountId,
  networkId,
  batchApproveAndSwapEnabled,
  fromToken,
  toToken,
  fromTokenAmount,
  toTokenAmount,
  quoteResult,
  swapType,
  shouldFallback,
  supportPreBuild,
  slippage,
  executionContext,
}: Omit<
  IBuildSwapReviewStateInput,
  | 'texts'
  | 'rateDifference'
  | 'defaultTokenCurrency'
  | 'currencyMap'
  | 'quoteRequestId'
  | 'quoteIntentRevision'
  | 'quoteCommittedAt'
>) {
  const serialized = stableStringify({
    accountId,
    networkId,
    swapType,
    fromToken: buildSwapReviewTokenIdentity(
      fromToken ?? quoteResult?.fromTokenInfo,
    ),
    toToken: buildSwapReviewTokenIdentity(toToken ?? quoteResult?.toTokenInfo),
    inputFromAmount: fromTokenAmount,
    inputToAmount: toTokenAmount,
    quote: quoteResult
      ? {
          quoteId: quoteResult.quoteId,
          eventId: quoteResult.eventId,
          protocol: quoteResult.protocol,
          kind: quoteResult.kind,
          provider: quoteResult.info.provider,
          providerName: quoteResult.info.providerName,
          fromAmount: quoteResult.fromAmount,
          toAmount: quoteResult.toAmount,
          minToAmount: quoteResult.minToAmount,
          expirationTime: quoteResult.expirationTime,
          isWrapped: Boolean(quoteResult.isWrapped),
          allowanceTarget: quoteResult.allowanceResult?.allowanceTarget,
          allowanceAmount: quoteResult.allowanceResult?.amount,
          shouldResetApprove: quoteResult.allowanceResult?.shouldResetApprove,
          shouldSign: Boolean(quoteResult.swapShouldSignedData),
          providerDisableBatchTransfer:
            quoteResult.providerDisableBatchTransfer,
        }
      : undefined,
    slippage,
    shouldFallback: Boolean(shouldFallback),
    supportPreBuild,
    batchApproveAndSwapEnabled: Boolean(batchApproveAndSwapEnabled),
    executionIdentity: executionContext
      ? {
          senderAddress: executionContext.senderAddress,
          receivingAddress: executionContext.receivingAddress,
          receivingAccountId: executionContext.receivingAccountId,
          recipientMode: executionContext.recipientMode,
          indexedAccountId: executionContext.indexedAccountId,
          dbAccountId: executionContext.dbAccountId,
          walletId: executionContext.walletId,
          walletType: executionContext.walletType,
          deriveType: executionContext.deriveType,
          addressEncoding: executionContext.addressEncoding,
          limitSettings: executionContext.limitSettings,
        }
      : undefined,
  });

  return bytesToHex(sha256ByNoble(encodeUtf8(serialized)));
}

export function buildSwapExecutionSnapshot({
  accountId,
  networkId,
  fromToken,
  toToken,
  fromTokenAmount,
  toTokenAmount,
  quoteResult,
  swapType,
  slippage,
  executionContext,
  provenance,
}: Pick<
  IBuildSwapReviewStateInput,
  | 'accountId'
  | 'networkId'
  | 'fromToken'
  | 'toToken'
  | 'fromTokenAmount'
  | 'toTokenAmount'
  | 'quoteResult'
  | 'swapType'
  | 'slippage'
  | 'executionContext'
> & {
  provenance: ISwapReviewProvenance;
}): ISwapExecutionSnapshot | undefined {
  const snapshotFromToken = fromToken ?? quoteResult?.fromTokenInfo;
  const snapshotToToken = toToken ?? quoteResult?.toTokenInfo;
  const snapshotFromAmount = quoteResult?.fromAmount ?? fromTokenAmount;
  const snapshotToAmount = quoteResult?.toAmount ?? toTokenAmount;

  if (
    !executionContext ||
    !accountId ||
    !networkId ||
    !executionContext.senderAddress ||
    !executionContext.receivingAddress ||
    !snapshotFromToken ||
    !snapshotToToken ||
    !snapshotFromAmount ||
    !snapshotToAmount ||
    !quoteResult ||
    slippage === undefined
  ) {
    return undefined;
  }

  const snapshot: ISwapExecutionSnapshot = {
    reviewRevision: executionContext.reviewRevision,
    accountId,
    indexedAccountId: executionContext.indexedAccountId,
    dbAccountId: executionContext.dbAccountId,
    networkId,
    senderAddress: executionContext.senderAddress,
    receivingAccountId: executionContext.receivingAccountId,
    receivingAddress: executionContext.receivingAddress,
    recipientMode: executionContext.recipientMode,
    walletId: executionContext.walletId,
    walletType: executionContext.walletType,
    deriveType: executionContext.deriveType,
    addressEncoding: executionContext.addressEncoding,
    swapType,
    kind: quoteResult.kind ?? ESwapQuoteKind.SELL,
    fromToken: cloneDeep(snapshotFromToken),
    toToken: cloneDeep(snapshotToToken),
    fromTokenAmount: snapshotFromAmount,
    toTokenAmount: snapshotToAmount,
    provider: quoteResult.info.provider,
    slippage:
      quoteResult.protocol === EProtocolOfExchange.STOCK
        ? (quoteResult.slippage ?? slippage)
        : slippage,
    quoteResult: cloneDeep(quoteResult),
    limitSettings: { ...executionContext.limitSettings },
    provenance,
  };
  return deepFreezeSnapshotValue(snapshot);
}

export function buildSwapReviewState({
  accountId,
  networkId,
  batchApproveAndSwapEnabled,
  fromToken,
  toToken,
  fromTokenAmount,
  toTokenAmount,
  quoteResult,
  swapType,
  shouldFallback,
  supportPreBuild,
  slippage,
  rateDifference,
  defaultTokenCurrency,
  currencyMap,
  quoteRequestId,
  quoteIntentRevision,
  quoteCommittedAt,
  executionContext,
  texts,
}: IBuildSwapReviewStateInput): ISwapReviewState & {
  batchTransferType: ESwapBatchTransferType;
  provenance: ISwapReviewProvenance;
} {
  const needApprove = Boolean(quoteResult?.allowanceResult);
  const batchTransferType = buildSwapBatchTransferType({
    networkId,
    accountId,
    providerDisableBatchTransfer: quoteResult?.providerDisableBatchTransfer,
    swapShouldSignedData: Boolean(quoteResult?.swapShouldSignedData),
    needApprove,
    batchApproveAndSwapEnabled,
  });
  const shouldSignEveryTime = buildShouldSignEveryTime({
    accountId,
    needApprove,
  });
  const needFetchGas =
    needApprove &&
    !(
      batchTransferType === ESwapBatchTransferType.BATCH_APPROVE_AND_SWAP ||
      batchTransferType === ESwapBatchTransferType.CONTINUOUS_APPROVE_AND_SWAP
    );
  const reviewRateDifference =
    rateDifference ??
    buildSwapRateDifference({
      fromTokenPrice: fromToken?.price,
      toTokenPrice: toToken?.price,
      fromTokenCurrency: fromToken?.currency,
      toTokenCurrency: toToken?.currency,
      defaultTokenCurrency,
      currencyMap,
      instantRate: quoteResult?.instantRate,
    });

  let steps: ISwapStep[] = [];

  if (quoteResult?.isWrapped) {
    steps = [createWrapStep(texts)];
  } else if (quoteResult?.swapShouldSignedData) {
    if (quoteResult.allowanceResult) {
      if (quoteResult.allowanceResult.shouldResetApprove) {
        steps = [
          createApproveStep({
            isResetApprove: true,
            stepActionsLabel: texts.approveAndSign,
            stepTitle: texts.revokeApprove,
          }),
        ];
      }

      steps = [
        ...steps,
        createApproveStep({
          isResetApprove: false,
          stepActionsLabel: texts.approveAndSign,
          stepTitle: texts.approveToken,
        }),
      ];
    }

    steps = [...steps, createSignStep(texts)];
  } else if (
    (batchTransferType === ESwapBatchTransferType.BATCH_APPROVE_AND_SWAP ||
      batchTransferType ===
        ESwapBatchTransferType.CONTINUOUS_APPROVE_AND_SWAP) &&
    quoteResult?.allowanceResult
  ) {
    steps = [
      createBatchApproveSwapStep({
        texts,
        batchTransferType,
        shouldResetApprove: quoteResult.allowanceResult.shouldResetApprove,
      }),
    ];
  } else {
    steps = buildSwapApproveAndSendSteps({
      quoteResult,
      texts,
    });
  }

  const shouldHideSlippage =
    quoteResult?.protocol === EProtocolOfExchange.LIMIT ||
    quoteResult?.protocol === EProtocolOfExchange.STOCK ||
    quoteResult?.unSupportSlippage;
  const hasNetworkFeeStep = steps.some(
    (step) => step.type !== ESwapStepType.SIGN_MESSAGE,
  );

  const preSwapData: ISwapPreSwapData = {
    swapType,
    fromToken,
    toToken,
    shouldFallback,
    fromTokenAmount,
    toTokenAmount,
    providerInfo: quoteResult?.info,
    supportPreBuild,
    needFetchGas,
    minToAmount: quoteResult?.minToAmount,
    slippage: shouldHideSlippage ? undefined : slippage,
    rateDifference:
      quoteResult?.protocol === EProtocolOfExchange.LIMIT
        ? undefined
        : reviewRateDifference,
    unSupportSlippage: Boolean(
      quoteResult?.unSupportSlippage ||
      quoteResult?.protocol === EProtocolOfExchange.STOCK,
    ),
    isHWAndExBatchTransfer: shouldSignEveryTime,
    fee: quoteResult?.fee,
    allowanceResult: quoteResult?.allowanceResult,
    ...(steps.length > 0 && hasNetworkFeeStep
      ? {
          supportNetworkFeeLevel: true,
        }
      : {}),
  };
  const provenance = Object.freeze({
    executionFingerprint: buildSwapReviewExecutionFingerprint({
      accountId,
      networkId,
      batchApproveAndSwapEnabled,
      fromToken,
      toToken,
      fromTokenAmount,
      toTokenAmount,
      quoteResult,
      swapType,
      shouldFallback,
      supportPreBuild,
      slippage,
      executionContext,
    }),
    quoteRequestId,
    quoteIntentRevision,
    quoteCommittedAt,
  });
  const executionSnapshot = buildSwapExecutionSnapshot({
    accountId,
    networkId,
    fromToken,
    toToken,
    fromTokenAmount,
    toTokenAmount,
    quoteResult,
    swapType,
    slippage,
    executionContext,
    provenance,
  });

  return {
    batchTransferType,
    steps,
    preSwapData,
    quoteResult,
    provenance,
    executionSnapshot,
  };
}

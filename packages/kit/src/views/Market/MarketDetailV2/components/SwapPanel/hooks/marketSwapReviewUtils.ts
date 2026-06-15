import BigNumber from 'bignumber.js';

import { getSwapExecutionTypeFromQuoteResult } from '@onekeyhq/kit/src/views/Swap/utils/swapTypeUtils';
import type { IApproveInfo } from '@onekeyhq/kit-bg/src/vaults/types';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type {
  IFetchQuoteResult,
  ISwapApproveTransaction,
  ISwapTokenBase,
} from '@onekeyhq/shared/types/swap/types';
import {
  EProtocolOfExchange,
  ESwapApproveTransactionStatus,
  ESwapQuoteKind,
} from '@onekeyhq/shared/types/swap/types';
import type { ISendTxOnSuccessData } from '@onekeyhq/shared/types/tx';

const WRAPPED_PROVIDER_NAME = 'Wrap Contract';
const WRAPPED_INSTANT_RATE = '1';

export function assertMarketReviewQuoteResult(
  quoteResult?: IFetchQuoteResult,
): IFetchQuoteResult {
  if (!quoteResult?.info?.providerName) {
    throw new OneKeyLocalError('Market swap review requires providerName.');
  }
  if (!quoteResult?.fromAmount) {
    throw new OneKeyLocalError('Market swap review requires fromAmount.');
  }
  if (!quoteResult?.toAmount) {
    throw new OneKeyLocalError('Market swap review requires toAmount.');
  }
  return quoteResult;
}

export function areMarketApproveAmountsEqual(value1?: string, value2?: string) {
  if (!value1 || !value2) {
    return false;
  }

  const value1BN = new BigNumber(value1);
  const value2BN = new BigNumber(value2);

  if (value1BN.isNaN() || value2BN.isNaN()) {
    return value1 === value2;
  }

  return value1BN.eq(value2BN);
}

function areQuoteAmountsEqual(value1?: string, value2?: string) {
  if (!value1 && !value2) {
    return true;
  }

  if (!value1 || !value2) {
    return false;
  }

  const value1BN = new BigNumber(value1);
  const value2BN = new BigNumber(value2);

  if (value1BN.isNaN() || value2BN.isNaN()) {
    return value1 === value2;
  }

  return value1BN.eq(value2BN);
}

export function assertMarketSignedBuildInvariant({
  reviewedQuoteResult,
  rebuiltQuoteResult,
  skipSendTransAction,
}: {
  reviewedQuoteResult: IFetchQuoteResult;
  rebuiltQuoteResult: IFetchQuoteResult;
  skipSendTransAction: boolean;
}) {
  const reviewed = assertMarketReviewQuoteResult(reviewedQuoteResult);
  const rebuilt = assertMarketReviewQuoteResult(rebuiltQuoteResult);

  if (!skipSendTransAction) {
    throw new OneKeyLocalError(
      'Market sign review requires a signed order result.',
    );
  }

  if (
    reviewed.info.provider !== rebuilt.info.provider ||
    reviewed.info.providerName !== rebuilt.info.providerName
  ) {
    throw new OneKeyLocalError(
      'Market sign review provider changed after signing.',
    );
  }

  if (!areQuoteAmountsEqual(reviewed.fromAmount, rebuilt.fromAmount)) {
    throw new OneKeyLocalError(
      'Market sign review amount changed after signing.',
    );
  }

  if (!areQuoteAmountsEqual(reviewed.toAmount, rebuilt.toAmount)) {
    throw new OneKeyLocalError(
      'Market sign review expected receive changed after signing.',
    );
  }

  if (
    reviewed.minToAmount &&
    !areQuoteAmountsEqual(reviewed.minToAmount, rebuilt.minToAmount)
  ) {
    throw new OneKeyLocalError(
      'Market sign review min receive changed after signing.',
    );
  }

  return rebuilt;
}

export function assertMarketSignPreviewInvariant({
  reviewedQuoteResult,
  signingQuoteResult,
}: {
  reviewedQuoteResult: IFetchQuoteResult;
  signingQuoteResult: IFetchQuoteResult;
}) {
  const reviewed = assertMarketReviewQuoteResult(reviewedQuoteResult);
  const signing = assertMarketReviewQuoteResult(signingQuoteResult);

  if (
    reviewed.info.provider !== signing.info.provider ||
    reviewed.info.providerName !== signing.info.providerName
  ) {
    throw new OneKeyLocalError(
      'Market sign review provider changed before signing.',
    );
  }

  if (!areQuoteAmountsEqual(reviewed.fromAmount, signing.fromAmount)) {
    throw new OneKeyLocalError(
      'Market sign review amount changed before signing.',
    );
  }

  if (!areQuoteAmountsEqual(reviewed.toAmount, signing.toAmount)) {
    throw new OneKeyLocalError(
      'Market sign review expected receive changed before signing.',
    );
  }

  if (
    reviewed.minToAmount &&
    !areQuoteAmountsEqual(reviewed.minToAmount, signing.minToAmount)
  ) {
    throw new OneKeyLocalError(
      'Market sign review min receive changed before signing.',
    );
  }

  return signing;
}

export function normalizeMarketReviewQuoteResult({
  quoteResult,
  shouldApprove,
  shouldResetApprove,
  spenderAddress,
  amount,
}: {
  quoteResult: IFetchQuoteResult;
  shouldApprove?: boolean;
  shouldResetApprove?: boolean;
  spenderAddress?: string;
  amount: string;
}): IFetchQuoteResult {
  if (!shouldApprove || !spenderAddress) {
    return {
      ...quoteResult,
      allowanceResult: undefined,
    };
  }

  return {
    ...quoteResult,
    allowanceResult: {
      allowanceTarget: spenderAddress,
      amount: quoteResult.fromAmount ?? amount,
      ...(shouldResetApprove ? { shouldResetApprove: true } : undefined),
    },
  };
}

export function buildWrappedMarketQuoteResult({
  fromToken,
  toToken,
  amount,
  providerLogo,
}: {
  fromToken: ISwapTokenBase;
  toToken: ISwapTokenBase;
  amount: string;
  providerLogo?: string;
}): IFetchQuoteResult {
  return {
    protocol: EProtocolOfExchange.SWAP,
    info: {
      provider: 'wrapped',
      providerName: WRAPPED_PROVIDER_NAME,
      providerLogo,
    },
    fromTokenInfo: fromToken,
    toTokenInfo: toToken,
    fromAmount: amount,
    toAmount: amount,
    instantRate: WRAPPED_INSTANT_RATE,
    isWrapped: true,
    fee: {
      percentageFee: 0,
    },
  };
}

export function buildMarketApproveInfos({
  fromUserAddress,
  quoteResult,
}: {
  fromUserAddress?: string;
  quoteResult?: IFetchQuoteResult;
}): IApproveInfo[] {
  if (
    !fromUserAddress ||
    !quoteResult?.allowanceResult?.allowanceTarget ||
    !quoteResult.fromAmount
  ) {
    return [];
  }

  const tokenInfo = {
    ...quoteResult.fromTokenInfo,
    isNative: !!quoteResult.fromTokenInfo.isNative,
    address: quoteResult.fromTokenInfo.contractAddress,
    name: quoteResult.fromTokenInfo.name ?? quoteResult.fromTokenInfo.symbol,
  };

  const approveInfos: IApproveInfo[] = [];

  if (quoteResult.allowanceResult.shouldResetApprove) {
    approveInfos.push({
      owner: fromUserAddress,
      spender: quoteResult.allowanceResult.allowanceTarget,
      amount: '0',
      isMax: false,
      tokenInfo,
      swapApproveRes: undefined,
    });
  }

  approveInfos.push({
    owner: fromUserAddress,
    spender: quoteResult.allowanceResult.allowanceTarget,
    amount: quoteResult.fromAmount,
    isMax: true,
    tokenInfo,
    swapApproveRes: undefined,
  });

  return approveInfos;
}

export function attachMarketOneInchFusionSignature({
  quoteResult,
  signature,
}: {
  quoteResult: IFetchQuoteResult;
  signature: string;
}) {
  const oneInchFusionOrderCtx =
    quoteResult.quoteResultCtx?.oneInchFusionOrderCtx;

  if (!quoteResult.quoteResultCtx || !oneInchFusionOrderCtx) {
    throw new OneKeyLocalError('Market 1inch fusion context missing.');
  }

  return {
    ...quoteResult,
    quoteResultCtx: {
      ...quoteResult.quoteResultCtx,
      oneInchFusionOrderCtx: {
        ...oneInchFusionOrderCtx,
        signature,
      },
    },
  };
}

export function canReuseMarketSigningQuoteResult(
  quoteResult?: IFetchQuoteResult,
) {
  const signPayload = quoteResult?.swapShouldSignedData;

  if (!signPayload) {
    return false;
  }

  if (
    (signPayload.unSignedMessage || signPayload.unSignedData) &&
    quoteResult.quoteResultCtx?.cowSwapUnSignedOrder
  ) {
    return true;
  }

  if (
    signPayload.oneInchFusionOrder &&
    quoteResult.quoteResultCtx?.oneInchFusionOrderCtx
  ) {
    return true;
  }

  return false;
}

export function buildMarketSwapApprovingTransaction({
  quoteResult,
  amount,
  useAddress,
  spenderAddress,
  isResetApprove,
}: {
  quoteResult: IFetchQuoteResult;
  amount: string;
  useAddress: string;
  spenderAddress: string;
  isResetApprove?: boolean;
}): ISwapApproveTransaction {
  return {
    swapType: getSwapExecutionTypeFromQuoteResult(quoteResult),
    protocol: quoteResult.protocol ?? EProtocolOfExchange.SWAP,
    provider: quoteResult.info.provider,
    providerName: quoteResult.info.providerName,
    unSupportReceiveAddressDifferent:
      quoteResult.unSupportReceiveAddressDifferent,
    fromToken: quoteResult.fromTokenInfo,
    toToken: quoteResult.toTokenInfo,
    quoteId: quoteResult.quoteId ?? '',
    amount,
    toAmount: quoteResult.toAmount ?? '',
    useAddress,
    spenderAddress,
    status: ESwapApproveTransactionStatus.PENDING,
    kind: quoteResult.kind ?? ESwapQuoteKind.SELL,
    resetApproveValue: !isResetApprove ? '0' : amount,
    resetApproveIsMax: !isResetApprove,
  };
}

export function extractMarketSwapSuccessResult(data: ISendTxOnSuccessData[]):
  | {
      txHash: string;
      gasFeeFiatValue?: string;
      gasFeeInNative?: string;
    }
  | undefined {
  const swapItem = data.toReversed().find((item) => item.signedTx.swapInfo);

  if (!swapItem) {
    return undefined;
  }

  return {
    txHash: swapItem.signedTx.txid,
    gasFeeFiatValue: swapItem.decodedTx.totalFeeFiatValue,
    gasFeeInNative: swapItem.decodedTx.totalFeeInNative,
  };
}

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
  ESwapTabSwitchType,
} from '@onekeyhq/shared/types/swap/types';
import type { ISendTxOnSuccessData } from '@onekeyhq/shared/types/tx';

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
      providerName: 'wrapped',
      providerLogo,
    },
    fromTokenInfo: fromToken,
    toTokenInfo: toToken,
    fromAmount: amount,
    toAmount: amount,
    isWrapped: true,
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
    swapType: ESwapTabSwitchType.SWAP,
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

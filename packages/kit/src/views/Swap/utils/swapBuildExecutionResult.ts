import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type {
  IFetchBuildTxResponse,
  IFetchQuoteResult,
  ISwapToken,
  ISwapTxInfo,
} from '@onekeyhq/shared/types/swap/types';
import { EProtocolOfExchange } from '@onekeyhq/shared/types/swap/types';

type ISwapSignedOrderBuildContext = {
  cowSwapOrderId?: string;
  oneInchFusionOrderHash?: string;
  changeHeroOrderId?: string;
};

function hasSwapTransactionPayload(buildSwapRes: IFetchBuildTxResponse) {
  return Boolean(
    buildSwapRes.swftOrder ||
    buildSwapRes.changellyOrder ||
    buildSwapRes.thorSwapCallData ||
    buildSwapRes.OKXTxObject ||
    buildSwapRes.LMTronObject ||
    buildSwapRes.tronTxData ||
    buildSwapRes.xrpTxData ||
    buildSwapRes.tx ||
    buildSwapRes.btcData ||
    buildSwapRes.suiBase64Data,
  );
}

/**
 * Mirrors the build-response branch order in useSwapBuiltTx. A signed order is
 * terminal only when the response does not contain a higher-priority on-chain
 * or transfer payload.
 */
export function isSwapSignedNoSendBuildResult(
  buildSwapRes: IFetchBuildTxResponse,
) {
  if (hasSwapTransactionPayload(buildSwapRes)) {
    return false;
  }

  const ctx = buildSwapRes.ctx as ISwapSignedOrderBuildContext | undefined;
  return Boolean(
    ctx?.cowSwapOrderId ||
    ctx?.oneInchFusionOrderHash ||
    buildSwapRes.result.swapShouldSignedData,
  );
}

/**
 * A stale build response may be persisted only when the server proves that a
 * signed off-chain order was created. `swapShouldSignedData` is merely an
 * unsigned signing prompt and must never create history by itself.
 */
export function isSwapTerminalSignedNoSendBuildResult(
  buildSwapRes: IFetchBuildTxResponse,
) {
  if (hasSwapTransactionPayload(buildSwapRes)) {
    return false;
  }
  const ctx = buildSwapRes.ctx as ISwapSignedOrderBuildContext | undefined;
  return Boolean(ctx?.cowSwapOrderId || ctx?.oneInchFusionOrderHash);
}

export function buildSwapExecutionResultFromBuildResponse({
  buildSwapRes,
  currentFromToken,
  currentToToken,
  fromAccountId,
  fromUserAddress,
  quoteResult,
  slippage,
  toAccountId,
  toUserAddress,
}: {
  buildSwapRes: IFetchBuildTxResponse;
  currentFromToken?: ISwapToken;
  currentToToken?: ISwapToken;
  fromAccountId: string;
  fromUserAddress: string;
  quoteResult: IFetchQuoteResult;
  slippage: number;
  toAccountId?: string;
  toUserAddress: string;
}): { orderId: string; swapInfo: ISwapTxInfo } {
  const ctx = buildSwapRes.ctx as ISwapSignedOrderBuildContext | undefined;
  const fromAmount = buildSwapRes.result.fromAmount ?? quoteResult.fromAmount;
  const toAmount = buildSwapRes.result.toAmount ?? quoteResult.toAmount;
  if (fromAmount === undefined || toAmount === undefined) {
    throw new OneKeyLocalError('Swap execution amounts are required');
  }
  const swapInfo: ISwapTxInfo = {
    protocol:
      buildSwapRes.result.protocol ??
      quoteResult.protocol ??
      EProtocolOfExchange.SWAP,
    sender: {
      amount: fromAmount,
      token: currentFromToken ?? buildSwapRes.result.fromTokenInfo,
      accountInfo: {
        accountId: fromAccountId,
        networkId: buildSwapRes.result.fromTokenInfo.networkId,
      },
    },
    receiver: {
      amount: toAmount,
      token: currentToToken ?? buildSwapRes.result.toTokenInfo,
      accountInfo: {
        accountId: toAccountId ?? '',
        networkId: buildSwapRes.result.toTokenInfo.networkId,
      },
    },
    accountAddress: fromUserAddress,
    receivingAddress: toUserAddress,
    swapBuildResData: {
      ...buildSwapRes,
      result: {
        ...buildSwapRes.result,
        slippage: buildSwapRes.result.slippage ?? slippage,
      },
    },
  };
  const orderId =
    ctx?.cowSwapOrderId ??
    ctx?.oneInchFusionOrderHash ??
    ctx?.changeHeroOrderId ??
    buildSwapRes.orderId ??
    buildSwapRes.result.quoteId ??
    '';

  return { orderId, swapInfo };
}

export async function settleSwapSignedNoSendResult({
  isRevisionCurrent,
  onCurrentRevision,
  persistHistory,
}: {
  isRevisionCurrent: boolean;
  onCurrentRevision: () => void;
  persistHistory: () => Promise<void>;
}) {
  if (isRevisionCurrent) {
    onCurrentRevision();
  }
  await persistHistory();
}

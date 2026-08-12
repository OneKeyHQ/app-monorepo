import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import type {
  IFetchBuildTxResponse,
  ISwapTxHistory,
} from '@onekeyhq/shared/types/swap/types';
import { EProtocolOfExchange } from '@onekeyhq/shared/types/swap/types';

// Roughly one full line in the history detail modal, matching the width of a
// wrapped 66-char tx hash line.
const SWAP_ORDER_ID_LEADING_LENGTH = 24;
const SWAP_ORDER_ID_TRAILING_LENGTH = 20;

type ISwapOrderCtx = {
  cowSwapOrderId?: string;
  oneInchFusionOrderHash?: string;
  changeHeroOrderId?: string;
};

export function getSwapBuildServiceOrderId(buildRes?: IFetchBuildTxResponse) {
  return buildRes?.orderId ?? buildRes?.result?.quoteId;
}

// The provider-facing order id that pairs with swapInfo.orderSupportUrl
// (e.g. the CoW order uid searchable on explorer.cow.fi). txInfo.orderId
// may hold the internal service order id instead (Stock orders track
// history identity by it), so prefer the provider ids kept in ctx.
export function getSwapHistoryProviderOrderId(item: ISwapTxHistory) {
  const ctx = item.ctx as ISwapOrderCtx | undefined;
  return (
    ctx?.cowSwapOrderId ??
    ctx?.oneInchFusionOrderHash ??
    ctx?.changeHeroOrderId ??
    item.txInfo.orderId
  );
}

// Abbreviate a provider order id to a single display line. minLength must
// cover leading+trailing: below that the two slices overlap and the id would
// render its middle characters twice (a 36-char uuid came out as 47 chars).
export function shortenSwapOrderId(orderId?: string) {
  return accountUtils.shortenAddress({
    address: orderId,
    leadingLength: SWAP_ORDER_ID_LEADING_LENGTH,
    trailingLength: SWAP_ORDER_ID_TRAILING_LENGTH,
    minLength: SWAP_ORDER_ID_LEADING_LENGTH + SWAP_ORDER_ID_TRAILING_LENGTH,
  });
}

export function buildSwapHistoryIdentity({
  buildRes,
  protocol,
  txId,
  includeServiceOrderIdWithoutTx,
}: {
  buildRes: IFetchBuildTxResponse;
  protocol?: EProtocolOfExchange;
  txId?: string;
  includeServiceOrderIdWithoutTx?: boolean;
}) {
  const ctx = buildRes.ctx as ISwapOrderCtx | undefined;
  const serviceOrderId = getSwapBuildServiceOrderId(buildRes);
  const shouldUseServiceOrderIdWithoutTx =
    includeServiceOrderIdWithoutTx || protocol === EProtocolOfExchange.STOCK;
  const orderId =
    buildRes.swftOrder?.orderId ??
    (txId
      ? (ctx?.cowSwapOrderId ??
        ctx?.oneInchFusionOrderHash ??
        ctx?.changeHeroOrderId)
      : ((shouldUseServiceOrderIdWithoutTx ? serviceOrderId : undefined) ??
        ctx?.cowSwapOrderId ??
        ctx?.oneInchFusionOrderHash ??
        ctx?.changeHeroOrderId));

  return {
    serviceOrderId,
    orderId,
    useOrderId: Boolean(
      (!txId && orderId) || ctx?.cowSwapOrderId || ctx?.oneInchFusionOrderHash,
    ),
  };
}

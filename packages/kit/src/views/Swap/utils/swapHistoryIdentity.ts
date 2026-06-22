import type { IFetchBuildTxResponse } from '@onekeyhq/shared/types/swap/types';
import { EProtocolOfExchange } from '@onekeyhq/shared/types/swap/types';

type ISwapOrderCtx = {
  cowSwapOrderId?: string;
  oneInchFusionOrderHash?: string;
  changeHeroOrderId?: string;
};

export function getSwapBuildServiceOrderId(buildRes?: IFetchBuildTxResponse) {
  return buildRes?.orderId ?? buildRes?.result?.quoteId;
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

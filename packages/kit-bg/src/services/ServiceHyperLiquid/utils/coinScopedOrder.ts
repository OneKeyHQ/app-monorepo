import type {
  IOrderOpenParams,
  IPlaceOrderByCoinParams,
} from '@onekeyhq/shared/types/hyperliquid/types';

export function buildCoinScopedOrderOpenParams({
  params,
  assetId,
}: {
  params: IPlaceOrderByCoinParams;
  assetId: number;
}): IOrderOpenParams {
  return {
    assetId,
    isBuy: params.isBuy,
    size: params.size,
    price: params.price,
    type: params.orderType,
    tif: params.orderType === 'limit' ? (params.tif ?? 'Gtc') : undefined,
    tpTriggerPx: params.tpTriggerPx,
    slTriggerPx: params.slTriggerPx,
    slippage: params.slippage,
    reduceOnly: false,
  };
}

export function getOrderOpenGrouping(orderCount: number) {
  return orderCount > 1 ? ('normalTpsl' as const) : ('na' as const);
}

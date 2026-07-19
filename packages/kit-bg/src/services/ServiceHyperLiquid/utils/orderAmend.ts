import type { IOrderParams } from '@onekeyhq/shared/types/hyperliquid/sdk';
import type { IModifyOrderParams } from '@onekeyhq/shared/types/hyperliquid/types';

export function buildHyperliquidModifyOrder(
  params: IModifyOrderParams,
): IOrderParams {
  return {
    a: params.assetId,
    b: params.isBuy,
    p: params.price,
    s: params.sz,
    r: params.reduceOnly ?? false,
    t: params.orderType,
    ...(params.cloid ? { c: params.cloid } : {}),
  };
}

export function buildHyperliquidBatchModifyRequest(params: {
  oid: number;
  order: IOrderParams;
}) {
  return {
    modifies: [params],
  };
}

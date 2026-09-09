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

export function buildHyperliquidModifyRequest(params: {
  oid: number;
  order: IOrderParams;
  alwaysPlace?: true;
}) {
  return {
    oid: params.oid,
    order: params.order,
    ...(params.alwaysPlace ? { a: true as const } : {}),
  };
}

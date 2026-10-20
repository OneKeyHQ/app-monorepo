import BigNumber from 'bignumber.js';

import { classifyTpSlOrder } from '@onekeyhq/shared/src/utils/perpsTpSlUtils';
import type { IPerpsFrontendOrder } from '@onekeyhq/shared/types/hyperliquid/sdk';

export interface ISimpleOrderSummaryData {
  coin: string;
  side: 'B' | 'A';
  reduceOnly?: boolean;
  orderType: string;
  size: string;
  price?: string;
}

export function isSimplePositionSizedOrder(
  order: Pick<IPerpsFrontendOrder, 'isPositionTpsl' | 'origSz' | 'sz'>,
) {
  return Boolean(
    order.isPositionTpsl &&
    new BigNumber(order.origSz).isZero() &&
    new BigNumber(order.sz).isZero(),
  );
}

export function getSimpleOrderSummary(
  order: IPerpsFrontendOrder,
): ISimpleOrderSummaryData {
  const trigger = classifyTpSlOrder(order);
  const orderType = trigger
    ? `${trigger.kind === 'tp' ? 'Take Profit' : 'Stop'} ${trigger.isMarket ? 'Market' : 'Limit'}`
    : order.orderType;
  return {
    coin: order.coin,
    side: order.side,
    reduceOnly: order.reduceOnly,
    orderType,
    size: isSimplePositionSizedOrder(order) ? '--' : order.sz,
    price: order.isTrigger ? order.triggerPx : order.limitPx,
  };
}

import { getTpSlKind } from '@onekeyhq/shared/src/utils/perpsTpSlUtils';
import {
  normalizePerpsAccountAddress,
  parseDexCoin,
} from '@onekeyhq/shared/src/utils/perpsUtils';
import type { IPerpsFrontendOrder } from '@onekeyhq/shared/types/hyperliquid/sdk';

export interface IPositionTpslOrders {
  tpOrder: IPerpsFrontendOrder | null;
  slOrder: IPerpsFrontendOrder | null;
}

export function getPositionTpslDex(coin: string) {
  return parseDexCoin(coin).dexLabel ?? '';
}

export function buildPositionTpslScopeKey({
  accountAddress,
  coin,
  positionSize,
  entryPrice,
  leverage,
}: {
  accountAddress?: string | null;
  coin: string;
  positionSize: string;
  entryPrice: string;
  leverage: number;
}) {
  const account = normalizePerpsAccountAddress(accountAddress);
  if (!account || !coin || !positionSize || !entryPrice) {
    return '';
  }
  return [
    account,
    getPositionTpslDex(coin),
    coin,
    positionSize,
    entryPrice,
    leverage,
  ].join('|');
}

export function getPositionTpslScopeChangeErrorTitle({
  initialScopeKey,
  currentScopeKey,
}: {
  initialScopeKey: string;
  currentScopeKey: string;
}) {
  if (initialScopeKey === currentScopeKey) {
    return undefined;
  }
  // TODO: Replace this temporary English copy after the i18n key is available.
  return 'Position changed. Please review and submit again.';
}

export function selectPositionTpslOrders(
  orders: IPerpsFrontendOrder[],
  coin: string,
): IPositionTpslOrders {
  let tpOrder: IPerpsFrontendOrder | null = null;
  let slOrder: IPerpsFrontendOrder | null = null;
  orders.forEach((order) => {
    if (order.coin !== coin || !order.isPositionTpsl) {
      return;
    }
    const kind = getTpSlKind(order);
    if (kind === 'tp' && !tpOrder) {
      tpOrder = order;
    } else if (kind === 'sl' && !slOrder) {
      slOrder = order;
    }
  });
  return { tpOrder, slOrder };
}

export function buildPositionTpslSubmission({
  orders,
  latestOrders = orders,
  tpTriggerPx,
  slTriggerPx,
}: {
  orders: IPositionTpslOrders;
  latestOrders?: IPositionTpslOrders;
  tpTriggerPx?: string;
  slTriggerPx?: string;
}) {
  const hasTpOrder = Boolean(orders.tpOrder || latestOrders.tpOrder);
  const hasSlOrder = Boolean(orders.slOrder || latestOrders.slOrder);
  return {
    tpTriggerPx: hasTpOrder ? undefined : tpTriggerPx?.trim() || undefined,
    slTriggerPx: hasSlOrder ? undefined : slTriggerPx?.trim() || undefined,
  };
}

export function hasPositionTpslSubmission(payload: {
  tpTriggerPx?: string;
  slTriggerPx?: string;
}) {
  return Boolean(payload.tpTriggerPx || payload.slTriggerPx);
}

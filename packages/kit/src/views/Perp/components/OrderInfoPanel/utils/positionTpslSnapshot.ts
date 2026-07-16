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

export type IPositionTpslSnapshotStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'error';

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

export function isPositionTpslSnapshotReady({
  status,
  snapshotScopeKey,
  currentScopeKey,
}: {
  status: IPositionTpslSnapshotStatus;
  snapshotScopeKey: string;
  currentScopeKey: string;
}) {
  return Boolean(
    currentScopeKey &&
    status === 'ready' &&
    snapshotScopeKey === currentScopeKey,
  );
}

export function shouldApplyPositionTpslSnapshotResponse({
  requestId,
  latestRequestId,
  responseScopeKey,
  currentScopeKey,
}: {
  requestId: number;
  latestRequestId: number;
  responseScopeKey: string;
  currentScopeKey: string;
}) {
  return Boolean(
    responseScopeKey &&
    requestId === latestRequestId &&
    responseScopeKey === currentScopeKey,
  );
}

export function buildPositionTpslSubmission({
  orders,
  tpTriggerPx,
  slTriggerPx,
}: {
  orders: IPositionTpslOrders;
  tpTriggerPx?: string;
  slTriggerPx?: string;
}) {
  return {
    tpTriggerPx: orders.tpOrder ? undefined : tpTriggerPx?.trim() || undefined,
    slTriggerPx: orders.slOrder ? undefined : slTriggerPx?.trim() || undefined,
  };
}

export function hasPositionTpslSubmission(payload: {
  tpTriggerPx?: string;
  slTriggerPx?: string;
}) {
  return Boolean(payload.tpTriggerPx || payload.slTriggerPx);
}

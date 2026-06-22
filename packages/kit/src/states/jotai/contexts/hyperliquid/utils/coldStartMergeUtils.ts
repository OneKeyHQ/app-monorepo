import type {
  IPerpsAssetPosition,
  IPerpsFrontendOrder,
} from '@onekeyhq/shared/types/hyperliquid/sdk';

import { normalizePerpsAccountAddress } from './accountSwitchCleanup';

export function filterCanceledOpenOrders<T extends IPerpsFrontendOrder>(
  openOrders: T[],
  canceledOrderIds: Set<number>,
) {
  if (canceledOrderIds.size === 0) {
    return openOrders;
  }
  return openOrders.filter((order) => !canceledOrderIds.has(order.oid));
}

export function shouldResetOpenOrdersForAccount({
  activeAccountAddress,
  currentOpenOrdersAccountAddress,
}: {
  activeAccountAddress?: string | null;
  currentOpenOrdersAccountAddress?: string | null;
}) {
  const activeAddress = normalizePerpsAccountAddress(activeAccountAddress);
  if (!activeAddress) {
    return false;
  }
  return (
    normalizePerpsAccountAddress(currentOpenOrdersAccountAddress) !==
    activeAddress
  );
}

export function getScopedOpenOrdersByCoin<T extends IPerpsFrontendOrder>({
  activeAccountAddress,
  openOrdersAccountAddress,
  openOrdersByCoin,
  coin,
}: {
  activeAccountAddress?: string | null;
  openOrdersAccountAddress?: string | null;
  openOrdersByCoin?: Record<string, T[]>;
  coin: string;
}) {
  const activeAddress = normalizePerpsAccountAddress(activeAccountAddress);
  if (!activeAddress) {
    return [];
  }
  if (
    normalizePerpsAccountAddress(openOrdersAccountAddress) !== activeAddress
  ) {
    return [];
  }
  return openOrdersByCoin?.[coin] ?? [];
}

export function getActivePerpsPositions(positions: IPerpsAssetPosition[]) {
  return positions.filter((pos) => {
    const size = parseFloat(pos.position?.szi || '0');
    return Math.abs(size) > 0;
  });
}

export function sortActivePerpsPositions<T extends IPerpsAssetPosition>(
  positions: T[],
) {
  return positions.toSorted(
    (a, b) =>
      parseFloat(b.position.positionValue || '0') -
      parseFloat(a.position.positionValue || '0'),
  );
}

import { parseDexCoin } from '@onekeyhq/shared/src/utils/perpsUtils';
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

export function buildOpenOrdersByDexMap(openOrders: IPerpsFrontendOrder[]) {
  return openOrders.reduce<Record<string, IPerpsFrontendOrder[]>>(
    (acc, order) => {
      const dex = parseDexCoin(order.coin).dexLabel ?? '';
      if (!acc[dex]) {
        acc[dex] = [];
      }
      acc[dex].push(order);
      return acc;
    },
    {},
  );
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

export function mergePrimaryPositionsWithCachedDexPositions({
  activeAccountAddress,
  cachedAccountAddress,
  primaryPositions,
  cachedPositions,
}: {
  activeAccountAddress?: string | null;
  cachedAccountAddress?: string | null;
  primaryPositions: IPerpsAssetPosition[];
  cachedPositions?: IPerpsAssetPosition[];
}) {
  if (
    normalizePerpsAccountAddress(activeAccountAddress) !==
    normalizePerpsAccountAddress(cachedAccountAddress)
  ) {
    return primaryPositions;
  }

  const primaryCoins = new Set(
    primaryPositions.map((position) => position.position.coin),
  );
  const cachedDexPositions =
    cachedPositions?.filter((position) => {
      const coin = position.position.coin;
      return Boolean(parseDexCoin(coin).dexLabel) && !primaryCoins.has(coin);
    }) ?? [];

  return sortActivePerpsPositions([...primaryPositions, ...cachedDexPositions]);
}

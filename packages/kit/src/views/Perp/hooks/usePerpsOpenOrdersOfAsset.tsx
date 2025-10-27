import { useMemo } from 'react';

import type { IPerpsFrontendOrder } from '@onekeyhq/shared/types/hyperliquid';

import { usePerpsActiveOpenOrdersAtom } from '../../../states/jotai/contexts/hyperliquid';
import { usePerpsActiveOpenOrdersMapAtom } from '../../../states/jotai/contexts/hyperliquid/atoms';

export function usePerpsOpenOrdersOfAsset({ coin }: { coin: string }): {
  openOrders: IPerpsFrontendOrder[];
} {
  const [{ openOrders }] = usePerpsActiveOpenOrdersAtom();
  const [openOrdersMap] = usePerpsActiveOpenOrdersMapAtom();
  const openOrdersOfAsset = useMemo(() => {
    const indexes = openOrdersMap?.[coin] || [];
    if (!indexes) {
      return [];
    }
    return indexes
      .map((index) => {
        const o = openOrders[index];
        if (o.coin === coin) {
          return o;
        }
        return null;
      })
      .filter(Boolean);
  }, [openOrders, coin, openOrdersMap]);
  return { openOrders: openOrdersOfAsset };
}

import { useMemo } from 'react';

import type { ITVLine } from '@onekeyhq/kit/src/components/TradingView/TradingViewPerpsV2/types';
import { buildAllLinesForSymbol } from '@onekeyhq/kit/src/components/TradingView/TradingViewPerpsV2/utils/lineBuilder';
import { useActiveTradeInstrumentAtom } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import {
  usePerpsCustomSettingsAtom,
  useSpotActiveOpenOrdersAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { normalizePerpsAccountAddress } from '@onekeyhq/shared/src/utils/perpsUtils';
import { SPOT_ASSET_ID_OFFSET } from '@onekeyhq/shared/types/hyperliquid/perp.constants';

import { usePerpsAccountScopedActivePositions } from './usePerpsAccountScopedActivePositions';
import { usePerpsAccountScopedOpenOrdersByCoin } from './usePerpsAccountScopedOpenOrdersByCoin';

export function usePerpsChartLines({
  symbol,
  szDecimals,
  userAddress,
}: {
  symbol: string;
  szDecimals: number;
  userAddress: string | undefined | null;
}): ITVLine[] {
  const [activeTradeInstrument] = useActiveTradeInstrumentAtom();
  const perpsPositions = usePerpsAccountScopedActivePositions();
  const perpsOpenOrders = usePerpsAccountScopedOpenOrdersByCoin(symbol);
  const [
    { openOrders: spotOpenOrders, accountAddress: spotOrdersAccountAddress },
  ] = useSpotActiveOpenOrdersAtom();
  const [{ showChartLines }] = usePerpsCustomSettingsAtom();
  const normalizedUserAddress = normalizePerpsAccountAddress(userAddress);

  const currentOrders = useMemo(() => {
    if (!normalizedUserAddress) {
      return [];
    }

    if (activeTradeInstrument.mode === 'spot') {
      if (
        normalizePerpsAccountAddress(spotOrdersAccountAddress) !==
        normalizedUserAddress
      ) {
        return [];
      }
      // Spot orders can use the pair name or @index; aliases belong to this
      // instrument only while it still matches the chart's raw symbol.
      const aliases = new Set<string>([symbol]);
      if (activeTradeInstrument.coin === symbol) {
        if (activeTradeInstrument.universe?.name) {
          aliases.add(activeTradeInstrument.universe.name);
        }
        if (typeof activeTradeInstrument.assetId === 'number') {
          aliases.add(
            `@${activeTradeInstrument.assetId - SPOT_ASSET_ID_OFFSET}`,
          );
        }
      }
      return spotOpenOrders.filter((order) => aliases.has(order.coin));
    }

    return perpsOpenOrders;
  }, [
    activeTradeInstrument.mode,
    activeTradeInstrument.coin,
    activeTradeInstrument.assetId,
    activeTradeInstrument.universe,
    normalizedUserAddress,
    perpsOpenOrders,
    spotOpenOrders,
    spotOrdersAccountAddress,
    symbol,
  ]);

  return useMemo(() => {
    if (!normalizedUserAddress || showChartLines === false) {
      return [];
    }
    return buildAllLinesForSymbol(
      perpsPositions,
      currentOrders,
      symbol,
      szDecimals,
    );
  }, [
    perpsPositions,
    currentOrders,
    normalizedUserAddress,
    symbol,
    szDecimals,
    showChartLines,
  ]);
}

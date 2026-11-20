import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import type { ITVLine } from '@onekeyhq/kit/src/components/TradingView/TradingViewPerpsV2/types';
import { buildAllLinesForSymbol } from '@onekeyhq/kit/src/components/TradingView/TradingViewPerpsV2/utils/lineBuilder';
import {
  usePerpsCustomSettingsAtom,
  useSpotActiveOpenOrdersAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { normalizePerpsAccountAddress } from '@onekeyhq/shared/src/utils/perpsUtils';
import { SPOT_ASSET_ID_OFFSET } from '@onekeyhq/shared/types/hyperliquid/perp.constants';

import { usePerpsAccountScopedActivePositions } from './usePerpsAccountScopedActivePositions';
import { usePerpsAccountScopedOpenOrdersByCoin } from './usePerpsAccountScopedOpenOrdersByCoin';
import { useActivePerpsChartInstrument } from './usePerpsChartInstrument';

import type { IPerpsChartInstrument } from './usePerpsChartInstrument';

export function usePerpsChartLines({
  instrument,
  symbol,
  szDecimals,
  userAddress,
}: {
  // The instrument `symbol` belongs to. Defaults to the active trade
  // instrument; a split-view panel passes its own.
  instrument?: IPerpsChartInstrument;
  symbol: string;
  szDecimals: number;
  userAddress: string | undefined | null;
}): ITVLine[] {
  const intl = useIntl();
  const activeInstrument = useActivePerpsChartInstrument();
  const activeTradeInstrument = instrument ?? activeInstrument;
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
        if (activeTradeInstrument.spotName) {
          aliases.add(activeTradeInstrument.spotName);
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
    activeTradeInstrument.spotName,
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
      intl,
    );
  }, [
    perpsPositions,
    currentOrders,
    normalizedUserAddress,
    symbol,
    szDecimals,
    showChartLines,
    intl,
  ]);
}

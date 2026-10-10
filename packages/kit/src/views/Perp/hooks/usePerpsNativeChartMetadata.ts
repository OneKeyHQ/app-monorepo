import { useActiveTradeInstrumentAtom } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import {
  MAX_DECIMALS_PERP,
  MAX_DECIMALS_SPOT,
} from '@onekeyhq/shared/types/hyperliquid/perp.constants';

import { useActiveTradeDisplay } from './useActiveTradeDisplay';

export function usePerpsNativeChartMetadata() {
  const [instrument] = useActiveTradeInstrumentAtom();
  const { displayName } = useActiveTradeDisplay();
  const isSpot = instrument.mode === 'spot';
  const szDecimals =
    instrument.mode === 'spot'
      ? instrument.universe?.baseSzDecimals
      : instrument.universe?.szDecimals;
  // The latest close must not reduce the precision of historical candles or orders.
  const priceDecimalPlaces = Math.max(
    0,
    (isSpot ? MAX_DECIMALS_SPOT : MAX_DECIMALS_PERP) - (szDecimals ?? 0),
  );

  return {
    displayName,
    priceDecimalPlaces,
  };
}

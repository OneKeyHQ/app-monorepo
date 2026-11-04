import { useEffect, useState } from 'react';

import { useActiveTradeInstrumentAtom } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import {
  MAX_DECIMALS_PERP,
  MAX_DECIMALS_SPOT,
} from '@onekeyhq/shared/types/hyperliquid/perp.constants';

export function usePerpsNativeChartMetadata() {
  const [instrument] = useActiveTradeInstrumentAtom();
  const isSpot = instrument.mode === 'spot';
  const szDecimals =
    instrument.mode === 'spot'
      ? instrument.universe?.baseSzDecimals
      : instrument.universe?.szDecimals;
  const instrumentKey = `${instrument.mode}:${instrument.coin}`;
  const [timedOutInstrument, setTimedOutInstrument] = useState<string>();
  useEffect(() => {
    setTimedOutInstrument(undefined);
    if (szDecimals !== undefined) return;
    // Failed metadata hydration must not keep a candle-ready chart covered forever.
    const timer = setTimeout(() => setTimedOutInstrument(instrumentKey), 5000);
    return () => clearTimeout(timer);
  }, [instrumentKey, szDecimals]);
  const maxDecimals = isSpot ? MAX_DECIMALS_SPOT : MAX_DECIMALS_PERP;
  const fallbackDecimalPlaces =
    timedOutInstrument === instrumentKey ? maxDecimals : undefined;
  // The latest close must not reduce the precision of historical candles or orders.
  const priceDecimalPlaces =
    szDecimals === undefined
      ? fallbackDecimalPlaces
      : Math.max(0, maxDecimals - szDecimals);

  return {
    priceDecimalPlaces,
  };
}

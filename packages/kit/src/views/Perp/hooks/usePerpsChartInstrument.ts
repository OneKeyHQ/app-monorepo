import { useMemo } from 'react';

import { useActiveTradeInstrumentAtom } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';

/**
 * What a chart needs to know about the instrument it shows. The trading chart
 * derives it from the active trade instrument; a split-view panel resolves it
 * for whichever coin the panel holds.
 */
export interface IPerpsChartInstrument {
  mode: 'perp' | 'spot';
  /** Raw coin ID; never a display name. */
  coin: string;
  szDecimals?: number;
  /** Spot only: the pair's universe name, which orders and fills may use. */
  spotName?: string;
  assetId?: number;
}

export interface IPerpsChartInstrumentDisplay {
  label: string;
  tokenImageUri?: string;
  tokenImageUris?: string[];
}

export function useActivePerpsChartInstrument(): IPerpsChartInstrument {
  const [instrument] = useActiveTradeInstrumentAtom();
  const { assetId, coin, mode } = instrument;
  const szDecimals =
    instrument.mode === 'spot'
      ? instrument.universe?.baseSzDecimals
      : instrument.universe?.szDecimals;
  const spotName =
    instrument.mode === 'spot' ? instrument.universe?.name : undefined;
  return useMemo(
    () => ({ mode, coin, szDecimals, spotName, assetId }),
    [assetId, coin, mode, spotName, szDecimals],
  );
}

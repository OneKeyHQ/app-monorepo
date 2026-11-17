import { useEffect, useMemo, useState } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  formatSpotPairDisplayName,
  getHyperliquidTokenImageUris,
  getHyperliquidTokenImageUrl,
  isSpotInstrument,
  parseDexCoin,
} from '@onekeyhq/shared/src/utils/perpsUtils';

import type {
  IPerpsChartInstrument,
  IPerpsChartInstrumentDisplay,
} from './usePerpsChartInstrument';

type ISymbolMeta = Awaited<
  ReturnType<typeof backgroundApiProxy.serviceHyperliquid.getSymbolMeta>
>;

const META_RETRY_DELAYS = [500, 1500, 4000];

/** Resolves any coin's metadata, e.g. for a split-view panel. */
export function usePerpsChartPanelInstrument(coin: string): {
  instrument: IPerpsChartInstrument;
  display: IPerpsChartInstrumentDisplay;
} {
  const [result, setResult] = useState<{ coin: string; meta: ISymbolMeta }>();
  useEffect(() => {
    if (!coin) return;
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = (attempt: number) => {
      void backgroundApiProxy.serviceHyperliquid
        .getSymbolMeta({ coin })
        .then((meta) => {
          if (!disposed) setResult({ coin, meta });
        })
        .catch(() => {
          // The universe may not be persisted yet on a cold start.
          const delay = META_RETRY_DELAYS[attempt];
          if (!disposed && delay !== undefined) {
            timer = setTimeout(() => load(attempt + 1), delay);
          }
        });
    };
    load(0);
    return () => {
      disposed = true;
      if (timer) clearTimeout(timer);
    };
  }, [coin]);
  const meta = result?.coin === coin ? result.meta : undefined;
  return useMemo(() => {
    const isSpot = isSpotInstrument(coin);
    if (isSpot) {
      const universe = meta?.spotUniverse;
      return {
        instrument: {
          mode: 'spot',
          coin,
          szDecimals: universe?.baseSzDecimals,
          spotName: universe?.name,
          assetId: meta?.assetId,
        },
        display: {
          label: universe
            ? formatSpotPairDisplayName(universe.baseName, universe.quoteName)
            : coin,
          tokenImageUri: universe
            ? getHyperliquidTokenImageUrl(universe.baseName)
            : undefined,
        },
      };
    }
    return {
      instrument: {
        mode: 'perp',
        coin,
        szDecimals: meta?.universe?.szDecimals,
        assetId: meta?.assetId,
      },
      display: {
        label: `${parseDexCoin(coin).displayName}USDC`,
        tokenImageUris: getHyperliquidTokenImageUris(coin),
      },
    };
  }, [coin, meta]);
}

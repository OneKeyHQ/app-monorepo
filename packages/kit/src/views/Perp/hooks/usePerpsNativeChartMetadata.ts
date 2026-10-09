import { useCallback, useEffect, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { ITradingViewNativePriceUpdateData } from '@onekeyhq/kit/src/components/TradingView/TradingViewNative/types';
import { useActiveTradeInstrumentAtom } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { getDisplayPriceScaleDecimals } from '@onekeyhq/shared/src/utils/perpsUtils';

import { useActiveTradeDisplay } from './useActiveTradeDisplay';

export function usePerpsNativeChartMetadata() {
  const [instrument] = useActiveTradeInstrumentAtom();
  const { displayName } = useActiveTradeDisplay();
  const [precision, setPrecision] = useState<{
    coin: string;
    decimals: number;
  }>();
  const receivedCandle = useRef<string | undefined>(undefined);
  const coin = instrument.coin;
  useEffect(() => {
    let disposed = false;
    const applyScale = (data: { symbol: string; priceScale?: number }) => {
      if (
        disposed ||
        receivedCandle.current === coin ||
        data.symbol !== coin ||
        !data.priceScale
      )
        return;
      const decimals = Math.log10(data.priceScale);
      if (Number.isInteger(decimals) && decimals >= 0 && decimals <= 8) {
        setPrecision({ coin, decimals });
      }
    };
    appEventBus.on(EAppEventBusNames.PerpsTvPriceScaleRefreshed, applyScale);
    void backgroundApiProxy.serviceHyperliquid
      .getTradingviewPriceScale({ symbol: coin })
      .then(({ priceScale }) => applyScale({ symbol: coin, priceScale }))
      .catch(() => undefined);
    return () => {
      disposed = true;
      appEventBus.off(EAppEventBusNames.PerpsTvPriceScaleRefreshed, applyScale);
    };
  }, [coin]);

  const onPriceUpdate = useCallback(
    ({ price }: ITradingViewNativePriceUpdateData) => {
      if (!Number.isFinite(price) || price <= 0) return;
      receivedCandle.current = coin;
      const displayDecimals = getDisplayPriceScaleDecimals(price);
      // Spot prices can have eight decimals; the legacy Perps display helper caps at six.
      const decimals =
        instrument.mode === 'spot'
          ? Math.max(
              displayDecimals,
              Math.min(8, new BigNumber(price).decimalPlaces() ?? 0),
            )
          : displayDecimals;
      setPrecision((previous) =>
        previous?.coin === coin && previous.decimals === decimals
          ? previous
          : { coin, decimals },
      );
    },
    [coin, instrument.mode],
  );

  return {
    displayName,
    priceDecimalPlaces:
      precision?.coin === coin ? precision.decimals : undefined,
    onPriceUpdate,
  };
}

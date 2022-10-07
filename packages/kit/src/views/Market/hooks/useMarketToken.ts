import { useEffect, useMemo, useRef } from 'react';
import { useIsFocused } from '@react-navigation/core';

import { useAppSelector } from '../../../hooks';
import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

export const useMarketTokenChart = ({
  coingeckoId,
  days = '1',
  points,
  pollingIntervall = 120,
}: {
  coingeckoId: string;
  days: string;
  points?: string;
  pollingIntervall?: number;
}) => {
  const charts = useAppSelector((s) => s.market.charts);
  const isFocused = useIsFocused();
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    if (isFocused) {
      backgroundApiProxy.serviceMarket.fetchMarketTokenChart({
        coingeckoId,
        days,
        points,
      });
      timer = setInterval(() => {
        backgroundApiProxy.serviceMarket.fetchMarketTokenChart({
          coingeckoId,
          days,
          points,
        });
      }, pollingIntervall * 1000);
    }
    return () => {
      if (timer) {
        clearInterval(timer);
      }
    };
  }, [pollingIntervall, days, points, coingeckoId, isFocused]);

  const chart = useMemo(() => {
    const tokenCharts = charts[coingeckoId];
    if (tokenCharts) {
      return tokenCharts[days];
    }
    return null;
  }, [charts, coingeckoId, days]);

  return { chart };
};

export const useMarketTokenItem = ({
  coingeckoId,
}: {
  coingeckoId: string;
}) => {
  const marketTokens = useAppSelector((s) => s.market.marketTokens);
  return useMemo(() => marketTokens[coingeckoId], [marketTokens, coingeckoId]);
};

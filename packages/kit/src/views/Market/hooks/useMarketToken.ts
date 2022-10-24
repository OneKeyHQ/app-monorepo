import { useEffect, useMemo } from 'react';

import { useIsFocused } from '@react-navigation/core';

import { useIsVerticalLayout } from '@onekeyhq/components/src';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useAppSelector } from '../../../hooks';

import { useMarketMidLayout } from './useMarketLayout';

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
  const isVertical = useIsVerticalLayout();
  const isMidLayout = useMarketMidLayout();
  const marketTokens = useAppSelector((s) => s.market.marketTokens);
  const marketTokenItem = marketTokens[coingeckoId];
  useEffect(() => {
    if (coingeckoId?.length) {
      if (!marketTokenItem) {
        backgroundApiProxy.serviceMarket.fetchMarketList({
          vsCurrency: 'usd',
          ids: coingeckoId,
          sparkline: !isVertical && !isMidLayout,
        });
        backgroundApiProxy.serviceMarket.fetchMarketTokenBaseInfo(coingeckoId);
      } else if (marketTokenItem && !marketTokenItem.logoURI) {
        backgroundApiProxy.serviceMarket.fetchMarketTokenBaseInfo(coingeckoId);
      }
    }
  }, [coingeckoId, isMidLayout, isVertical, marketTokenItem]);

  return useMemo(() => marketTokens[coingeckoId], [marketTokens, coingeckoId]);
};

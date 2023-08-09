import { useEffect, useMemo } from 'react';

import { useIsFocused } from '@react-navigation/core';

import { useIsVerticalLayout } from '@onekeyhq/components';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useAppSelector } from '../../../hooks';
import {
  selectMarketCharts,
  selectMarketTokens,
} from '../../../store/selectors';

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
  const charts = useAppSelector(selectMarketCharts);
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
  isList,
}: {
  coingeckoId?: string;
  isList?: boolean;
}) => {
  const isVertical = useIsVerticalLayout();
  const isMidLayout = useMarketMidLayout();
  const marketTokens = useAppSelector(selectMarketTokens);
  useEffect(() => {
    if (coingeckoId?.length) {
      const marketTokenItem = marketTokens[coingeckoId];
      if (!isList && !marketTokenItem) {
        backgroundApiProxy.serviceMarket.fetchMarketListDebounced({
          ids: coingeckoId,
          sparkline: !isVertical && !isMidLayout,
        });
      }
    }
  }, [coingeckoId, isList, isMidLayout, isVertical, marketTokens]);
  return useMemo(() => {
    if (coingeckoId) {
      return marketTokens[coingeckoId];
    }
  }, [marketTokens, coingeckoId]);
};

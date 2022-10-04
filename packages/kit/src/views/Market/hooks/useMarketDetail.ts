import { useIsFocused } from '@react-navigation/core';
import { useEffect, useMemo } from 'react';
import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useAppSelector } from '../../../hooks';
import {
  useMarketTokenChart,
  useMarketTokenInfo,
  useMarketTokenStats,
} from './useMarketToken';

export const useMarketDetail = ({
  coingeckoId,
  pollingInterval = 60,
}: {
  coingeckoId: string;
  pollingInterval?: number;
}) => {
  const isFocused = useIsFocused();
  const marketChart = useMarketTokenChart({ coingeckoId });
  const marketTokenInfo = useMarketTokenInfo({ coingeckoId });
  const marketTokenStats = useMarketTokenStats({ coingeckoId });
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    if (isFocused) {
      backgroundApiProxy.serviceMarket.fetchMarketDetail(coingeckoId);
      timer = setInterval(() => {
        backgroundApiProxy.serviceMarket.fetchMarketDetail(coingeckoId);
      }, pollingInterval * 1000);
    }
    return () => {
      if (timer) {
        clearInterval(timer);
      }
    };
  }, [coingeckoId, isFocused, pollingInterval]);
  return {
    marketChart,
    marketTokenInfo,
    marketTokenStats,
  };
};

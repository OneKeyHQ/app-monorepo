import { useIsFocused } from '@react-navigation/core';
import { useEffect, useMemo } from 'react';
import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useAppSelector } from '../../../hooks';
import {
  useMarketTokenChart,
  useMarketTokenInfo,
  useMarketTokenStats,
} from './useMarketToken';

export const useMarketDetail = ({ coingeckoId }: { coingeckoId: string }) => {
  const isFocused = useIsFocused();
  const marketTokenInfo = useMarketTokenInfo({ coingeckoId });
  const marketTokenStats = useMarketTokenStats({ coingeckoId });
  const selectedMarketTokenId = useAppSelector(
    (s) => s.market.selectedMarketTokenId,
  );
  useEffect(() => {
    backgroundApiProxy.serviceMarket.fetchMarketDetail(coingeckoId);
  }, [coingeckoId, isFocused]);
  return {
    marketTokenInfo,
    marketTokenStats,
    selectedMarketTokenId,
  };
};

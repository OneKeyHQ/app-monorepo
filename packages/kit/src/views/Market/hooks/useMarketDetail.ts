import { useEffect, useMemo } from 'react';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useAppSelector } from '../../../hooks';

export const useMarketDetail = ({ coingeckoId }: { coingeckoId: string }) => {
  const marketDetails = useAppSelector((s) => s.market.details);
  const tokenDetail = useMemo(
    () => marketDetails[coingeckoId],
    [coingeckoId, marketDetails],
  );
  useEffect(() => {
    backgroundApiProxy.serviceMarket.fetchMarketDetail(coingeckoId);
  }, [coingeckoId]);
  return {
    tokenDetail,
  };
};

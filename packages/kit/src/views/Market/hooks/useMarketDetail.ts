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

export const useMarketTokenPriceSubscribeStatus = ({
  coingeckoId,
}: {
  coingeckoId: string;
}) => {
  const { tokenDetail } = useMarketDetail({ coingeckoId });
  const priceSubscribe = useMemo(
    () => tokenDetail?.priceSubscribe,
    [tokenDetail],
  );
  useEffect(() => {
    backgroundApiProxy.serviceMarket.fetchMarketTokenPriceSubscribe();
  });

  return priceSubscribe;
};

import { useEffect, useMemo } from 'react';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useAppSelector } from '../../../hooks';
import { selectLocale, selectMarketDetails } from '../../../store/selectors';
import { getDefaultLocale } from '../../../utils/locale';

export const useMarketDetail = ({ coingeckoId }: { coingeckoId: string }) => {
  const marketDetails = useAppSelector(selectMarketDetails);
  const locale = useAppSelector(selectLocale);
  const tokenDetail = useMemo(
    () => marketDetails[coingeckoId],
    [coingeckoId, marketDetails],
  );
  useEffect(() => {
    backgroundApiProxy.serviceMarket.fetchMarketDetail({
      coingeckoId,
      locale: locale === 'system' ? getDefaultLocale() : locale,
    });
  }, [coingeckoId, locale]);
  return {
    tokenDetail,
  };
};

// export const useMarketTokenPriceSubscribeStatus = ({
//   coingeckoId,
// }: {
//   coingeckoId: string;
// }) => {
//   const { tokenDetail } = useMarketDetail({ coingeckoId });
//   const priceSubscribe = useMemo(
//     () => tokenDetail?.priceSubscribe,
//     [tokenDetail],
//   );
//   useEffect(() => {
//     backgroundApiProxy.serviceMarket.fetchMarketTokenPriceSubscribe();
//   });
//   return priceSubscribe;
// };

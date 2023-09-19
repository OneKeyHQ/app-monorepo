import { useEffect } from 'react';

import { useIsVerticalLayout } from '@onekeyhq/components';

import backgroundApiProxy from '../../../../../background/instance/backgroundApiProxy';
import { useStatsListContext } from '../context';

import Desktop from './Container/Desktop';
import Mobile from './Container/Mobile';

const MarketCap = () => {
  const isSmallScreen = useIsVerticalLayout();

  const context = useStatsListContext()?.context;
  const setContext = useStatsListContext()?.setContext;

  const { serviceNFT } = backgroundApiProxy;

  useEffect(() => {
    (async () => {
      if (context?.selectedIndex === 1) {
        if (setContext) {
          setContext((ctx) => ({
            ...ctx,
            loading: true,
          }));
          const data = await serviceNFT.getMarketCapCollection({
            chain: context.selectedNetwork?.id,
            limit: context.isTab ? 5 : 100,
          });
          if (data) {
            setContext((ctx) => {
              const { isTab } = ctx;
              return {
                ...ctx,
                marketCapList: isTab ? data.slice(0, 5) : data,
                loading: false,
              };
            });
          }
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context?.selectedNetwork?.id, serviceNFT, setContext]);

  return isSmallScreen ? (
    <Mobile listData={context?.marketCapList ?? []} />
  ) : (
    <Desktop listData={context?.marketCapList ?? []} />
  );
};
export default MarketCap;

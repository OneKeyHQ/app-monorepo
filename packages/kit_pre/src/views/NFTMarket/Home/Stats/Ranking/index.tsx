import { useEffect } from 'react';

import { useIsVerticalLayout } from '@onekeyhq/components';

import backgroundApiProxy from '../../../../../background/instance/backgroundApiProxy';
import { useStatsListContext } from '../context';

import Desktop from './Container/Desktop';
import Mobile from './Container/Mobile';

const DateMap: Record<number, string> = {
  0: '6h',
  1: '12h',
  2: '1d',
};

const Ranking = () => {
  const isSmallScreen = useIsVerticalLayout();
  const context = useStatsListContext()?.context;
  const setContext = useStatsListContext()?.setContext;
  const { serviceNFT } = backgroundApiProxy;
  useEffect(() => {
    (async () => {
      if (context?.selectedIndex === 0) {
        if (setContext) {
          setContext((ctx) => ({
            ...ctx,
            loading: true,
          }));
          const data = await serviceNFT.getMarketRanking({
            chain: context.selectedNetwork?.id,
            time: DateMap[context.selectedTime],
          });
          if (data) {
            setContext((ctx) => {
              const { isTab } = ctx;
              return {
                ...ctx,
                rankingList: isTab ? data.slice(0, 5) : data,
                loading: false,
              };
            });
          }
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    context?.selectedNetwork?.id,
    context?.selectedTime,
    serviceNFT,
    setContext,
  ]);

  return isSmallScreen ? (
    <Mobile listData={context?.rankingList ?? []} />
  ) : (
    <Desktop listData={context?.rankingList ?? []} />
  );
};

export default Ranking;

import { useMemo } from 'react';

import { useAppSelector } from '@onekeyhq/kit/src/hooks/redux';

import { MatchDAppItemType } from '../explorerUtils';

export const useLimitHistories = (limit = 50) => {
  const { history, syncData } = useAppSelector((s) => s.discover);

  const limitHistories = useMemo(() => {
    let dappHistoryArray: MatchDAppItemType[] = [];

    Object.entries(history).forEach(([key, value]) => {
      const dApp = syncData.increment[key];
      const isCorrectDApp =
        dApp && dApp.status?.toLowerCase() === 'listed' && !!dApp.url;
      const isWebsite = dApp == null && !!value.webSite;

      if (isCorrectDApp || isWebsite) {
        dappHistoryArray.push({
          id: key,
          dapp: dApp,
          webSite: value.webSite,
          clicks: value?.clicks ?? 0,
          timestamp: value?.timestamp ?? 0,
        });
      }
    });

    dappHistoryArray = dappHistoryArray.sort(
      (a, b) => (b.timestamp ?? 0) - (a?.timestamp ?? 0),
    );

    if (dappHistoryArray.length > limit) {
      return dappHistoryArray.slice(0, limit);
    }
    return dappHistoryArray;
  }, [history, limit, syncData.increment]);

  return {
    limitHistories,
  };
};

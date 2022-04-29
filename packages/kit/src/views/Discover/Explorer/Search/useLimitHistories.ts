import { useMemo } from 'react';

import { useAppSelector } from '@onekeyhq/kit/src/hooks/redux';
import { WebSiteHistory } from '@onekeyhq/kit/src/store/reducers/discover';

import type { DAppItemType } from '../../type';

export type MatchDAppItemType = {
  id: string;
  dapp?: DAppItemType | undefined;
  webSite?: WebSiteHistory | undefined;
  clicks?: number | undefined;
  timestamp?: number | undefined;
};

export const useLimitHistories = (limit = 50) => {
  const { history, syncData } = useAppSelector((s) => s.discover);

  const limitHistories = useMemo(() => {
    let dappHistoryArray: MatchDAppItemType[] = [];

    Object.entries(history).forEach(([key, value]) => {
      const dAppItem = {
        id: key,
        dapp: syncData.increment[key],
        webSite: value.webSite,
        clicks: value?.clicks ?? 0,
        timestamp: value?.timestamp ?? 0,
      };
      if (dAppItem) dappHistoryArray.push(dAppItem);
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

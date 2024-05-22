import { useCallback, useMemo } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';

export const useWatchListAction = () => {
  const removeFormWatchList = useCallback(async (coingeckoId: string) => {
    const item = {
      coingeckoId,
    };
    await backgroundApiProxy.serviceMarket.removeFormWatchList(item);
  }, []);
  const addIntoWatchList = useCallback(async (coingeckoId: string) => {
    const item = {
      coingeckoId,
    };
    await backgroundApiProxy.serviceMarket.addIntoWatchList(item);
  }, []);
  const MoveToTop = useCallback(async (coingeckoId: string) => {
    const item = {
      coingeckoId,
    };
    await backgroundApiProxy.serviceMarket.moveToTop(item);
  }, []);
  return useMemo(
    () => ({
      removeFormWatchList,
      addIntoWatchList,
      MoveToTop,
    }),
    [MoveToTop, addIntoWatchList, removeFormWatchList],
  );
};

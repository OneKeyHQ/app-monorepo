import { useCallback, useMemo } from 'react';

import { Toast } from '@onekeyhq/components';

import { useWatchListActions } from '../../../states/jotai/contexts/market';

export const useWatchListAction = () => {
  const actions = useWatchListActions();
  const removeFormWatchList = useCallback(
    (coingeckoId: string) => {
      const item = {
        coingeckoId,
      };
      actions.current.removeFormWatchList(item);
    },
    [actions],
  );
  const addIntoWatchList = useCallback(
    (coingeckoIds: string | string[]) => {
      const ids = Array.isArray(coingeckoIds) ? coingeckoIds : [coingeckoIds];
      actions.current.addIntoWatchList(ids.map((id) => ({ coingeckoId: id })));
      Toast.success({ title: 'Added to watchlist' });
    },
    [actions],
  );
  const MoveToTop = useCallback(
    (coingeckoId: string) => {
      const item = {
        coingeckoId,
      };
      actions.current.moveToTop(item);
    },
    [actions],
  );

  const isInWatchList = useCallback(
    (coingeckoId: string) => actions.current.isInWatchList(coingeckoId),
    [actions],
  );
  return useMemo(
    () => ({
      removeFormWatchList,
      addIntoWatchList,
      MoveToTop,
      isInWatchList,
    }),
    [MoveToTop, addIntoWatchList, isInWatchList, removeFormWatchList],
  );
};

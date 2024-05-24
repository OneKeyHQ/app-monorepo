import { useCallback, useMemo } from 'react';

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
  return useMemo(
    () => ({
      removeFormWatchList,
      addIntoWatchList,
      MoveToTop,
    }),
    [MoveToTop, addIntoWatchList, removeFormWatchList],
  );
};

import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Toast } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IMarketWatchListItem } from '@onekeyhq/shared/types/market';

import { useWatchListActions } from '../../../states/jotai/contexts/market';

export const useWatchListAction = () => {
  const intl = useIntl();
  const actions = useWatchListActions();
  const removeFormWatchList = useCallback(
    (coingeckoId: string) => {
      const item = {
        coingeckoId,
        sortIndex: undefined,
      };
      actions.current.removeFormWatchList(item);
    },
    [actions],
  );
  const addIntoWatchList = useCallback(
    async (coingeckoIds: string | string[]) => {
      const ids = Array.isArray(coingeckoIds) ? coingeckoIds : [coingeckoIds];
      await actions.current.addIntoWatchList(
        ids.map((id) => ({ coingeckoId: id, sortIndex: undefined })),
      );
      Toast.success({
        title: intl.formatMessage({
          id: ETranslations.market_added_to_watchlist,
        }),
      });
    },
    [actions, intl],
  );

  const sortWatchListItems = useCallback(
    async (payload: {
      target: IMarketWatchListItem;
      prev: IMarketWatchListItem | undefined;
      next: IMarketWatchListItem | undefined;
    }) => {
      await actions.current.sortWatchListItems(payload);
    },
    [actions],
  );
  const MoveToTop = useCallback(
    async (coingeckoId: string) => {
      const item = {
        coingeckoId,
        sortIndex: undefined,
      };
      await actions.current.moveToTop(item);
    },
    [actions],
  );

  const isInWatchList = useCallback(
    (coingeckoId: string) => actions.current.isInWatchList(coingeckoId),
    [actions],
  );

  const saveWatchList = useCallback(
    (payload: IMarketWatchListItem[]) => actions.current.saveWatchList(payload),
    [actions],
  );

  return useMemo(
    () => ({
      removeFormWatchList,
      addIntoWatchList,
      MoveToTop,
      isInWatchList,
      saveWatchList,
      sortWatchListItems,
    }),
    [
      MoveToTop,
      addIntoWatchList,
      isInWatchList,
      removeFormWatchList,
      saveWatchList,
      sortWatchListItems,
    ],
  );
};

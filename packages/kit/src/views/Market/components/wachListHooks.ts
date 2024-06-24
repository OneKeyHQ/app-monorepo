import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Toast } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useWatchListActions } from '../../../states/jotai/contexts/market';

export const useWatchListAction = () => {
  const intl = useIntl();
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
      Toast.success({
        title: intl.formatMessage({
          id: ETranslations.market_added_to_watchlist,
        }),
      });
    },
    [actions, intl],
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

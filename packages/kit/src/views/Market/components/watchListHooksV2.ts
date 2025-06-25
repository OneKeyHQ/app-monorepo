import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Toast } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IMarketWatchListItemV2 } from '@onekeyhq/shared/types/market';

import { useWatchListV2Actions } from '../../../states/jotai/contexts/marketV2';

export const useWatchListV2Action = () => {
  const intl = useIntl();
  const actions = useWatchListV2Actions();

  const removeFromWatchListV2 = useCallback(
    (chainId: string, contractAddress: string) => {
      void actions.current.removeFromWatchListV2(chainId, contractAddress);
    },
    [actions],
  );

  const addIntoWatchListV2 = useCallback(
    async (items: Array<{ chainId: string; contractAddress: string }>) => {
      const watchListItems: IMarketWatchListItemV2[] = items.map((item) => ({
        chainId: item.chainId,
        contractAddress: item.contractAddress,
        sortIndex: undefined,
      }));
      try {
        await actions.current.addIntoWatchListV2(watchListItems);
        Toast.success({
          title: intl.formatMessage({
            id: ETranslations.market_added_to_watchlist,
          }),
        });
      } catch (error) {
        Toast.error({
          title: intl.formatMessage({
            id: ETranslations.global_an_error_occurred,
          }),
        });
      }
    },
    [actions, intl],
  );

  const isInWatchListV2 = useCallback(
    (chainId: string, contractAddress: string) =>
      actions.current.isInWatchListV2(chainId, contractAddress),
    [actions],
  );

  return useMemo(
    () => ({
      removeFromWatchListV2,
      addIntoWatchListV2,
      isInWatchListV2,
    }),
    [addIntoWatchListV2, isInWatchListV2, removeFromWatchListV2],
  );
};

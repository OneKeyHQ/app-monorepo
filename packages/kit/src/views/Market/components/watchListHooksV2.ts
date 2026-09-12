import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Toast } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IMarketWatchListItemV2 } from '@onekeyhq/shared/types/market';

import {
  useMarketWatchListV2Atom,
  useWatchListV2Actions,
} from '../../../states/jotai/contexts/marketV2';

// The atom actions are async: `void`-ing them inside a `try` block never routes
// a rejection to the `catch`, so a failing write (Prime cloud sync being off,
// for one) surfaced as an unhandled rejection and the user saw nothing. Attach
// the handler to the promise instead.
function reportWatchListFailure(promise: Promise<unknown>, message: string) {
  void promise.catch(() => {
    Toast.error({ title: message });
  });
}

export const useWatchListV2Action = () => {
  const intl = useIntl();
  const actions = useWatchListV2Actions();
  const [{ data: watchListData, isMounted }] = useMarketWatchListV2Atom();

  const errorMessage = intl.formatMessage({
    id: ETranslations.global_an_error_occurred,
  });

  const removeFromWatchListV2 = useCallback(
    async (
      chainId: string,
      contractAddress: string,
      listing?: Pick<IMarketWatchListItemV2, 'assetId' | 'stockId'>,
    ) => {
      if (!isMounted) {
        return false;
      }
      try {
        await actions.current.removeFromWatchListV2(
          chainId,
          contractAddress,
          listing,
        );
        return true;
      } catch (_error) {
        Toast.error({
          title: intl.formatMessage({
            id: ETranslations.global_an_error_occurred,
          }),
        });
        return false;
      }
    },
    [actions, intl, isMounted],
  );

  const addIntoWatchListV2 = useCallback(
    async (
      items: Array<{
        chainId: string;
        contractAddress: string;
        isNative?: boolean;
        assetId?: string;
        stockId?: string;
      }>,
    ) => {
      if (!isMounted) {
        return false;
      }
      // Calculate sortIndex to make new items appear at the top
      const firstSortIndex =
        isMounted && watchListData.length > 0
          ? (watchListData[0].sortIndex ?? 1000)
          : 1000;

      const watchListItems: IMarketWatchListItemV2[] = items.map(
        (item, index) => ({
          ...item,
          chainId: item.chainId,
          contractAddress: item.contractAddress,
          sortIndex: firstSortIndex - (index + 1),
          isNative: item.isNative ?? false,
        }),
      );

      try {
        await actions.current.addIntoWatchListV2(watchListItems);
        return true;
      } catch (_error) {
        Toast.error({
          title: intl.formatMessage({
            id: ETranslations.global_an_error_occurred,
          }),
        });
        return false;
      }
    },
    [actions, intl, isMounted, watchListData],
  );

  const isInWatchListV2 = useCallback(
    (chainId: string, contractAddress: string) =>
      actions.current.isInWatchListV2(chainId, contractAddress),
    [actions],
  );

  // Perps watchlist actions
  const addPerpsIntoWatchListV2 = useCallback(
    (perpsCoin: string) => {
      reportWatchListFailure(
        actions.current.addPerpsIntoWatchListV2(perpsCoin),
        errorMessage,
      );
    },
    [actions, errorMessage],
  );

  const removePerpsFromWatchListV2 = useCallback(
    (perpsCoin: string) => {
      reportWatchListFailure(
        actions.current.removePerpsFromWatchListV2(perpsCoin),
        errorMessage,
      );
    },
    [actions, errorMessage],
  );

  return useMemo(
    () => ({
      removeFromWatchListV2,
      addIntoWatchListV2,
      isInWatchListV2,
      addPerpsIntoWatchListV2,
      removePerpsFromWatchListV2,
    }),
    [
      addIntoWatchListV2,
      isInWatchListV2,
      removeFromWatchListV2,
      addPerpsIntoWatchListV2,
      removePerpsFromWatchListV2,
    ],
  );
};

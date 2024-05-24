import { useRef } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ContextJotaiActionsBase } from '@onekeyhq/kit/src/states/jotai/utils/ContextJotaiActionsBase';
import { memoFn } from '@onekeyhq/shared/src/utils/cacheUtils';
import type { IMarketWatchListItem } from '@onekeyhq/shared/types/market';

import { contextAtomMethod, marketWatchListAtom } from './atoms';

export const homeResettingFlags: Record<string, number> = {};

class ContextJotaiActionsMarket extends ContextJotaiActionsBase {
  getWatchList = contextAtomMethod(async () => {
    const histories =
      (await backgroundApiProxy.simpleDb.marketWatchList.getRawData())?.data ??
      [];
    return histories;
  });

  addIntoWatchList = contextAtomMethod(
    (get, set, payload: IMarketWatchListItem | IMarketWatchListItem[]) => {
      const params = !Array.isArray(payload) ? [payload] : payload;

      set(marketWatchListAtom(), (prev) => ({
        data: [...prev.data, ...params],
      }));

      void backgroundApiProxy.simpleDb.marketWatchList.setRawData(
        get(marketWatchListAtom()),
      );
    },
  );

  removeFormWatchList = contextAtomMethod(
    (get, set, payload: IMarketWatchListItem) => {
      set(marketWatchListAtom(), (prev) => ({
        data: prev.data.filter((i) => i.coingeckoId !== payload.coingeckoId),
      }));

      void backgroundApiProxy.simpleDb.marketWatchList.setRawData(
        get(marketWatchListAtom()),
      );
    },
  );

  moveToTop = contextAtomMethod((get, set, payload: IMarketWatchListItem) => {
    set(marketWatchListAtom(), (prev) => {
      const newItems = prev.data.filter(
        (i) => i.coingeckoId !== payload.coingeckoId,
      );
      return {
        data: [payload, ...newItems],
      };
    });

    void backgroundApiProxy.simpleDb.marketWatchList.setRawData(
      get(marketWatchListAtom()),
    );
  });
}

const createActions = memoFn(() => new ContextJotaiActionsMarket());

export function useWatchListActions() {
  const actions = createActions();
  const addIntoWatchList = actions.addIntoWatchList.use();
  const removeFormWatchList = actions.removeFormWatchList.use();
  const moveToTop = actions.moveToTop.use();

  return useRef({
    addIntoWatchList,
    removeFormWatchList,
    moveToTop,
  });
}

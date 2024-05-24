/* eslint-disable @typescript-eslint/await-thenable */
import { useRef } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ContextJotaiActionsBase } from '@onekeyhq/kit/src/states/jotai/utils/ContextJotaiActionsBase';
import { memoFn } from '@onekeyhq/shared/src/utils/cacheUtils';
import type { IMarketWatchListItem } from '@onekeyhq/shared/types/market';

import { contextAtomMethod, marketWatchListAtom } from './atoms';

export const homeResettingFlags: Record<string, number> = {};

class ContextJotaiActionsMarket extends ContextJotaiActionsBase {
  syncToDb = contextAtomMethod((_, set, payload: IMarketWatchListItem[]) => {
    if (!Array.isArray(payload)) {
      throw new Error('buildBookmarkData: payload must be an array');
    }
    void backgroundApiProxy.simpleDb.marketWatchList.setRawData({
      data: payload,
    });
  });

  isInWatchList = contextAtomMethod(async (get, set, coingeckoId: string) => {
    const prev = await get(marketWatchListAtom());
    return !!prev.data?.find((i) => i.coingeckoId === coingeckoId);
  });

  addIntoWatchList = contextAtomMethod(
    async (
      get,
      set,
      payload: IMarketWatchListItem | IMarketWatchListItem[],
    ) => {
      const params = !Array.isArray(payload) ? [payload] : payload;
      const prev = await get(marketWatchListAtom());
      const watchList = [...prev.data, ...params];
      this.syncToDb.call(set, watchList);
    },
  );

  removeFormWatchList = contextAtomMethod(
    async (get, set, payload: IMarketWatchListItem) => {
      const prev = await get(marketWatchListAtom());
      const watchList = prev.data.filter(
        (i) => i.coingeckoId !== payload.coingeckoId,
      );
      this.syncToDb.call(set, watchList);
    },
  );

  moveToTop = contextAtomMethod(
    async (get, set, payload: IMarketWatchListItem) => {
      const prev = await get(marketWatchListAtom());
      const newItems = prev.data.filter(
        (i) => i.coingeckoId !== payload.coingeckoId,
      );
      const watchList = [payload, ...newItems];
      this.syncToDb.call(set, watchList);
    },
  );
}

const createActions = memoFn(() => new ContextJotaiActionsMarket());

export function useWatchListActions() {
  const actions = createActions();
  const addIntoWatchList = actions.addIntoWatchList.use();
  const removeFormWatchList = actions.removeFormWatchList.use();
  const moveToTop = actions.moveToTop.use();
  const isInWatchList = actions.isInWatchList.use();

  return useRef({
    isInWatchList,
    addIntoWatchList,
    removeFormWatchList,
    moveToTop,
  });
}

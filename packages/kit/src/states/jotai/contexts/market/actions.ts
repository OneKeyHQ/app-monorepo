import { useRef } from 'react';

import { cloneDeep } from 'lodash';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ContextJotaiActionsBase } from '@onekeyhq/kit/src/states/jotai/utils/ContextJotaiActionsBase';
import { memoFn } from '@onekeyhq/shared/src/utils/cacheUtils';
import marketUtils from '@onekeyhq/shared/src/utils/marketUtils';
import type { IMarketWatchListItem } from '@onekeyhq/shared/types/market';

import { contextAtomMethod, marketWatchListAtom } from './atoms';

export const homeResettingFlags: Record<string, number> = {};

class ContextJotaiActionsMarket extends ContextJotaiActionsBase {
  flushWatchListAtom = contextAtomMethod(
    (_, set, payload: IMarketWatchListItem[]) => {
      const result = { data: payload };
      set(marketWatchListAtom(), result);
    },
  );

  refreshWatchList = contextAtomMethod(async (get, set) => {
    const data = await backgroundApiProxy.serviceMarket.getMarketWatchList();
    return this.flushWatchListAtom.call(set, data.data);
  });

  isInWatchList = contextAtomMethod((get, set, coingeckoId: string) => {
    const prev = get(marketWatchListAtom());
    return !!prev.data?.find((i) => i.coingeckoId === coingeckoId);
  });

  addIntoWatchList = contextAtomMethod(
    async (
      get,
      set,
      payload: IMarketWatchListItem | IMarketWatchListItem[],
    ) => {
      const params: IMarketWatchListItem[] = !Array.isArray(payload)
        ? [payload]
        : payload;
      const prev = get(marketWatchListAtom());
      if (!prev.isMounted) {
        return;
      }
      await backgroundApiProxy.serviceMarket.addMarketWatchList({
        watchList: params,
      });
      await this.refreshWatchList.call(set);
    },
  );

  removeFormWatchList = contextAtomMethod(
    (get, set, payload: IMarketWatchListItem) => {
      const prev = get(marketWatchListAtom());
      if (!prev.isMounted) {
        return;
      }
      const watchList = prev.data.filter(
        (i) => i.coingeckoId !== payload.coingeckoId,
      );
      this.flushWatchListAtom.call(set, watchList);
      void backgroundApiProxy.serviceMarket.removeMarketWatchList({
        watchList: [payload],
      });
    },
  );

  sortWatchListItems = contextAtomMethod(
    async (
      get,
      set,
      payload: {
        target: IMarketWatchListItem;
        prev: IMarketWatchListItem | undefined;
        next: IMarketWatchListItem | undefined;
      },
    ) => {
      const { target, prev, next } = payload;
      const oldItemsResult = get(marketWatchListAtom());
      if (!oldItemsResult.isMounted) {
        return;
      }

      let newSortIndex = target?.sortIndex ?? 100_000;
      if (prev && !next) {
        newSortIndex = (prev.sortIndex ?? newSortIndex) + 1;
      } else {
        newSortIndex =
          ((prev?.sortIndex ?? newSortIndex - 1) +
            (next?.sortIndex ?? newSortIndex + 1)) /
          2;
      }

      const watchList = [
        cloneDeep({
          ...target,
          sortIndex: newSortIndex,
        }),
      ];

      const newList = marketUtils.buildSortedMarketWatchList({
        oldList: oldItemsResult.data,
        addWatchListItems: watchList,
      });
      this.flushWatchListAtom.call(set, newList);

      await backgroundApiProxy.serviceMarket.addMarketWatchList({
        watchList,
      });
      await this.refreshWatchList.call(set);
    },
  );

  moveToTop = contextAtomMethod((get, set, payload: IMarketWatchListItem) => {
    const prev = get(marketWatchListAtom());
    if (!prev.isMounted) {
      return;
    }
    const newItems = prev.data.filter(
      (i) => i.coingeckoId !== payload.coingeckoId,
    );
    const watchList = [payload, ...newItems];
    this.flushWatchListAtom.call(set, watchList);
  });

  saveWatchList = contextAtomMethod(
    (get, set, payload: IMarketWatchListItem[]) => {
      void this.addIntoWatchList.call(set, payload);
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
  const saveWatchList = actions.saveWatchList.use();
  const refreshWatchList = actions.refreshWatchList.use();
  const sortWatchListItems = actions.sortWatchListItems.use();
  return useRef({
    isInWatchList,
    addIntoWatchList,
    removeFormWatchList,
    moveToTop,
    saveWatchList,
    refreshWatchList,
    sortWatchListItems,
  });
}

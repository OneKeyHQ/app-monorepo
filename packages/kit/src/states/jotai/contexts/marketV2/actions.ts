import { useRef } from 'react';

import { cloneDeep } from 'lodash';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ContextJotaiActionsBase } from '@onekeyhq/kit/src/states/jotai/utils/ContextJotaiActionsBase';
import { memoFn } from '@onekeyhq/shared/src/utils/cacheUtils';
import sortUtils from '@onekeyhq/shared/src/utils/sortUtils';
import type { IMarketWatchListItemV2 } from '@onekeyhq/shared/types/market';
import type { IMarketTokenDetail } from '@onekeyhq/shared/types/marketV2';

import {
  contextAtomMethod,
  marketWatchListV2Atom,
  networkIdAtom,
  tokenAddressAtom,
  tokenDetailAtom,
  tokenDetailLoadingAtom,
} from './atoms';

export const homeResettingFlags: Record<string, number> = {};

class ContextJotaiActionsMarketV2 extends ContextJotaiActionsBase {
  // Token Detail Actions
  setTokenDetail = contextAtomMethod(
    (_, set, payload: IMarketTokenDetail | undefined) => {
      set(tokenDetailAtom(), payload);
    },
  );

  setTokenDetailLoading = contextAtomMethod((_, set, payload: boolean) => {
    set(tokenDetailLoadingAtom(), payload);
  });

  setTokenAddress = contextAtomMethod((_, set, payload: string) => {
    set(tokenAddressAtom(), payload);
  });

  setNetworkId = contextAtomMethod((_, set, payload: string) => {
    set(networkIdAtom(), payload);
  });

  fetchTokenDetail = contextAtomMethod(
    async (_, set, tokenAddress: string, networkId: string) => {
      try {
        set(tokenDetailLoadingAtom(), true);

        const response =
          await backgroundApiProxy.serviceMarketV2.fetchMarketTokenDetailByTokenAddress(
            tokenAddress,
            networkId,
          );

        set(tokenDetailAtom(), response);
        return response;
      } catch (error) {
        console.error('Failed to fetch token detail:', error);
        set(tokenDetailAtom(), undefined);
        throw error;
      } finally {
        set(tokenDetailLoadingAtom(), false);
      }
    },
  );

  // Existing WatchList Actions
  flushWatchListV2Atom = contextAtomMethod(
    (_, set, payload: IMarketWatchListItemV2[]) => {
      const result = { data: payload };
      set(marketWatchListV2Atom(), result);
    },
  );

  refreshWatchListV2 = contextAtomMethod(async (get, set) => {
    const data =
      await backgroundApiProxy.serviceMarketV2.getMarketWatchListV2();
    return this.flushWatchListV2Atom.call(set, data.data);
  });

  isInWatchListV2 = contextAtomMethod(
    (get, set, chainId: string, contractAddress: string) => {
      const prev = get(marketWatchListV2Atom());
      return !!prev.data?.find(
        (i) => i.chainId === chainId && i.contractAddress === contractAddress,
      );
    },
  );

  addIntoWatchListV2 = contextAtomMethod(
    async (
      get,
      set,
      payload: IMarketWatchListItemV2 | IMarketWatchListItemV2[],
    ) => {
      const params: IMarketWatchListItemV2[] = !Array.isArray(payload)
        ? [payload]
        : payload;
      const prev = get(marketWatchListV2Atom());
      if (!prev.isMounted) {
        return;
      }
      await backgroundApiProxy.serviceMarketV2.addMarketWatchListV2({
        watchList: params,
      });
      await this.refreshWatchListV2.call(set);
    },
  );

  removeFromWatchListV2 = contextAtomMethod(
    async (get, set, chainId: string, contractAddress: string) => {
      const prev = get(marketWatchListV2Atom());
      if (!prev.isMounted) {
        return;
      }
      await backgroundApiProxy.serviceMarketV2.removeMarketWatchListV2({
        items: [{ chainId, contractAddress }],
      });
      await this.refreshWatchListV2.call(set);
    },
  );

  sortWatchListV2Items = contextAtomMethod(
    async (
      get,
      set,
      payload: {
        target: IMarketWatchListItemV2;
        prev: IMarketWatchListItemV2 | undefined;
        next: IMarketWatchListItemV2 | undefined;
      },
    ) => {
      const { target, prev, next } = payload;
      const oldItemsResult = get(marketWatchListV2Atom());
      if (!oldItemsResult.isMounted) {
        return;
      }

      const newSortIndex = sortUtils.buildNewSortIndex({
        target,
        prev,
        next,
      });

      const watchList = [
        cloneDeep({
          ...target,
          sortIndex: newSortIndex,
        }),
      ];

      const newList = sortUtils.buildSortedList({
        oldList: oldItemsResult.data,
        saveItems: watchList,
        uniqByFn: (i) => `${i.chainId}:${i.contractAddress}`,
      });
      this.flushWatchListV2Atom.call(set, newList);

      await backgroundApiProxy.serviceMarketV2.addMarketWatchListV2({
        watchList,
      });
      await this.refreshWatchListV2.call(set);
    },
  );

  moveToTopV2 = contextAtomMethod(
    async (get, set, chainId: string, contractAddress: string) => {
      const prev = get(marketWatchListV2Atom());
      if (!prev.isMounted) {
        return;
      }
      const target = prev.data.find(
        (item) =>
          item.chainId === chainId && item.contractAddress === contractAddress,
      );
      if (!target) {
        return;
      }
      await this.sortWatchListV2Items.call(set, {
        target,
        prev: undefined,
        next: prev?.data?.[0],
      });
    },
  );

  saveWatchListV2 = contextAtomMethod(
    (get, set, payload: IMarketWatchListItemV2[]) => {
      void this.addIntoWatchListV2.call(set, payload);
    },
  );
}

const createActions = memoFn(() => new ContextJotaiActionsMarketV2());

export function useWatchListV2Actions() {
  const actions = createActions();
  const addIntoWatchListV2 = actions.addIntoWatchListV2.use();
  const removeFromWatchListV2 = actions.removeFromWatchListV2.use();
  const moveToTopV2 = actions.moveToTopV2.use();
  const isInWatchListV2 = actions.isInWatchListV2.use();
  const saveWatchListV2 = actions.saveWatchListV2.use();
  const refreshWatchListV2 = actions.refreshWatchListV2.use();
  const sortWatchListV2Items = actions.sortWatchListV2Items.use();
  return useRef({
    isInWatchListV2,
    addIntoWatchListV2,
    removeFromWatchListV2,
    moveToTopV2,
    saveWatchListV2,
    refreshWatchListV2,
    sortWatchListV2Items,
  });
}

export function useTokenDetailActions() {
  const actions = createActions();
  const setTokenDetail = actions.setTokenDetail.use();
  const setTokenDetailLoading = actions.setTokenDetailLoading.use();
  const setTokenAddress = actions.setTokenAddress.use();
  const setNetworkId = actions.setNetworkId.use();
  const fetchTokenDetail = actions.fetchTokenDetail.use();

  return useRef({
    setTokenDetail,
    setTokenDetailLoading,
    setTokenAddress,
    setNetworkId,
    fetchTokenDetail,
  });
}

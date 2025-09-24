import { useRef } from 'react';

import { cloneDeep } from 'lodash';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ContextJotaiActionsBase } from '@onekeyhq/kit/src/states/jotai/utils/ContextJotaiActionsBase';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { memoFn } from '@onekeyhq/shared/src/utils/cacheUtils';
import sortUtils from '@onekeyhq/shared/src/utils/sortUtils';
import {
  equalTokenNoCaseSensitive,
  normalizeTokenContractAddress,
} from '@onekeyhq/shared/src/utils/tokenUtils';
import type { IMarketWatchListItemV2 } from '@onekeyhq/shared/types/market';
import type {
  IMarketTokenDetail,
  IMarketTokenDetailResponse,
  IMarketTokenDetailWebsocket,
} from '@onekeyhq/shared/types/marketV2';

import {
  contextAtomMethod,
  marketWatchListV2Atom,
  networkIdAtom,
  showWatchlistOnlyAtom,
  tokenAddressAtom,
  tokenDetailAtom,
  tokenDetailLoadingAtom,
  tokenDetailWebsocketAtom,
} from './atoms';

export const homeResettingFlags: Record<string, number> = {};

const uniqByFn = (i: IMarketWatchListItemV2) =>
  `${i.chainId}:${
    normalizeTokenContractAddress({
      networkId: i.chainId,
      contractAddress: i.contractAddress,
    }) || ''
  }`;

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

  setTokenDetailWebsocket = contextAtomMethod(
    (_, set, payload: IMarketTokenDetailWebsocket | undefined) => {
      set(tokenDetailWebsocketAtom(), payload);
    },
  );

  clearTokenDetail = contextAtomMethod((_, set) => {
    set(tokenDetailAtom(), undefined);
    set(tokenDetailLoadingAtom(), false);
    set(tokenAddressAtom(), '');
    set(networkIdAtom(), '');
    set(tokenDetailWebsocketAtom(), undefined);
  });

  // ShowWatchlistOnly Actions
  setShowWatchlistOnly = contextAtomMethod((_, set, payload: boolean) => {
    set(showWatchlistOnlyAtom(), payload);
    // Emit app event when showWatchlistOnly changes
    appEventBus.emit(EAppEventBusNames.MarketWatchlistOnlyChanged, {
      showWatchlistOnly: payload,
    });
  });

  toggleShowWatchlistOnly = contextAtomMethod((get, set) => {
    const current = get(showWatchlistOnlyAtom());
    const newValue = !current;
    set(showWatchlistOnlyAtom(), newValue);
    // Emit app event when showWatchlistOnly changes
    appEventBus.emit(EAppEventBusNames.MarketWatchlistOnlyChanged, {
      showWatchlistOnly: newValue,
    });
  });

  fetchTokenDetail = contextAtomMethod(
    async (get, set, tokenAddress: string, networkId: string) => {
      try {
        set(tokenDetailLoadingAtom(), true);

        const response =
          await backgroundApiProxy.serviceMarketV2.fetchMarketTokenDetailByTokenAddress(
            tokenAddress,
            networkId,
          );

        // Assume new format with data.token and data.websocket
        const responseData = response as unknown as IMarketTokenDetailResponse;

        if (
          typeof responseData?.data?.token?.name === 'undefined' ||
          responseData.data.token.name === ''
        ) {
          console.warn('Token detail is not available');
          return;
        }

        // Extract token and websocket data from new response format
        const tokenData = responseData.data.token;
        const websocketConfig = responseData.data.websocket;

        // Always preserve K-line updated price if it exists, fallback to API price
        const currentTokenDetail = get(tokenDetailAtom());
        const hasKLinePrice = currentTokenDetail?.lastUpdated;

        const finalTokenData = hasKLinePrice
          ? {
              ...tokenData,
              price: currentTokenDetail.price, // Always use K-line price
              lastUpdated: currentTokenDetail.lastUpdated,
            }
          : tokenData;

        set(tokenDetailAtom(), finalTokenData);
        set(tokenDetailWebsocketAtom(), websocketConfig);

        return finalTokenData;
      } catch (error) {
        console.error('Failed to fetch token detail:', error);
        set(tokenDetailAtom(), undefined);
        set(tokenDetailWebsocketAtom(), undefined);
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

  // ------------------------------------------------------------
  refreshWatchListV2 = contextAtomMethod(async (_get, set) => {
    const data =
      await backgroundApiProxy.serviceMarketV2.getMarketWatchListV2();
    return this.flushWatchListV2Atom.call(set, data.data);
  });

  isInWatchListV2 = contextAtomMethod(
    (get, _set, chainId: string, contractAddress: string) => {
      const prev = get(marketWatchListV2Atom());
      return !!prev.data?.find((i) =>
        equalTokenNoCaseSensitive({
          token1: { networkId: chainId, contractAddress },
          token2: { networkId: i.chainId, contractAddress: i.contractAddress },
        }),
      );
    },
  );

  addIntoWatchListV2 = contextAtomMethod(
    async (
      get,
      set,
      payload: IMarketWatchListItemV2 | IMarketWatchListItemV2[],
    ) => {
      let params: IMarketWatchListItemV2[] = !Array.isArray(payload)
        ? [payload]
        : payload;
      params = params.map((item) => ({
        ...item,
        contractAddress:
          normalizeTokenContractAddress({
            networkId: item.chainId,
            contractAddress: item.contractAddress,
          }) || '',
      }));
      const prev = get(marketWatchListV2Atom());
      if (!prev.isMounted) {
        return;
      }

      // Immediately update local state with proper sorting
      const sortedNewData = sortUtils.buildSortedList({
        oldList: prev.data,
        saveItems: params,
        uniqByFn,
      });
      set(marketWatchListV2Atom(), { ...prev, data: sortedNewData });

      // Asynchronously call API without waiting for result
      await backgroundApiProxy.serviceMarketV2.addMarketWatchListV2({
        watchList: params,
        callerName: 'jotaiContextActions_addIntoWatchListV2',
      });
      await this.refreshWatchListV2.call(set);
    },
  );

  removeFromWatchListV2 = contextAtomMethod(
    async (get, set, chainId: string, contractAddress: string) => {
      // eslint-disable-next-line no-param-reassign
      contractAddress =
        normalizeTokenContractAddress({
          networkId: chainId,
          contractAddress,
        }) || '';
      const prev = get(marketWatchListV2Atom());
      if (!prev.isMounted) {
        return;
      }

      // Immediately update local state using proper token matching
      const newData = prev.data.filter(
        (item) =>
          !equalTokenNoCaseSensitive({
            token1: { networkId: chainId, contractAddress },
            token2: {
              networkId: item.chainId,
              contractAddress: item.contractAddress,
            },
          }),
      );
      set(marketWatchListV2Atom(), { ...prev, data: newData });

      // Asynchronously call API without waiting for result
      await backgroundApiProxy.serviceMarketV2.removeMarketWatchListV2({
        items: [{ chainId, contractAddress }],
        callerName: 'jotaiContextActions_removeFromWatchListV2',
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
        uniqByFn,
      });
      this.flushWatchListV2Atom.call(set, newList);

      await backgroundApiProxy.serviceMarketV2.addMarketWatchListV2({
        watchList,
        callerName: 'jotaiContextActions_sortWatchListV2Items',
      });
      await this.refreshWatchListV2.call(set);
    },
  );

  saveWatchListV2 = contextAtomMethod(
    async (_get, set, payload: IMarketWatchListItemV2[]) => {
      await this.addIntoWatchListV2.call(set, payload);
    },
  );

  clearAllWatchListV2 = contextAtomMethod(async (get, set) => {
    const prev = get(marketWatchListV2Atom());
    if (!prev.isMounted) {
      return;
    }

    // Immediately update local state
    set(marketWatchListV2Atom(), { ...prev, data: [] });

    // Asynchronously call API without waiting for result
    await backgroundApiProxy.serviceMarketV2.clearAllMarketWatchListV2();
  });
}

const createActions = memoFn(() => new ContextJotaiActionsMarketV2());

export function useWatchListV2Actions() {
  const actions = createActions();
  const addIntoWatchListV2 = actions.addIntoWatchListV2.use();
  const removeFromWatchListV2 = actions.removeFromWatchListV2.use();
  const isInWatchListV2 = actions.isInWatchListV2.use();
  const saveWatchListV2 = actions.saveWatchListV2.use();
  const refreshWatchListV2 = actions.refreshWatchListV2.use();
  const sortWatchListV2Items = actions.sortWatchListV2Items.use();
  const clearAllWatchListV2 = actions.clearAllWatchListV2.use();
  return useRef({
    isInWatchListV2,
    addIntoWatchListV2,
    removeFromWatchListV2,
    saveWatchListV2,
    refreshWatchListV2,
    sortWatchListV2Items,
    clearAllWatchListV2,
  });
}

export function useTokenDetailActions() {
  const actions = createActions();
  const setTokenDetail = actions.setTokenDetail.use();
  const setTokenDetailLoading = actions.setTokenDetailLoading.use();
  const setTokenAddress = actions.setTokenAddress.use();
  const setNetworkId = actions.setNetworkId.use();
  const setTokenDetailWebsocket = actions.setTokenDetailWebsocket.use();
  const fetchTokenDetail = actions.fetchTokenDetail.use();
  const clearTokenDetail = actions.clearTokenDetail.use();

  return useRef({
    setTokenDetail,
    setTokenDetailLoading,
    setTokenAddress,
    setNetworkId,
    setTokenDetailWebsocket,
    fetchTokenDetail,
    clearTokenDetail,
  });
}

export function useShowWatchlistOnlyActions() {
  const actions = createActions();
  const setShowWatchlistOnly = actions.setShowWatchlistOnly.use();
  const toggleShowWatchlistOnly = actions.toggleShowWatchlistOnly.use();

  return useRef({
    setShowWatchlistOnly,
    toggleShowWatchlistOnly,
  });
}

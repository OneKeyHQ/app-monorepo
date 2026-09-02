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
  IMarketPerpsInfo,
  IMarketTokenDetail,
  IMarketTokenDetailPreview,
  IMarketTokenDetailResponse,
  IMarketTokenDetailWebsocket,
} from '@onekeyhq/shared/types/marketV2';
import { ERookieTaskType } from '@onekeyhq/shared/types/rookieGuide';

import {
  contextAtomMethod,
  isNativeAtom,
  marketWatchListV2Atom,
  networkIdAtom,
  perpsInfoAtom,
  showWatchlistOnlyAtom,
  tokenAddressAtom,
  tokenDetailAtom,
  tokenDetailLoadingAtom,
  tokenDetailPreviewAtom,
  tokenDetailWebsocketAtom,
} from './atoms';

export const homeResettingFlags: Record<string, number> = {};

const uniqByFn = (i: IMarketWatchListItemV2) =>
  i.perpsCoin
    ? `perps:${i.perpsCoin}`
    : `${i.chainId}:${
        normalizeTokenContractAddress({
          networkId: i.chainId,
          contractAddress: i.contractAddress,
        }) || ''
      }`;

let watchListQueue: Promise<unknown> = Promise.resolve();
const watchOps = new Set<string>();

function runWatchOp<T>(keys: string[], mutation: () => Promise<T>) {
  keys.forEach((key) => watchOps.add(key));
  const run = () =>
    mutation().finally(() => keys.forEach((key) => watchOps.delete(key)));
  const result = watchListQueue.then(run, run);
  watchListQueue = result.catch(() => undefined);
  return result;
}

const CHART_TTL = 10_000;

function isSameTokenDetail({
  tokenDetail,
  tokenAddress,
  networkId,
}: {
  tokenDetail?: IMarketTokenDetail;
  tokenAddress: string;
  networkId: string;
}) {
  if (!tokenDetail) {
    return false;
  }

  return equalTokenNoCaseSensitive({
    token1: {
      networkId,
      contractAddress: tokenAddress,
    },
    token2: {
      networkId,
      contractAddress: tokenDetail.address || '',
    },
  });
}

class ContextJotaiActionsMarketV2 extends ContextJotaiActionsBase {
  setTokenDetail = contextAtomMethod(
    (_, set, payload: IMarketTokenDetail | undefined) => {
      set(tokenDetailAtom(), payload);
    },
  );

  setTokenDetailLoading = contextAtomMethod((_, set, payload: boolean) => {
    set(tokenDetailLoadingAtom(), payload);
  });

  setTokenDetailPreview = contextAtomMethod(
    (_, set, payload: IMarketTokenDetailPreview | undefined) => {
      set(tokenDetailPreviewAtom(), payload);
      if (!payload) {
        return;
      }
      set(tokenAddressAtom(), payload.address);
      set(networkIdAtom(), payload.networkId);
      set(isNativeAtom(), Boolean(payload.isNative));
    },
  );

  prepareTokenDetailPreview = contextAtomMethod(
    (_, set, payload: IMarketTokenDetailPreview | undefined) => {
      set(tokenDetailAtom(), undefined);
      set(tokenDetailPreviewAtom(), payload);
      set(tokenDetailLoadingAtom(), false);
      set(tokenDetailWebsocketAtom(), undefined);
      set(perpsInfoAtom(), undefined);

      if (!payload) {
        set(tokenAddressAtom(), '');
        set(networkIdAtom(), '');
        set(isNativeAtom(), false);
        return;
      }

      set(tokenAddressAtom(), payload.address);
      set(networkIdAtom(), payload.networkId);
      set(isNativeAtom(), Boolean(payload.isNative));
    },
  );

  clearTokenDetailPreview = contextAtomMethod((_, set) => {
    set(tokenDetailPreviewAtom(), undefined);
  });

  setTokenAddress = contextAtomMethod((_, set, payload: string) => {
    set(tokenAddressAtom(), payload);
  });

  setNetworkId = contextAtomMethod((_, set, payload: string) => {
    set(networkIdAtom(), payload);
  });

  setIsNative = contextAtomMethod((_, set, payload: boolean) => {
    set(isNativeAtom(), payload);
  });

  setTokenDetailWebsocket = contextAtomMethod(
    (_, set, payload: IMarketTokenDetailWebsocket | undefined) => {
      set(tokenDetailWebsocketAtom(), payload);
    },
  );

  setPerpsInfo = contextAtomMethod(
    (_, set, payload: IMarketPerpsInfo | undefined) => {
      set(perpsInfoAtom(), payload);
    },
  );

  clearTokenDetail = contextAtomMethod((_, set) => {
    set(tokenDetailAtom(), undefined);
    set(tokenDetailPreviewAtom(), undefined);
    set(tokenDetailLoadingAtom(), false);
    set(tokenAddressAtom(), '');
    set(networkIdAtom(), '');
    set(isNativeAtom(), false);
    set(tokenDetailWebsocketAtom(), undefined);
    set(perpsInfoAtom(), undefined);
  });

  applyChartPriceUpdate = contextAtomMethod(
    (
      get,
      set,
      payload: {
        tokenAddress?: string;
        networkId?: string;
        price: string;
        lastUpdated?: number;
      },
    ) => {
      const tokenDetail = get(tokenDetailAtom());
      if (!tokenDetail) {
        return;
      }

      const numericPrice = Number(payload.price);
      if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
        return;
      }

      if (
        payload.networkId &&
        tokenDetail.networkId &&
        tokenDetail.networkId !== payload.networkId
      ) {
        return;
      }

      const isNative = get(isNativeAtom()) || tokenDetail.isNative;
      if (!payload.tokenAddress && !isNative) {
        return;
      }

      if (
        payload.tokenAddress &&
        !equalTokenNoCaseSensitive({
          token1: {
            networkId: payload.networkId || tokenDetail.networkId || '',
            contractAddress: payload.tokenAddress,
          },
          token2: {
            networkId: tokenDetail.networkId || payload.networkId || '',
            contractAddress: tokenDetail.address || '',
          },
        })
      ) {
        return;
      }

      const chartPriceUpdatedAt = Date.now();
      const lastUpdated =
        payload.lastUpdated ?? tokenDetail.lastUpdated ?? chartPriceUpdatedAt;

      if (tokenDetail.price === payload.price) {
        set(tokenDetailAtom(), {
          ...tokenDetail,
          lastUpdated,
          chartPriceUpdatedAt,
        });
        return;
      }

      set(tokenDetailAtom(), {
        ...tokenDetail,
        price: payload.price,
        lastUpdated,
        chartPriceUpdatedAt,
      });
    },
  );

  changeActiveToken = contextAtomMethod(
    async (
      get,
      set,
      payload: {
        tokenAddress: string;
        networkId: string;
        isNative: boolean;
        tokenDetailPreview?: IMarketTokenDetailPreview;
      },
    ) => {
      const { tokenAddress, networkId, isNative, tokenDetailPreview } = payload;
      const nextPreview =
        tokenDetailPreview?.address === tokenAddress &&
        tokenDetailPreview.networkId === networkId
          ? tokenDetailPreview
          : undefined;
      set(tokenDetailAtom(), undefined);
      set(tokenDetailPreviewAtom(), nextPreview);
      set(tokenDetailWebsocketAtom(), undefined);
      set(perpsInfoAtom(), undefined);
      set(tokenAddressAtom(), tokenAddress);
      set(networkIdAtom(), networkId);
      set(isNativeAtom(), isNative);

      let isStale = false;
      try {
        set(tokenDetailLoadingAtom(), true);
        const response =
          await backgroundApiProxy.serviceMarketV2.fetchMarketTokenDetailByTokenAddress(
            tokenAddress,
            networkId,
          );

        const currentAddress = get(tokenAddressAtom());
        const currentNetworkId = get(networkIdAtom());
        if (currentAddress !== tokenAddress || currentNetworkId !== networkId) {
          isStale = true;
          return;
        }

        const responseData = response as unknown as IMarketTokenDetailResponse;
        if (
          typeof responseData?.data?.token?.name === 'undefined' ||
          responseData.data.token.name === ''
        ) {
          set(tokenDetailAtom(), undefined);
          set(tokenDetailPreviewAtom(), undefined);
          set(tokenDetailWebsocketAtom(), undefined);
          set(perpsInfoAtom(), undefined);
          return;
        }
        set(tokenDetailAtom(), responseData.data.token);
        set(tokenDetailPreviewAtom(), undefined);
        set(tokenDetailWebsocketAtom(), responseData.data.websocket);
        set(perpsInfoAtom(), responseData.data.perpsInfo);
      } catch (error) {
        console.error('Failed to fetch token detail:', error);
        const currentAddress = get(tokenAddressAtom());
        const currentNetworkId = get(networkIdAtom());
        if (currentAddress !== tokenAddress || currentNetworkId !== networkId) {
          isStale = true;
        } else {
          set(tokenDetailAtom(), undefined);
          set(tokenDetailPreviewAtom(), undefined);
          set(tokenDetailWebsocketAtom(), undefined);
          set(perpsInfoAtom(), undefined);
        }
      } finally {
        if (!isStale) {
          set(tokenDetailLoadingAtom(), false);
        }
      }
    },
  );

  setShowWatchlistOnly = contextAtomMethod((_, set, payload: boolean) => {
    set(showWatchlistOnlyAtom(), payload);
    appEventBus.emit(EAppEventBusNames.MarketWatchlistOnlyChanged, {
      showWatchlistOnly: payload,
    });
  });

  toggleShowWatchlistOnly = contextAtomMethod((get, set) => {
    const current = get(showWatchlistOnlyAtom());
    const newValue = !current;
    set(showWatchlistOnlyAtom(), newValue);
    appEventBus.emit(EAppEventBusNames.MarketWatchlistOnlyChanged, {
      showWatchlistOnly: newValue,
    });
  });

  fetchTokenDetail = contextAtomMethod(
    async (get, set, tokenAddress: string, networkId: string) => {
      let isStale = false;
      try {
        set(tokenDetailLoadingAtom(), true);

        const response =
          await backgroundApiProxy.serviceMarketV2.fetchMarketTokenDetailByTokenAddress(
            tokenAddress,
            networkId,
          );

        const currentAddress = get(tokenAddressAtom());
        const currentNetworkId = get(networkIdAtom());
        if (currentAddress !== tokenAddress && currentAddress !== '') {
          isStale = true;
          return;
        }
        if (currentNetworkId !== networkId && currentNetworkId !== '') {
          isStale = true;
          return;
        }

        const responseData = response as unknown as IMarketTokenDetailResponse;

        const currentTokenDetail = get(tokenDetailAtom());

        if (
          typeof responseData?.data?.token?.name === 'undefined' ||
          responseData.data.token.name === ''
        ) {
          if (
            isSameTokenDetail({
              tokenDetail: currentTokenDetail,
              tokenAddress,
              networkId,
            })
          ) {
            console.warn(
              'Token detail is not available, keep current token detail',
            );
            return currentTokenDetail;
          }

          console.warn('Token detail is not available');
          set(tokenDetailAtom(), undefined);
          set(tokenDetailPreviewAtom(), undefined);
          set(tokenDetailWebsocketAtom(), undefined);
          set(perpsInfoAtom(), undefined);
          return;
        }

        const tokenData = responseData.data.token;
        const websocketConfig = responseData.data.websocket;
        const perpsInfo = responseData.data.perpsInfo;

        const isSameToken =
          currentTokenDetail &&
          isSameTokenDetail({
            tokenDetail: currentTokenDetail,
            tokenAddress,
            networkId,
          });
        const chartPriceUpdatedAt = currentTokenDetail?.chartPriceUpdatedAt;
        const hasFreshKLinePrice =
          isSameToken &&
          typeof chartPriceUpdatedAt === 'number' &&
          Number.isFinite(chartPriceUpdatedAt) &&
          Date.now() - chartPriceUpdatedAt < CHART_TTL;

        const finalTokenData = hasFreshKLinePrice
          ? {
              ...tokenData,
              price: currentTokenDetail.price,
              lastUpdated: currentTokenDetail.lastUpdated,
              chartPriceUpdatedAt,
            }
          : tokenData;

        set(tokenDetailAtom(), finalTokenData);
        set(tokenDetailPreviewAtom(), undefined);
        set(tokenDetailWebsocketAtom(), websocketConfig);
        set(perpsInfoAtom(), perpsInfo);

        return finalTokenData;
      } catch (error) {
        console.error('Failed to fetch token detail:', error);
        const currentAddress = get(tokenAddressAtom());
        const currentNetworkId = get(networkIdAtom());
        if (
          (currentAddress === tokenAddress || currentAddress === '') &&
          (currentNetworkId === networkId || currentNetworkId === '')
        ) {
          set(tokenDetailAtom(), undefined);
          set(tokenDetailPreviewAtom(), undefined);
          set(tokenDetailWebsocketAtom(), undefined);
          set(perpsInfoAtom(), undefined);
        } else {
          isStale = true;
        }
        throw error;
      } finally {
        if (!isStale) {
          set(tokenDetailLoadingAtom(), false);
        }
      }
    },
  );

  flushWatchListV2Atom = contextAtomMethod(
    (_, set, payload: IMarketWatchListItemV2[]) => {
      const result = { data: payload };
      set(marketWatchListV2Atom(), result);
    },
  );

  refreshWatchListV2 = contextAtomMethod(async (_get, set) => {
    const data =
      await backgroundApiProxy.serviceMarketV2.getMarketWatchListV2();
    if (watchOps.size) {
      return;
    }
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

      params = params.filter((item) => !watchOps.has(uniqByFn(item)));
      if (!params.length) {
        return;
      }
      const prevKeys = new Set(prev.data.map(uniqByFn));
      const newKeys = new Set(
        params.filter((item) => !prevKeys.has(uniqByFn(item))).map(uniqByFn),
      );
      const keys = params.map(uniqByFn);
      const data = sortUtils.buildSortedList({
        oldList: prev.data,
        saveItems: params,
        uniqByFn,
      });
      set(marketWatchListV2Atom(), { ...prev, data });

      await runWatchOp(keys, async () => {
        try {
          await backgroundApiProxy.serviceMarketV2.addMarketWatchListV2({
            watchList: params,
            callerName: 'jotaiContextActions_addIntoWatchListV2',
          });
        } catch (error) {
          const current = get(marketWatchListV2Atom());
          set(marketWatchListV2Atom(), {
            ...current,
            data: current.data.filter((item) => !newKeys.has(uniqByFn(item))),
          });
          throw error;
        }
      });
      if (!watchOps.size) {
        await this.refreshWatchListV2.call(set).catch(() => undefined);
      }
      void backgroundApiProxy.serviceRookieGuide.recordTaskCompleted(
        ERookieTaskType.MARKET,
      );
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

      const key = uniqByFn({ chainId, contractAddress });
      if (watchOps.has(key)) {
        return;
      }
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

      await runWatchOp([key], async () => {
        try {
          await backgroundApiProxy.serviceMarketV2.removeMarketWatchListV2({
            items: [{ chainId, contractAddress }],
            callerName: 'jotaiContextActions_removeFromWatchListV2',
          });
        } catch (error) {
          const current = get(marketWatchListV2Atom());
          const data = sortUtils.buildSortedList({
            oldList: current.data,
            saveItems: prev.data.filter((item) => !newData.includes(item)),
            uniqByFn,
          });
          set(marketWatchListV2Atom(), { ...current, data });
          throw error;
        }
      });
      if (!watchOps.size) {
        await this.refreshWatchListV2.call(set).catch(() => undefined);
      }
    },
  );

  isPerpsInWatchListV2 = contextAtomMethod((get, _set, perpsCoin: string) => {
    const prev = get(marketWatchListV2Atom());
    return !!prev.data?.find((i) => i.perpsCoin === perpsCoin);
  });

  addPerpsIntoWatchListV2 = contextAtomMethod(
    async (get, set, perpsCoin: string) => {
      const prev = get(marketWatchListV2Atom());
      if (!prev.isMounted) {
        return;
      }

      const item: IMarketWatchListItemV2 = {
        chainId: '',
        contractAddress: '',
        perpsCoin,
      };

      const sortedNewData = sortUtils.buildSortedList({
        oldList: prev.data,
        saveItems: [item],
        uniqByFn,
      });
      set(marketWatchListV2Atom(), { ...prev, data: sortedNewData });

      await backgroundApiProxy.serviceMarketV2.addMarketWatchListV2({
        watchList: [item],
        callerName: 'jotaiContextActions_addPerpsIntoWatchListV2',
      });
      await this.refreshWatchListV2.call(set);

      void backgroundApiProxy.serviceMarketV2.syncToPerpsAtom({
        coin: perpsCoin,
        action: 'add',
      });
    },
  );

  removePerpsFromWatchListV2 = contextAtomMethod(
    async (get, set, perpsCoin: string) => {
      const prev = get(marketWatchListV2Atom());
      if (!prev.isMounted) {
        return;
      }

      const newData = prev.data.filter((item) => item.perpsCoin !== perpsCoin);
      set(marketWatchListV2Atom(), { ...prev, data: newData });

      await backgroundApiProxy.serviceMarketV2.removeMarketWatchListV2({
        items: [{ chainId: '', contractAddress: '', perpsCoin }],
        callerName: 'jotaiContextActions_removePerpsFromWatchListV2',
      });
      await this.refreshWatchListV2.call(set);

      void backgroundApiProxy.serviceMarketV2.syncToPerpsAtom({
        coin: perpsCoin,
        action: 'remove',
      });
    },
  );

  moveToTopV2 = contextAtomMethod(
    async (get, set, payload: IMarketWatchListItemV2) => {
      const prev = get(marketWatchListV2Atom());
      if (!prev.isMounted) {
        return;
      }
      const firstItem = prev?.data?.[0];
      if (firstItem) {
        if (payload.perpsCoin && firstItem.perpsCoin) {
          if (payload.perpsCoin === firstItem.perpsCoin) return;
        } else if (
          equalTokenNoCaseSensitive({
            token1: {
              networkId: firstItem.chainId,
              contractAddress: firstItem.contractAddress,
            },
            token2: {
              networkId: payload.chainId,
              contractAddress: payload.contractAddress,
            },
          })
        ) {
          return;
        }
      }
      await this.sortWatchListV2Items.call(set, {
        target: payload,
        prev: undefined,
        next: firstItem,
      });
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

      const resolveFromAtom = (
        item: IMarketWatchListItemV2 | undefined,
      ): IMarketWatchListItemV2 | undefined => {
        if (!item) return undefined;
        const key = uniqByFn(item);
        const found = oldItemsResult.data.find((i) => uniqByFn(i) === key);
        return found ?? item;
      };

      const resolvedTarget = resolveFromAtom(target)!;
      const resolvedPrev = resolveFromAtom(prev);
      const resolvedNext = resolveFromAtom(next);

      const newSortIndex = sortUtils.buildNewSortIndex({
        target: resolvedTarget,
        prev: resolvedPrev,
        next: resolvedNext,
      });

      const watchList = [
        cloneDeep({
          ...resolvedTarget,
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

    set(marketWatchListV2Atom(), { ...prev, data: [] });

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
  const moveToTopV2 = actions.moveToTopV2.use();
  const clearAllWatchListV2 = actions.clearAllWatchListV2.use();
  const isPerpsInWatchListV2 = actions.isPerpsInWatchListV2.use();
  const addPerpsIntoWatchListV2 = actions.addPerpsIntoWatchListV2.use();
  const removePerpsFromWatchListV2 = actions.removePerpsFromWatchListV2.use();
  return useRef({
    isInWatchListV2,
    addIntoWatchListV2,
    removeFromWatchListV2,
    saveWatchListV2,
    refreshWatchListV2,
    sortWatchListV2Items,
    moveToTopV2,
    clearAllWatchListV2,
    isPerpsInWatchListV2,
    addPerpsIntoWatchListV2,
    removePerpsFromWatchListV2,
  });
}

export function useTokenDetailActions() {
  const actions = createActions();
  const setTokenDetail = actions.setTokenDetail.use();
  const setTokenDetailLoading = actions.setTokenDetailLoading.use();
  const setTokenDetailPreview = actions.setTokenDetailPreview.use();
  const prepareTokenDetailPreview = actions.prepareTokenDetailPreview.use();
  const clearTokenDetailPreview = actions.clearTokenDetailPreview.use();
  const setTokenAddress = actions.setTokenAddress.use();
  const setNetworkId = actions.setNetworkId.use();
  const setIsNative = actions.setIsNative.use();
  const setTokenDetailWebsocket = actions.setTokenDetailWebsocket.use();
  const setPerpsInfo = actions.setPerpsInfo.use();
  const fetchTokenDetail = actions.fetchTokenDetail.use();
  const clearTokenDetail = actions.clearTokenDetail.use();
  const changeActiveToken = actions.changeActiveToken.use();
  const applyChartPriceUpdate = actions.applyChartPriceUpdate.use();

  return useRef({
    setTokenDetail,
    setTokenDetailLoading,
    setTokenDetailPreview,
    prepareTokenDetailPreview,
    clearTokenDetailPreview,
    setTokenAddress,
    setNetworkId,
    setIsNative,
    setTokenDetailWebsocket,
    setPerpsInfo,
    fetchTokenDetail,
    clearTokenDetail,
    changeActiveToken,
    applyChartPriceUpdate,
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

import { useCallback, useRef } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ContextJotaiActionsBase } from '@onekeyhq/kit/src/states/jotai/utils/ContextJotaiActionsBase';
import { memoFn } from '@onekeyhq/shared/src/utils/cacheUtils';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import type { IDiscoveryBanner } from '@onekeyhq/shared/types/discovery';
import type {
  EAvailableAssetsTypeEnum,
  IEarnPermitCache,
  IEarnPermitCacheKey,
} from '@onekeyhq/shared/types/earn';
import type {
  IAvailableAsset,
  IEarnAccountTokenResponse,
  IEarnAtomData,
  IRecommendAsset,
} from '@onekeyhq/shared/types/staking';

import {
  contextAtomMethod,
  earnAtom,
  earnLoadingStatesAtom,
  earnPermitCacheAtom,
} from './atoms';

export const homeResettingFlags: Record<string, number> = {};

class ContextJotaiActionsEarn extends ContextJotaiActionsBase {
  syncToDb = contextAtomMethod((get, set, payload: IEarnAtomData) => {
    const atom = earnAtom();
    if (!get(atom).isMounted) {
      return;
    }
    const data = {
      ...get(atom),
      ...payload,
    };
    void this.syncToJotai.call(set, data);
    void backgroundApiProxy.simpleDb.earn.setRawData(data);
  });

  syncToJotai = contextAtomMethod((get, set, payload: IEarnAtomData) => {
    const atom = earnAtom();
    if (!get(atom).isMounted) {
      return;
    }
    set(atom, payload);
  });

  getAvailableAssetsByType = contextAtomMethod(
    (get, set, type: EAvailableAssetsTypeEnum) => {
      const { availableAssetsByType } = get(earnAtom());
      return availableAssetsByType?.[type] || [];
    },
  );

  updateAvailableAssetsByType = contextAtomMethod(
    (
      get,
      set,
      type: EAvailableAssetsTypeEnum,
      availableAssets: IAvailableAsset[],
    ) => {
      const earnData = get(earnAtom());
      this.syncToDb.call(set, {
        availableAssetsByType: {
          ...earnData.availableAssetsByType,
          [type]: availableAssets,
        },
      });
    },
  );

  getEarnAccount = contextAtomMethod((get, set, key: string) => {
    const { earnAccount } = get(earnAtom());
    return earnAccount?.[key];
  });

  updateEarnAccounts = contextAtomMethod(
    (
      get,
      set,
      {
        key,
        earnAccount,
      }: {
        key: string;
        earnAccount: IEarnAccountTokenResponse;
      },
    ) => {
      const earnData = get(earnAtom());
      this.syncToDb.call(set, {
        earnAccount: {
          ...earnData.earnAccount,
          [key]: earnAccount,
        },
      });
    },
  );

  getPermitCache = contextAtomMethod(
    (get, set, keyPayload: IEarnPermitCacheKey) => {
      const permitCaches = get(earnPermitCacheAtom());
      const key = earnUtils.getEarnPermitCacheKey(keyPayload);

      const cache = permitCaches[key];
      if (!cache) {
        return null;
      }

      const now = Date.now();
      if (now < cache.expiredAt) {
        return cache;
      }

      // Remove expired cache
      set(earnPermitCacheAtom(), (prev) => {
        const newCache = { ...prev };
        delete newCache[key];
        return newCache;
      });
      return null;
    },
  );

  updatePermitCache = contextAtomMethod((_, set, payload: IEarnPermitCache) => {
    const key = earnUtils.getEarnPermitCacheKey(payload);
    set(earnPermitCacheAtom(), (prev: Record<string, IEarnPermitCache>) => ({
      ...prev,
      [key]: payload,
    }));
  });

  removePermitCache = contextAtomMethod(
    (_, set, keyPayload: IEarnPermitCacheKey) => {
      const key = earnUtils.getEarnPermitCacheKey(keyPayload);
      set(earnPermitCacheAtom(), (prev: Record<string, IEarnPermitCache>) => {
        const newCache = { ...prev };
        delete newCache[key];
        return newCache;
      });
    },
  );

  resetEarnCacheData = contextAtomMethod((_, set) => {
    this.syncToDb.call(set, {
      availableAssetsByType: {},
      earnAccount: {},
    });
  });

  triggerRefresh = contextAtomMethod((get, set) => {
    const earnData = get(earnAtom());
    this.syncToDb.call(set, {
      refreshTrigger: Number(earnData.refreshTrigger || 0) + 1,
    });
  });

  setLoadingState = contextAtomMethod(
    (get, set, key: string, isLoading: boolean) => {
      const loadingStates = get(earnLoadingStatesAtom());
      set(earnLoadingStatesAtom(), {
        ...loadingStates,
        [key]: isLoading,
      });
    },
  );

  getLoadingState = contextAtomMethod((get, set, key: string) => {
    const loadingStates = get(earnLoadingStatesAtom());
    return loadingStates[key] || false;
  });

  isDataIncomplete = contextAtomMethod((get, set, key: string) => {
    const loadingStates = get(earnLoadingStatesAtom());
    return loadingStates[key] || false;
  });

  getRecommendedTokens = contextAtomMethod((get, set) => {
    const { recommendedTokens } = get(earnAtom());
    return recommendedTokens || [];
  });

  updateRecommendedTokens = contextAtomMethod(
    (get, set, tokens: IRecommendAsset[]) => {
      this.syncToDb.call(set, {
        recommendedTokens: tokens,
      });
    },
  );

  getBanners = contextAtomMethod((get, set) => {
    const { banners } = get(earnAtom());
    return banners || [];
  });

  updateBanners = contextAtomMethod((get, set, banners: IDiscoveryBanner[]) => {
    this.syncToDb.call(set, {
      banners,
    });
  });
}

const createActions = memoFn(() => new ContextJotaiActionsEarn());

export function useEarnActions() {
  const actions = createActions();
  const getAvailableAssetsByType = actions.getAvailableAssetsByType.use();
  const updateAvailableAssetsByType = actions.updateAvailableAssetsByType.use();
  const updateEarnAccounts = actions.updateEarnAccounts.use();
  const getEarnAccount = actions.getEarnAccount.use();
  const getPermitCache = actions.getPermitCache.use();
  const updatePermitCache = actions.updatePermitCache.use();
  const removePermitCache = actions.removePermitCache.use();
  const triggerRefresh = actions.triggerRefresh.use();
  const setLoadingState = actions.setLoadingState.use();
  const getLoadingState = actions.getLoadingState.use();
  const isDataIncomplete = actions.isDataIncomplete.use();

  const buildEarnAccountsKey = useCallback(
    (params: {
      accountId?: string;
      indexAccountId?: string;
      networkId: string;
    }) => earnUtils.buildEarnAccountKey(params),
    [],
  );

  const getRecommendedTokens = actions.getRecommendedTokens.use();
  const updateRecommendedTokens = actions.updateRecommendedTokens.use();
  const getBanners = actions.getBanners.use();
  const updateBanners = actions.updateBanners.use();

  return useRef({
    getAvailableAssetsByType,
    updateAvailableAssetsByType,
    buildEarnAccountsKey,
    updateEarnAccounts,
    getEarnAccount,
    getPermitCache,
    updatePermitCache,
    removePermitCache,
    triggerRefresh,
    setLoadingState,
    getLoadingState,
    isDataIncomplete,
    getRecommendedTokens,
    updateRecommendedTokens,
    getBanners,
    updateBanners,
  });
}

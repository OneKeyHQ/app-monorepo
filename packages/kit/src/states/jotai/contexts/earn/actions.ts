import { useCallback, useRef } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ContextJotaiActionsBase } from '@onekeyhq/kit/src/states/jotai/utils/ContextJotaiActionsBase';
import { memoFn } from '@onekeyhq/shared/src/utils/cacheUtils';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import type {
  IEarnPermitCache,
  IEarnPermitCacheKey,
} from '@onekeyhq/shared/types/earn';
import type {
  IAvailableAsset,
  IEarnAccountTokenResponse,
  IEarnAtomData,
} from '@onekeyhq/shared/types/staking';

import { contextAtomMethod, earnAtom, earnPermitCacheAtom } from './atoms';

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
    set(atom, () => payload);
  });

  getAvailableAssets = contextAtomMethod((get) => {
    const { availableAssets } = get(earnAtom());
    return availableAssets || [];
  });

  updateAvailableAssets = contextAtomMethod(
    (_, set, availableAssets: IAvailableAsset[]) => {
      this.syncToDb.call(set, {
        availableAssets,
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
      availableAssets: [],
      earnAccount: {},
    });
  });
}

const createActions = memoFn(() => new ContextJotaiActionsEarn());

export function useEarnActions() {
  const actions = createActions();
  const getAvailableAssets = actions.getAvailableAssets.use();
  const updateAvailableAssets = actions.updateAvailableAssets.use();
  const updateEarnAccounts = actions.updateEarnAccounts.use();
  const getEarnAccount = actions.getEarnAccount.use();
  const getPermitCache = actions.getPermitCache.use();
  const updatePermitCache = actions.updatePermitCache.use();
  const removePermitCache = actions.removePermitCache.use();

  const buildEarnAccountsKey = useCallback(
    ({
      accountId,
      indexAccountId,
      networkId,
    }: {
      accountId?: string;
      indexAccountId?: string;
      networkId: string;
    }) => `${indexAccountId || accountId || ''}-${networkId}`,
    [],
  );

  return useRef({
    getAvailableAssets,
    updateAvailableAssets,
    buildEarnAccountsKey,
    updateEarnAccounts,
    getEarnAccount,
    getPermitCache,
    updatePermitCache,
    removePermitCache,
  });
}

import { useCallback, useEffect, useRef } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { prewarmPerpsTokenSelectorImages } from '@onekeyhq/kit/src/utils/coldStartImagePreload';
import { PERPS_FAVORITES_BAR_MARKET_CACHE_MAX_AGE_MS } from '@onekeyhq/shared/src/consts/perpCache';
import type { ITokenSearchAliases } from '@onekeyhq/shared/src/utils/perpsUtils';
import type { IPerpsUniverse } from '@onekeyhq/shared/types/hyperliquid';

import {
  type IPerpsTokenSelectorInitialListItem,
  buildPerpsAssetCtxsByDexFromAllDexsSnapshot,
  buildPerpsTokenSelectorInitialList,
  setCachedPerpsTokenSelectorInitialList,
} from '../utils/tokenSelectorInitialListCache';

type ITokenSelectorInitialListLoadResult = {
  assetsByDex: IPerpsUniverse[][];
  tokenSearchAliases?: ITokenSearchAliases;
  items: IPerpsTokenSelectorInitialListItem[];
  imageItems: IPerpsTokenSelectorInitialListItem[];
};

let tokenSelectorInitialListLoadPromise:
  | Promise<ITokenSelectorInitialListLoadResult>
  | undefined;

function loadTokenSelectorInitialList() {
  if (!tokenSelectorInitialListLoadPromise) {
    tokenSelectorInitialListLoadPromise = Promise.all([
      backgroundApiProxy.serviceHyperliquid.getTradingUniverse(),
      backgroundApiProxy.serviceHyperliquid.getTokenSearchAliases(),
      backgroundApiProxy.simpleDb.perp
        .getAllDexsAssetCtxsSnapshotCache({
          maxAgeMs: PERPS_FAVORITES_BAR_MARKET_CACHE_MAX_AGE_MS,
        })
        .catch(() => undefined),
    ])
      .then(([{ universesByDex }, tokenSearchAliases, assetCtxsSnapshot]) => {
        const assetsByDex = universesByDex ?? [];
        const assetCtxsByDex = buildPerpsAssetCtxsByDexFromAllDexsSnapshot(
          assetCtxsSnapshot?.data,
        );
        const items = buildPerpsTokenSelectorInitialList({
          assetsByDex,
          assetCtxsByDex,
          tokenSearchAliases,
          requireDefaultSortSnapshot: true,
        });
        const imageItems =
          items.length > 0
            ? items
            : buildPerpsTokenSelectorInitialList({
                assetsByDex,
                tokenSearchAliases,
              });
        setCachedPerpsTokenSelectorInitialList(items);
        return {
          assetsByDex,
          tokenSearchAliases,
          items,
          imageItems,
        };
      })
      .finally(() => {
        tokenSelectorInitialListLoadPromise = undefined;
      });
  }
  return tokenSelectorInitialListLoadPromise;
}

export function usePrewarmPerpsTokenSelectorImages() {
  const tokenSelectorImageItemsRef = useRef<
    IPerpsTokenSelectorInitialListItem[]
  >([]);

  const refreshTokenSelectorInitialList = useCallback(async () => {
    const { imageItems } = await loadTokenSelectorInitialList();
    tokenSelectorImageItemsRef.current = imageItems;
    return imageItems;
  }, []);

  const prewarmTokenSelectorImages = useCallback(() => {
    const tokenSelectorImageItems = tokenSelectorImageItemsRef.current;
    if (!tokenSelectorImageItems.length) {
      return refreshTokenSelectorInitialList().then((items) =>
        prewarmPerpsTokenSelectorImages(items),
      );
    }
    return prewarmPerpsTokenSelectorImages(tokenSelectorImageItems);
  }, [refreshTokenSelectorInitialList]);

  useEffect(() => {
    void refreshTokenSelectorInitialList().then((items) => {
      void prewarmPerpsTokenSelectorImages(items);
    });
  }, [refreshTokenSelectorInitialList]);

  return prewarmTokenSelectorImages;
}

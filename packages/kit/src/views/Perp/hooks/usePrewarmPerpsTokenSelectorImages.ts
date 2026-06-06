import { useCallback, useEffect, useRef } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useHyperliquidActions } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import { prewarmPerpsTokenSelectorImages } from '@onekeyhq/kit/src/utils/coldStartImagePreload';
import type { ITokenSearchAliases } from '@onekeyhq/shared/src/utils/perpsUtils';
import type { IPerpsUniverse } from '@onekeyhq/shared/types/hyperliquid';

import {
  type IPerpsTokenSelectorInitialListItem,
  buildPerpsTokenSelectorInitialList,
  setCachedPerpsTokenSelectorInitialList,
} from '../utils/tokenSelectorInitialListCache';

type ITokenSelectorInitialListLoadResult = {
  assetsByDex: IPerpsUniverse[][];
  tokenSearchAliases?: ITokenSearchAliases;
  items: IPerpsTokenSelectorInitialListItem[];
};

let tokenSelectorInitialListLoadPromise:
  | Promise<ITokenSelectorInitialListLoadResult>
  | undefined;

function loadTokenSelectorInitialList() {
  if (!tokenSelectorInitialListLoadPromise) {
    tokenSelectorInitialListLoadPromise = Promise.all([
      backgroundApiProxy.serviceHyperliquid.getTradingUniverse(),
      backgroundApiProxy.serviceHyperliquid.getTokenSearchAliases(),
    ])
      .then(([{ universesByDex }, tokenSearchAliases]) => {
        const assetsByDex = universesByDex ?? [];
        const items = buildPerpsTokenSelectorInitialList({
          assetsByDex,
          tokenSearchAliases,
        });
        setCachedPerpsTokenSelectorInitialList(items);
        return {
          assetsByDex,
          tokenSearchAliases,
          items,
        };
      })
      .finally(() => {
        tokenSelectorInitialListLoadPromise = undefined;
      });
  }
  return tokenSelectorInitialListLoadPromise;
}

export function usePrewarmPerpsTokenSelectorImages() {
  const actions = useHyperliquidActions();
  const tokenSelectorImageItemsRef = useRef<
    IPerpsTokenSelectorInitialListItem[]
  >([]);

  const refreshTokenSelectorInitialList = useCallback(async () => {
    const { assetsByDex, tokenSearchAliases, items } =
      await loadTokenSelectorInitialList();
    tokenSelectorImageItemsRef.current = items;
    actions.current.updateAllAssetsFiltered({
      allAssetsByDex: assetsByDex,
      query: '',
      tokenSearchAliases,
    });
    return items;
  }, [actions]);

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

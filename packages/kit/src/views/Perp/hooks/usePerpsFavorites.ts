import { useMemo } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePerpTokenFavoritesPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { parseDexCoin } from '@onekeyhq/shared/src/utils/perpsUtils';

import { usePromiseResult } from '../../../hooks/usePromiseResult';

export type IFavoriteItem = {
  coinName: string;
  displayName: string;
  assetId: number;
  dexIndex: number;
};

export function usePerpsFavorites(): {
  favoriteItems: IFavoriteItem[];
  isReady: boolean;
} {
  const [favorites] = usePerpTokenFavoritesPersistAtom();

  // Fetch the full universe independently — must not read from the
  // search-filtered atom, otherwise favorites disappear during search.
  const { result: universe } = usePromiseResult(
    async () => {
      let { universesByDex } =
        await backgroundApiProxy.serviceHyperliquid.getTradingUniverse();

      // If data is missing, force refresh from API
      if (
        !universesByDex ||
        universesByDex.length === 0 ||
        universesByDex.every((u) => u.length === 0)
      ) {
        await backgroundApiProxy.serviceHyperliquid.refreshTradingMeta();
        const res =
          await backgroundApiProxy.serviceHyperliquid.getTradingUniverse();
        universesByDex = res.universesByDex;
      }

      return universesByDex ?? [];
    },
    [],
    { checkIsFocused: false },
  );

  const favoriteItems = useMemo(() => {
    if (!universe?.length || !favorites.favorites.length) return [];

    const items: IFavoriteItem[] = [];

    favorites.favorites.forEach((favCoin) => {
      // Find in universe
      for (let dexIndex = 0; dexIndex < universe.length; dexIndex += 1) {
        const assets = universe[dexIndex] || [];
        const asset = assets.find((a) => a.name === favCoin);
        if (asset) {
          const parsed = parseDexCoin(asset.name);
          items.push({
            coinName: asset.name,
            displayName: parsed.displayName,
            assetId: asset.assetId,
            dexIndex,
          });
          break;
        }
      }
    });
    return items;
  }, [universe, favorites.favorites]);

  return { favoriteItems, isReady: universe !== undefined };
}

import { useMemo } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useActiveTradeInstrumentAtom } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import {
  usePerpTokenFavoritesPersistAtom,
  useSpotTokenFavoritesPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  formatSpotPairDisplayName,
  parseDexCoin,
} from '@onekeyhq/shared/src/utils/perpsUtils';
import type {
  IPerpsUniverse,
  ISpotUniverse,
} from '@onekeyhq/shared/types/hyperliquid';

import { usePromiseResult } from '../../../hooks/usePromiseResult';

export type IFavoriteItem = {
  mode: 'perp' | 'spot';
  coinName: string;
  displayName: string;
  imageTokenName: string;
  assetId: number;
  dexIndex: number;
};

export function usePerpsFavorites(options?: {
  mode?: 'current' | 'perp' | 'spot';
}): {
  favoriteItems: IFavoriteItem[];
  isReady: boolean;
} {
  const [activeTradeInstrument] = useActiveTradeInstrumentAtom();
  const [perpFavorites] = usePerpTokenFavoritesPersistAtom();
  const [spotFavorites] = useSpotTokenFavoritesPersistAtom();
  const favoritesMode =
    options?.mode === 'current'
      ? activeTradeInstrument.mode
      : (options?.mode ?? 'perp');
  const favorites =
    favoritesMode === 'spot'
      ? spotFavorites.favorites
      : perpFavorites.favorites;

  // Fetch the full universe independently — must not read from the
  // search-filtered atom, otherwise favorites disappear during search.
  const { result: universe } = usePromiseResult(
    async (): Promise<IPerpsUniverse[][] | ISpotUniverse[]> => {
      if (favoritesMode === 'spot') {
        let { universes } =
          await backgroundApiProxy.serviceHyperliquid.getSpotMeta();

        if (!universes?.length) {
          await backgroundApiProxy.serviceHyperliquid.refreshSpotMeta();
          const res = await backgroundApiProxy.serviceHyperliquid.getSpotMeta();
          universes = res.universes;
        }

        return universes ?? [];
      }

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
    [favoritesMode],
    { checkIsFocused: false },
  );

  const favoriteItems = useMemo(() => {
    if (!universe?.length || !favorites.length) return [];

    const items: IFavoriteItem[] = [];

    if (favoritesMode === 'spot') {
      const spotUniverses = universe as ISpotUniverse[];
      favorites.forEach((favCoin) => {
        const asset = spotUniverses.find((item) => item.name === favCoin);
        if (asset) {
          items.push({
            mode: 'spot',
            coinName: asset.name,
            displayName:
              asset.displayName ||
              formatSpotPairDisplayName(asset.baseName, asset.quoteName),
            imageTokenName: asset.baseName,
            assetId: asset.assetId,
            dexIndex: -1,
          });
        }
      });
      return items;
    }

    const perpsUniverses = universe as IPerpsUniverse[][];
    favorites.forEach((favCoin) => {
      for (let dexIndex = 0; dexIndex < perpsUniverses.length; dexIndex += 1) {
        const assets = perpsUniverses[dexIndex] || [];
        const asset = assets.find((item) => item.name === favCoin);
        if (asset) {
          const parsed = parseDexCoin(asset.name);
          items.push({
            mode: 'perp',
            coinName: asset.name,
            displayName: parsed.displayName,
            imageTokenName: parsed.displayName,
            assetId: asset.assetId,
            dexIndex,
          });
          break;
        }
      }
    });

    return items;
  }, [favorites, favoritesMode, universe]);

  return { favoriteItems, isReady: universe !== undefined };
}

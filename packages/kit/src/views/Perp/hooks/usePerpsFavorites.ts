import { useMemo } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useActiveTradeInstrumentAtom } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import {
  usePerpTokenFavoritesPersistAtom,
  useSpotTokenFavoritesPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { isPerpsUniverseCacheComplete } from '@onekeyhq/shared/src/utils/perpsDexUtils';
import {
  formatSpotPairDisplayName,
  parseDexCoin,
} from '@onekeyhq/shared/src/utils/perpsUtils';
import type {
  IPerpsUniverse,
  ISpotUniverse,
} from '@onekeyhq/shared/types/hyperliquid';

import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { dedupeTokenSelectorFavoriteCoins } from '../utils/tokenSelectorFavorites';

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
  const uniqueFavorites = useMemo(
    () => dedupeTokenSelectorFavoriteCoins(favorites),
    [favorites],
  );

  // Fetch the full universe independently — must not read from the
  // search-filtered atom, otherwise favorites disappear during search.
  // Tagged with mode because usePromiseResult keeps the old result until
  // the new promise resolves, which can briefly mix spot/perp structures.
  const { result: taggedUniverse } = usePromiseResult(
    async (): Promise<
      | { mode: 'spot'; data: ISpotUniverse[] }
      | { mode: 'perp'; data: IPerpsUniverse[][] }
    > => {
      if (favoritesMode === 'spot') {
        let { universes } =
          await backgroundApiProxy.serviceHyperliquid.getSpotMeta();

        if (!universes?.length) {
          await backgroundApiProxy.serviceHyperliquid.refreshSpotMeta();
          const res = await backgroundApiProxy.serviceHyperliquid.getSpotMeta();
          universes = res.universes;
        }

        return { mode: 'spot', data: universes ?? [] };
      }

      let { universesByDex } =
        await backgroundApiProxy.serviceHyperliquid.getTradingUniverse();

      // If data is missing, or the cache predates a newly registered sub-DEX,
      // force refresh from API. A short array is just as unusable as an empty
      // one here: favorites on the missing dex would silently fail to resolve.
      if (!isPerpsUniverseCacheComplete(universesByDex)) {
        try {
          await backgroundApiProxy.serviceHyperliquid.refreshTradingMeta();
          const res =
            await backgroundApiProxy.serviceHyperliquid.getTradingUniverse();
          universesByDex = res.universesByDex;
        } catch {
          // Every existing user hits this branch on the first cold start after
          // the release, so a rejection here would blank the favorites bar for
          // the whole session (usePromiseResult neither retries nor re-runs).
          // Serving the stale universe still resolves every pre-existing
          // favorite; only the newly registered dex stays missing.
        }
      }

      return { mode: 'perp', data: universesByDex ?? [] };
    },
    [favoritesMode],
    { checkIsFocused: false },
  );

  const favoriteItems = useMemo(() => {
    if (!uniqueFavorites.length || !taggedUniverse) {
      return [];
    }

    const items: IFavoriteItem[] = [];

    if (taggedUniverse.mode === 'spot') {
      const spotUniverses = taggedUniverse.data;
      if (!spotUniverses.length) {
        return [];
      }
      uniqueFavorites.forEach((favCoin) => {
        const asset = spotUniverses.find((item) => item.name === favCoin);
        if (asset) {
          items.push({
            mode: 'spot',
            coinName: asset.name,
            // universe.displayName is base-only ("HYPE"), which hides the
            // quote currency — favorites need the full pair to disambiguate.
            displayName: formatSpotPairDisplayName(
              asset.baseName,
              asset.quoteName,
            ),
            imageTokenName: asset.baseName,
            assetId: asset.assetId,
            dexIndex: -1,
          });
        }
      });
      return items;
    }

    const perpsUniverses = taggedUniverse.data;
    if (!perpsUniverses.length) {
      return [];
    }
    uniqueFavorites.forEach((favCoin) => {
      for (let dexIndex = 0; dexIndex < perpsUniverses.length; dexIndex += 1) {
        const assets = perpsUniverses[dexIndex];
        const asset = Array.isArray(assets)
          ? assets.find((item) => item.name === favCoin)
          : undefined;
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
  }, [uniqueFavorites, taggedUniverse]);

  return { favoriteItems, isReady: taggedUniverse !== undefined };
}

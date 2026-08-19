import { memo, useCallback, useEffect, useMemo } from 'react';

import { XStack } from '@onekeyhq/components';
import {
  useActiveTradeInstrumentAtom,
  useHyperliquidActions,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import { usePerpsAllAssetCtxsAtom } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid/atoms';
import {
  usePerpsFooterTickerModePersistAtom,
  useSpotAssetCtxsMapAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { toCtxIndex } from '@onekeyhq/shared/src/utils/perpsDexUtils';
import perpsUtils, {
  formatSpotPriceEntry,
} from '@onekeyhq/shared/src/utils/perpsUtils';

import { usePerpsFavorites } from '../../hooks/usePerpsFavorites';
import { usePopularTickers } from '../../hooks/usePopularTickers';

import { FooterTickerMarquee } from './FooterTickerMarquee.web';
import { FooterTickerSettings } from './FooterTickerSettings';

import type { IFooterTickerItemData } from './footerTickerUtils';

// Ticker list for Popular mode
const PopularTickerList = memo(() => {
  const popularTickers = usePopularTickers();
  const actions = useHyperliquidActions();
  const handleItemPress = useCallback(
    (item: IFooterTickerItemData) => {
      void actions.current.switchTradeInstrument({
        coin: item.coinName,
        mode: item.mode,
      });
    },
    [actions],
  );

  if (!popularTickers.length) return null;

  return (
    <FooterTickerMarquee
      items={popularTickers}
      deferStructureUpdates
      onItemPress={handleItemPress}
    />
  );
});
PopularTickerList.displayName = 'PopularTickerList';

// Ticker list for Favorites mode
const FavoritesTickerList = memo(() => {
  const { favoriteItems } = usePerpsFavorites({ mode: 'current' });
  const [allAssetCtxs] = usePerpsAllAssetCtxsAtom();
  const [spotPriceMap] = useSpotAssetCtxsMapAtom();
  const actions = useHyperliquidActions();
  const tickerItems = useMemo<IFooterTickerItemData[]>(
    () =>
      favoriteItems.map((item) => {
        const displayCtx =
          item.mode === 'spot'
            ? formatSpotPriceEntry(spotPriceMap[item.coinName])
            : perpsUtils.formatAssetCtx(
                allAssetCtxs.assetCtxsByDex[item.dexIndex]?.[
                  toCtxIndex(item.assetId, item.dexIndex)
                ] ?? null,
              );
        return {
          ...item,
          change24hPercent: displayCtx?.change24hPercent ?? 0,
          markPrice: displayCtx?.markPrice,
        };
      }),
    [allAssetCtxs.assetCtxsByDex, favoriteItems, spotPriceMap],
  );
  const handleItemPress = useCallback(
    (item: IFooterTickerItemData) => {
      void actions.current.switchTradeInstrument({
        coin: item.coinName,
        mode: item.mode,
      });
    },
    [actions],
  );

  if (!tickerItems.length) return null;

  return (
    <FooterTickerMarquee items={tickerItems} onItemPress={handleItemPress} />
  );
});
FavoritesTickerList.displayName = 'FavoritesTickerList';

function PerpFooterTicker() {
  const [activeTradeInstrument] = useActiveTradeInstrumentAtom();
  const [footerMode] = usePerpsFooterTickerModePersistAtom();
  const actions = useHyperliquidActions();
  const isVisible = footerMode.mode !== 'none';

  // Request batch asset ctx updates when footer is visible
  useEffect(() => {
    if (isVisible && activeTradeInstrument.mode === 'perp') {
      const currentActions = actions.current;
      currentActions.markAllAssetCtxsRequired();
      return () => {
        currentActions.markAllAssetCtxsNotRequired();
      };
    }
  }, [actions, activeTradeInstrument.mode, isVisible]);

  // Embedded inside PerpContentFooter — no own container, just fills flex space
  if (!isVisible) {
    return (
      <XStack flex={1} alignItems="center">
        <FooterTickerSettings />
      </XStack>
    );
  }

  return (
    <XStack flex={1} alignItems="center" gap="$4" overflow="hidden">
      <FooterTickerSettings />
      {footerMode.mode === 'popular' ? (
        <PopularTickerList />
      ) : (
        <FavoritesTickerList />
      )}
    </XStack>
  );
}

const PerpFooterTickerMemo = memo(PerpFooterTicker);
export { PerpFooterTickerMemo as PerpFooterTicker };

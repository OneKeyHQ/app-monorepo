import { memo, useEffect } from 'react';

import { XStack } from '@onekeyhq/components';
import {
  useActiveTradeInstrumentAtom,
  useHyperliquidActions,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import { usePerpsFooterTickerModePersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import { usePerpsFavorites } from '../../hooks/usePerpsFavorites';
import { usePopularTickers } from '../../hooks/usePopularTickers';

import { FooterTickerItem } from './FooterTickerItem';
import { FooterTickerMarquee } from './FooterTickerMarquee.web';
import { FooterTickerSettings } from './FooterTickerSettings';

// Ticker list for Popular mode
const PopularTickerList = memo(() => {
  const popularTickers = usePopularTickers();
  const actions = useHyperliquidActions();

  if (!popularTickers.length) return null;

  return (
    <>
      {popularTickers.map((item) => (
        <FooterTickerItem
          key={`${item.dexIndex}-${item.assetId}`}
          displayName={item.displayName}
          coinName={item.coinName}
          dexIndex={item.dexIndex}
          assetId={item.assetId}
          mode={item.mode}
          onPress={() =>
            void actions.current.switchTradeInstrument({
              coin: item.coinName,
              mode: item.mode,
            })
          }
        />
      ))}
    </>
  );
});
PopularTickerList.displayName = 'PopularTickerList';

// Ticker list for Favorites mode
const FavoritesTickerList = memo(() => {
  const { favoriteItems } = usePerpsFavorites({ mode: 'current' });
  const actions = useHyperliquidActions();

  if (!favoriteItems.length) return null;

  return (
    <>
      {favoriteItems.map((item) => (
        <FooterTickerItem
          key={`${item.dexIndex}-${item.assetId}`}
          displayName={item.displayName}
          coinName={item.coinName}
          dexIndex={item.dexIndex}
          assetId={item.assetId}
          mode={item.mode}
          onPress={() =>
            void actions.current.switchTradeInstrument({
              coin: item.coinName,
              mode: item.mode,
            })
          }
        />
      ))}
    </>
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
    <XStack flex={1} alignItems="center" gap="$2" overflow="hidden">
      <FooterTickerSettings />
      <FooterTickerMarquee>
        {footerMode.mode === 'popular' ? (
          <PopularTickerList />
        ) : (
          <FavoritesTickerList />
        )}
      </FooterTickerMarquee>
    </XStack>
  );
}

const PerpFooterTickerMemo = memo(PerpFooterTicker);
export { PerpFooterTickerMemo as PerpFooterTicker };

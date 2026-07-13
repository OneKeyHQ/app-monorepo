import { memo, useMemo } from 'react';

import { SizableText, XStack } from '@onekeyhq/components';
import { useActiveTradeInstrumentAtom } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import { usePerpsCtxByCoin } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid/atoms';
import {
  usePerpsActiveAssetAtom,
  usePerpsActiveAssetCtxAtom,
  useSpotActiveAssetCtxAtom,
  useSpotAssetCtxsMapAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import perpsUtils, {
  formatSpotPriceEntry,
} from '@onekeyhq/shared/src/utils/perpsUtils';

import { PriceChangeDisplay } from '../FavoritesBar/FavoriteTokenItem';

interface IFooterTickerItemProps {
  displayName: string;
  coinName: string;
  dexIndex: number;
  assetId: number;
  mode: 'perp' | 'spot';
  onPress: () => void;
}

// Price display for non-active tokens (reads from batch asset ctxs)
const CtxPrice = memo(
  ({
    coinName,
    dexIndex,
    assetId,
    mode,
  }: {
    coinName: string;
    dexIndex: number;
    assetId: number;
    mode: 'perp' | 'spot';
  }) => {
    const ctx = usePerpsCtxByCoin(dexIndex, assetId);
    const [spotPriceMap] = useSpotAssetCtxsMapAtom();
    const formatted = useMemo(() => perpsUtils.formatAssetCtx(ctx), [ctx]);
    const formattedSpot = useMemo(
      () => formatSpotPriceEntry(spotPriceMap[coinName]),
      [coinName, spotPriceMap],
    );
    const displayCtx = mode === 'spot' ? formattedSpot : formatted;

    return (
      <PriceChangeDisplay
        change={displayCtx?.change24hPercent ?? 0}
        markPrice={displayCtx?.markPrice}
      />
    );
  },
);
CtxPrice.displayName = 'CtxPrice';

// Price display for the currently active token (higher update frequency)
const ActivePrice = memo(
  ({
    coinName,
    dexIndex,
    assetId,
    mode,
  }: {
    coinName: string;
    dexIndex: number;
    assetId: number;
    mode: 'perp' | 'spot';
  }) => {
    const [assetCtx] = usePerpsActiveAssetCtxAtom();
    const [spotActiveAssetCtx] = useSpotActiveAssetCtxAtom();
    const fallbackCtx = usePerpsCtxByCoin(dexIndex, assetId);
    const [spotPriceMap] = useSpotAssetCtxsMapAtom();
    const formattedFallback = useMemo(
      () => perpsUtils.formatAssetCtx(fallbackCtx),
      [fallbackCtx],
    );
    const formattedSpotFallback = useMemo(
      () => formatSpotPriceEntry(spotPriceMap[coinName]),
      [coinName, spotPriceMap],
    );

    const activeCtx = assetCtx?.ctx;
    const spotCtx = spotActiveAssetCtx?.ctx;
    let ctx: { markPrice?: string; change24hPercent?: number } =
      activeCtx?.markPrice ? activeCtx : formattedFallback;
    if (mode === 'spot') {
      ctx = spotCtx?.markPrice ? spotCtx : formattedSpotFallback;
    }

    return (
      <PriceChangeDisplay
        change={ctx?.change24hPercent ?? 0}
        markPrice={ctx?.markPrice}
      />
    );
  },
);
ActivePrice.displayName = 'ActivePrice';

function FooterTickerItem({
  displayName,
  coinName,
  dexIndex,
  assetId,
  mode,
  onPress,
}: IFooterTickerItemProps) {
  const [activeTradeInstrument] = useActiveTradeInstrumentAtom();
  const [activeAsset] = usePerpsActiveAssetAtom();
  const isActive =
    mode === 'spot'
      ? activeTradeInstrument.mode === 'spot' &&
        activeTradeInstrument.coin === coinName
      : activeAsset?.coin === coinName;

  return (
    <XStack
      onPress={onPress}
      px="$2"
      py="$1"
      mr="$1"
      borderRadius="$2"
      hoverStyle={{ bg: '$bgHover' }}
      userSelect="none"
      alignItems="center"
      gap="$1.5"
      cursor="default"
      flexShrink={0}
    >
      <SizableText size="$bodyMdMedium" color="$text">
        {displayName}
      </SizableText>
      {isActive ? (
        <ActivePrice
          coinName={coinName}
          dexIndex={dexIndex}
          assetId={assetId}
          mode={mode}
        />
      ) : (
        <CtxPrice
          coinName={coinName}
          dexIndex={dexIndex}
          assetId={assetId}
          mode={mode}
        />
      )}
    </XStack>
  );
}

const FooterTickerItemMemo = memo(FooterTickerItem);
export { FooterTickerItemMemo as FooterTickerItem };

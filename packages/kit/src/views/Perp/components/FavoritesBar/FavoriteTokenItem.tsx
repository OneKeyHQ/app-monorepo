import { memo, useMemo } from 'react';

import {
  NumberSizeableText,
  SizableText,
  Skeleton,
  XStack,
} from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { usePerpsCtxByCoin } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid/atoms';
import {
  type IPerpFavoritesDisplayMode,
  usePerpsActiveAssetAtom,
  usePerpsActiveAssetCtxAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import perpsUtils, {
  formatPriceToSignificantDigits,
  getHyperliquidTokenImageUrl,
} from '@onekeyhq/shared/src/utils/perpsUtils';

interface IFavoriteTokenItemProps {
  displayName: string;
  coinName: string;
  dexIndex: number;
  assetId: number;
  onPress: () => void;
  displayMode?: IPerpFavoritesDisplayMode;
}

const CtxPriceDisplay = memo(
  ({
    dexIndex,
    assetId,
    displayMode = 'price',
  }: {
    dexIndex: number;
    assetId: number;
    displayMode?: IPerpFavoritesDisplayMode;
  }) => {
    const ctx = usePerpsCtxByCoin(dexIndex, assetId);
    const formattedCtx = useMemo(() => perpsUtils.formatAssetCtx(ctx), [ctx]);

    const priceDisplay = formattedCtx?.markPrice
      ? formatPriceToSignificantDigits(formattedCtx.markPrice)
      : '-';

    const change24hPercent = formattedCtx?.change24hPercent ?? 0;
    const color = change24hPercent >= 0 ? '$textSuccess' : '$textCritical';

    const skeletonWidth = displayMode === 'price' ? 46 : 60;
    if (formattedCtx?.markPrice === '0') {
      return <Skeleton width={skeletonWidth} height={16} />;
    }

    if (displayMode === 'percent') {
      return (
        <NumberSizeableText
          size="$bodySmMedium"
          color={color}
          style={{ fontVariantNumeric: 'tabular-nums' }}
          formatter="priceChange"
          formatterOptions={{ showPlusMinusSigns: true }}
        >
          {change24hPercent.toString()}
        </NumberSizeableText>
      );
    }

    return (
      <SizableText
        size="$bodySmMedium"
        color={color}
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {priceDisplay}
      </SizableText>
    );
  },
);
CtxPriceDisplay.displayName = 'CtxPriceDisplay';

const ActiveAssetPriceDisplay = memo(
  ({
    dexIndex,
    assetId,
    displayMode = 'price',
  }: {
    dexIndex: number;
    assetId: number;
    displayMode?: IPerpFavoritesDisplayMode;
  }) => {
    const [assetCtx] = usePerpsActiveAssetCtxAtom();
    const fallbackCtx = usePerpsCtxByCoin(dexIndex, assetId);
    const formattedFallback = useMemo(
      () => perpsUtils.formatAssetCtx(fallbackCtx),
      [fallbackCtx],
    );

    const activeCtx = assetCtx?.ctx;
    const ctx = activeCtx?.markPrice ? activeCtx : formattedFallback;

    const priceDisplay = ctx?.markPrice
      ? formatPriceToSignificantDigits(ctx.markPrice)
      : '-';
    const change24hPercent = ctx?.change24hPercent ?? 0;
    const color = change24hPercent >= 0 ? '$textSuccess' : '$textCritical';

    if (displayMode === 'percent') {
      return (
        <NumberSizeableText
          size="$bodySmMedium"
          color={color}
          style={{ fontVariantNumeric: 'tabular-nums' }}
          formatter="priceChange"
          formatterOptions={{ showPlusMinusSigns: true }}
        >
          {change24hPercent.toString()}
        </NumberSizeableText>
      );
    }

    return (
      <SizableText
        size="$bodySmMedium"
        color={color}
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {priceDisplay}
      </SizableText>
    );
  },
);
ActiveAssetPriceDisplay.displayName = 'ActiveAssetPriceDisplay';

function FavoriteTokenItem({
  displayName,
  coinName,
  dexIndex,
  assetId,
  onPress,
  displayMode = 'price',
}: IFavoriteTokenItemProps) {
  const [activeAsset] = usePerpsActiveAssetAtom();
  const isActiveToken = activeAsset?.coin === coinName;

  return (
    <XStack
      onPress={onPress}
      px="$1"
      py="$1"
      borderRadius="$2"
      hoverStyle={{
        bg: '$bgHover',
      }}
      userSelect="none"
      alignItems="center"
      gap="$1.5"
      cursor="default"
    >
      <Token
        size="xs"
        borderRadius="$full"
        tokenImageUri={getHyperliquidTokenImageUrl(displayName)}
        fallbackIcon="CryptoCoinOutline"
      />
      <SizableText size="$bodySmMedium" color="$text">
        {displayName}
      </SizableText>
      {isActiveToken ? (
        <ActiveAssetPriceDisplay
          dexIndex={dexIndex}
          assetId={assetId}
          displayMode={displayMode}
        />
      ) : (
        <CtxPriceDisplay
          dexIndex={dexIndex}
          assetId={assetId}
          displayMode={displayMode}
        />
      )}
    </XStack>
  );
}

const FavoriteTokenItemMemo = memo(FavoriteTokenItem);
export { FavoriteTokenItemMemo as FavoriteTokenItem };

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
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import perpsUtils, {
  formatPriceToSignificantDigits,
  getHyperliquidTokenImageUrl,
} from '@onekeyhq/shared/src/utils/perpsUtils';
import {
  MAX_DECIMALS_PERP,
  MAX_SIGNIFICANT_FIGURES,
} from '@onekeyhq/shared/types/hyperliquid/perp.constants';

export const TABULAR_NUMS_STYLE = {
  fontVariantNumeric: 'tabular-nums',
} as const;

/**
 * Calculate stable minWidth (in ch units) for formatted price strings to
 * prevent layout jitter caused by trailing-zero stripping in
 * formatPriceToSignificantDigits. With tabular-nums, 1ch equals one digit width.
 */
export function getStablePriceMinWidth(priceStr: string): string | undefined {
  // ch units are CSS-only, not supported on React Native
  if (platformEnv.isNative) return undefined;
  if (!priceStr || priceStr === '-' || priceStr === '0') return undefined;

  const dotIndex = priceStr.indexOf('.');
  if (dotIndex === -1) return undefined;

  const intPart = priceStr.substring(0, dotIndex);
  const intDigits = intPart === '0' ? 0 : intPart.length;

  if (intDigits >= MAX_SIGNIFICANT_FIGURES) return undefined;

  let maxDecimals: number;
  if (intDigits === 0) {
    // Leading zeros don't count as significant figures
    const decimalPart = priceStr.substring(dotIndex + 1);
    const leadingZeroMatch = decimalPart.match(/^(0*)/);
    const leadingZeros = leadingZeroMatch ? leadingZeroMatch[1].length : 0;
    maxDecimals = Math.min(
      leadingZeros + MAX_SIGNIFICANT_FIGURES,
      MAX_DECIMALS_PERP,
    );
  } else {
    maxDecimals = MAX_SIGNIFICANT_FIGURES - intDigits;
  }

  const totalChars = intPart.length + 1 + maxDecimals;
  return `${totalChars}ch`;
}

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
          style={TABULAR_NUMS_STYLE}
          formatter="priceChange"
          formatterOptions={{ showPlusMinusSigns: true }}
        >
          {change24hPercent.toString()}
        </NumberSizeableText>
      );
    }

    const priceMinWidth = getStablePriceMinWidth(priceDisplay);
    return (
      <SizableText
        size="$bodySmMedium"
        color={color}
        style={TABULAR_NUMS_STYLE}
        minWidth={priceMinWidth}
        textAlign="right"
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
          style={TABULAR_NUMS_STYLE}
          formatter="priceChange"
          formatterOptions={{ showPlusMinusSigns: true }}
        >
          {change24hPercent.toString()}
        </NumberSizeableText>
      );
    }

    const priceMinWidth = getStablePriceMinWidth(priceDisplay);
    return (
      <SizableText
        size="$bodySmMedium"
        color={color}
        style={TABULAR_NUMS_STYLE}
        minWidth={priceMinWidth}
        textAlign="right"
      >
        {priceDisplay}
      </SizableText>
    );
  },
);
ActiveAssetPriceDisplay.displayName = 'ActiveAssetPriceDisplay';

// Shared price display: change% (colored) + price (subdued)
export const PriceChangeDisplay = memo(
  ({ change, markPrice }: { change: number; markPrice?: string }) => {
    const color = change >= 0 ? '$textSuccess' : '$textCritical';
    const sign = change >= 0 ? '+' : '';
    const price = markPrice ? formatPriceToSignificantDigits(markPrice) : '-';
    const priceMinWidth = getStablePriceMinWidth(price);
    return (
      <>
        <SizableText
          size="$bodySmMedium"
          color={color}
          style={TABULAR_NUMS_STYLE}
        >
          {`${sign}${change.toFixed(2)}%`}
        </SizableText>
        <SizableText
          size="$bodySmMedium"
          color="$textSubdued"
          style={TABULAR_NUMS_STYLE}
          minWidth={priceMinWidth}
          textAlign="right"
        >
          {price}
        </SizableText>
      </>
    );
  },
);
PriceChangeDisplay.displayName = 'PriceChangeDisplay';

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

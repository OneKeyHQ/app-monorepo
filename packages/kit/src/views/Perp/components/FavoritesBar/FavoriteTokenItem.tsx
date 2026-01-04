import { memo, useMemo } from 'react';

import { SizableText, XStack } from '@onekeyhq/components';
import { usePerpsCtxByCoin } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid/atoms';
import {
  usePerpsActiveAssetAtom,
  usePerpsActiveAssetCtxAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import perpsUtils, {
  formatPriceToSignificantDigits,
} from '@onekeyhq/shared/src/utils/perpsUtils';

interface IFavoriteTokenItemProps {
  displayName: string;
  coinName: string;
  dexIndex: number;
  assetId: number;
  onPress: () => void;
}

const CtxPriceDisplay = memo(
  ({ dexIndex, assetId }: { dexIndex: number; assetId: number }) => {
    const ctx = usePerpsCtxByCoin(dexIndex, assetId);
    const formattedCtx = useMemo(() => perpsUtils.formatAssetCtx(ctx), [ctx]);

    const priceDisplay = formattedCtx?.markPrice
      ? formatPriceToSignificantDigits(formattedCtx.markPrice)
      : '-';

    const color =
      (formattedCtx?.change24hPercent ?? 0) >= 0
        ? '$textSuccess'
        : '$textCritical';

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
  ({ dexIndex, assetId }: { dexIndex: number; assetId: number }) => {
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
    const color =
      (ctx?.change24hPercent ?? 0) >= 0 ? '$textSuccess' : '$textCritical';

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
}: IFavoriteTokenItemProps) {
  const [activeAsset] = usePerpsActiveAssetAtom();
  const isActiveToken = activeAsset?.coin === coinName;

  return (
    <XStack
      onPress={onPress}
      cursor="pointer"
      px="$1"
      py="$1"
      borderRadius="$2"
      hoverStyle={{
        bg: '$bgHover',
      }}
      userSelect="none"
      alignItems="center"
      gap="$2"
    >
      <SizableText size="$bodySmMedium" color="$text">
        {displayName}-USDC
      </SizableText>
      {isActiveToken ? (
        <ActiveAssetPriceDisplay dexIndex={dexIndex} assetId={assetId} />
      ) : (
        <CtxPriceDisplay dexIndex={dexIndex} assetId={assetId} />
      )}
    </XStack>
  );
}

const FavoriteTokenItemMemo = memo(FavoriteTokenItem);
export { FavoriteTokenItemMemo as FavoriteTokenItem };

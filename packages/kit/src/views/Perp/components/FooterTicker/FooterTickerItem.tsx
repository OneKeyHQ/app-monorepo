import { memo, useMemo } from 'react';

import { SizableText, XStack } from '@onekeyhq/components';
import { usePerpsCtxByCoin } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid/atoms';
import {
  usePerpsActiveAssetAtom,
  usePerpsActiveAssetCtxAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import perpsUtils from '@onekeyhq/shared/src/utils/perpsUtils';

import { PriceChangeDisplay } from '../FavoritesBar/FavoriteTokenItem';

interface IFooterTickerItemProps {
  displayName: string;
  coinName: string;
  dexIndex: number;
  assetId: number;
  onPress: () => void;
}

// Price display for non-active tokens (reads from batch asset ctxs)
const CtxPrice = memo(
  ({ dexIndex, assetId }: { dexIndex: number; assetId: number }) => {
    const ctx = usePerpsCtxByCoin(dexIndex, assetId);
    const formatted = useMemo(() => perpsUtils.formatAssetCtx(ctx), [ctx]);
    return (
      <PriceChangeDisplay
        change={formatted?.change24hPercent ?? 0}
        markPrice={formatted?.markPrice}
      />
    );
  },
);
CtxPrice.displayName = 'CtxPrice';

// Price display for the currently active token (higher update frequency)
const ActivePrice = memo(
  ({ dexIndex, assetId }: { dexIndex: number; assetId: number }) => {
    const [assetCtx] = usePerpsActiveAssetCtxAtom();
    const fallbackCtx = usePerpsCtxByCoin(dexIndex, assetId);
    const formattedFallback = useMemo(
      () => perpsUtils.formatAssetCtx(fallbackCtx),
      [fallbackCtx],
    );

    const activeCtx = assetCtx?.ctx;
    const ctx = activeCtx?.markPrice ? activeCtx : formattedFallback;

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
  onPress,
}: IFooterTickerItemProps) {
  const [activeAsset] = usePerpsActiveAssetAtom();
  const isActive = activeAsset?.coin === coinName;

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
        <ActivePrice dexIndex={dexIndex} assetId={assetId} />
      ) : (
        <CtxPrice dexIndex={dexIndex} assetId={assetId} />
      )}
    </XStack>
  );
}

const FooterTickerItemMemo = memo(FooterTickerItem);
export { FooterTickerItemMemo as FooterTickerItem };

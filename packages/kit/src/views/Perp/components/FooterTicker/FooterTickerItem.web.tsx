import { memo, useCallback, useState } from 'react';

import { SizableText } from '@onekeyhq/components';

import {
  TABULAR_NUMS_STYLE,
  getStablePriceMinWidth,
} from '../FavoritesBar/FavoriteTokenItem';

import { getFooterTickerDisplayText } from './footerTickerUtils';

import type { IFooterTickerItemData } from './footerTickerUtils';

interface IFooterTickerItemProps extends IFooterTickerItemData {
  isDuplicate?: boolean;
  onPress: (item: IFooterTickerItemData) => void;
}

function FooterTickerItem({
  displayName,
  coinName,
  dexIndex,
  assetId,
  mode,
  change24hPercent,
  markPrice,
  isDuplicate,
  onPress,
}: IFooterTickerItemProps) {
  const [isHovered, setIsHovered] = useState(false);
  const color = change24hPercent >= 0 ? '$textSuccess' : '$textCritical';
  const { changeText, priceText } = getFooterTickerDisplayText({
    displayName,
    coinName,
    dexIndex,
    assetId,
    mode,
    change24hPercent,
    markPrice,
  });
  const priceMinWidth = getStablePriceMinWidth(priceText);
  const handlePress = useCallback(() => {
    onPress({
      displayName,
      coinName,
      dexIndex,
      assetId,
      mode,
      change24hPercent,
      markPrice,
    });
  }, [
    assetId,
    change24hPercent,
    coinName,
    dexIndex,
    displayName,
    markPrice,
    mode,
    onPress,
  ]);

  return (
    <button
      type="button"
      aria-hidden={isDuplicate || undefined}
      tabIndex={isDuplicate ? -1 : undefined}
      onClick={handlePress}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        appearance: 'none',
        display: 'inline-flex',
        alignItems: 'center',
        flexShrink: 0,
        gap: 6,
        width: 'max-content',
        padding: 0,
        border: 0,
        background: 'transparent',
        cursor: 'pointer',
        userSelect: 'none',
        whiteSpace: 'nowrap',
      }}
    >
      <SizableText
        size="$bodySmMedium"
        color={isHovered ? '$textInteractive' : '$text'}
        whiteSpace="nowrap"
      >
        {displayName}
      </SizableText>
      <SizableText
        size="$bodySmMedium"
        color={color}
        style={TABULAR_NUMS_STYLE}
        flexShrink={0}
        whiteSpace="nowrap"
      >
        {changeText}
      </SizableText>
      <SizableText
        size="$bodySmMedium"
        color={isHovered ? '$text' : '$textSubdued'}
        style={TABULAR_NUMS_STYLE}
        flexShrink={0}
        minWidth={priceMinWidth}
        whiteSpace="nowrap"
      >
        {priceText}
      </SizableText>
    </button>
  );
}

const FooterTickerItemMemo = memo(FooterTickerItem);
export { FooterTickerItemMemo as FooterTickerItem };

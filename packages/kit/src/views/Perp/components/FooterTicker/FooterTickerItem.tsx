import { memo, useCallback, useState } from 'react';

import { SizableText, XStack } from '@onekeyhq/components';

import { TABULAR_NUMS_STYLE } from '../FavoritesBar/FavoriteTokenItem';

import { getFooterTickerDisplayText } from './footerTickerUtils';

import type { IFooterTickerItemData } from './footerTickerUtils';

const ITEM_CHARACTER_WIDTH_PX = 7.75;
const ITEM_INTERNAL_GAPS_WIDTH_PX = 12;

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
  // Freeze the initial text budget so live prices do not resize the item.
  const [itemWidth] = useState(
    () =>
      (displayName.length + changeText.length + priceText.length) *
        ITEM_CHARACTER_WIDTH_PX +
      ITEM_INTERNAL_GAPS_WIDTH_PX,
  );
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
    <XStack
      aria-hidden={isDuplicate || undefined}
      tabIndex={isDuplicate ? -1 : undefined}
      onPress={handlePress}
      group
      userSelect="none"
      alignItems="center"
      gap="$1.5"
      cursor="pointer"
      flexShrink={0}
      width={itemWidth}
    >
      <SizableText
        size="$bodySmMedium"
        color="$text"
        whiteSpace="nowrap"
        $group-hover={{ color: '$textInteractive' }}
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
        color="$textSubdued"
        $group-hover={{ color: '$text' }}
        style={TABULAR_NUMS_STYLE}
        flexShrink={0}
        whiteSpace="nowrap"
      >
        {priceText}
      </SizableText>
    </XStack>
  );
}

const FooterTickerItemMemo = memo(FooterTickerItem);
export { FooterTickerItemMemo as FooterTickerItem };

import { memo, useCallback } from 'react';

import { SizableText, XStack } from '@onekeyhq/components';

import { TABULAR_NUMS_STYLE } from '../FavoritesBar/FavoriteTokenItem';

import { getFooterTickerDisplayText } from './footerTickerUtils';

import type { IFooterTickerItemData } from './footerTickerUtils';

const CHANGE_COLUMN_WIDTH = '8ch';
const PRICE_COLUMN_WIDTH = '10ch';

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
        width={CHANGE_COLUMN_WIDTH}
        flexShrink={0}
        overflow="hidden"
        whiteSpace="nowrap"
      >
        {changeText}
      </SizableText>
      <SizableText
        size="$bodySmMedium"
        color="$textSubdued"
        $group-hover={{ color: '$text' }}
        style={TABULAR_NUMS_STYLE}
        width={PRICE_COLUMN_WIDTH}
        flexShrink={0}
        overflow="hidden"
        whiteSpace="nowrap"
      >
        {priceText}
      </SizableText>
    </XStack>
  );
}

const FooterTickerItemMemo = memo(FooterTickerItem);
export { FooterTickerItemMemo as FooterTickerItem };

import { memo, useCallback } from 'react';

import { SizableText, XStack } from '@onekeyhq/components';

import { TABULAR_NUMS_STYLE } from '../FavoritesBar/FavoriteTokenItem';

import { getFooterTickerDisplayText } from './footerTickerUtils';

import type {
  IFooterTickerItemData,
  IFooterTickerTextWidthBudget,
} from './footerTickerUtils';

interface IFooterTickerItemProps extends IFooterTickerItemData {
  isDuplicate?: boolean;
  isMeasure?: boolean;
  widthBudget?: IFooterTickerTextWidthBudget;
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
  isMeasure,
  widthBudget,
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
      aria-hidden={isDuplicate || isMeasure || undefined}
      tabIndex={isDuplicate || isMeasure ? -1 : undefined}
      onPress={isMeasure ? undefined : handlePress}
      group
      userSelect="none"
      alignItems="center"
      gap="$1.5"
      cursor={isMeasure ? 'default' : 'pointer'}
      flexShrink={0}
      style={{
        width: isMeasure ? 'max-content' : widthBudget?.itemWidth,
      }}
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
        width={isMeasure ? undefined : widthBudget?.changeWidth}
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
        width={isMeasure ? undefined : widthBudget?.priceWidth}
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

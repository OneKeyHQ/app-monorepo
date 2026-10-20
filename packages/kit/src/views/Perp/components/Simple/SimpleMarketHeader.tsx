import { Icon, SizableText, XStack, YStack } from '@onekeyhq/components';
import type { ISizableTextProps } from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { PerpDexBadge } from '@onekeyhq/kit/src/views/Market/components/PerpsBadges';
import {
  getHyperliquidTokenImageUris,
  parseDexCoin,
} from '@onekeyhq/shared/src/utils/perpsUtils';

export function SimpleMarketHeader({
  coin,
  width,
  price,
  changeLabel,
  changeColor,
  onPress,
  testID,
  priceVisibility,
}: {
  coin: string;
  width: number;
  price: string;
  changeLabel: string;
  changeColor: ISizableTextProps['color'];
  onPress?: () => void;
  testID?: string;
  priceVisibility?: { visible: boolean; reducedMotion: boolean };
}) {
  const { displayName, dexLabel } = parseDexCoin(coin);
  const showPrice = priceVisibility?.visible ?? true;
  let transition: '0ms' | 'quick' | undefined;
  let titleOffset: number | undefined;
  let priceOffset: number | undefined;
  if (priceVisibility) {
    transition = priceVisibility.reducedMotion ? '0ms' : 'quick';
    titleOffset = showPrice ? 0 : 10;
    priceOffset = showPrice ? 0 : 4;
  }
  return (
    <XStack
      testID={testID}
      width={width}
      maxWidth="100%"
      alignItems="center"
      gap="$2"
      onPress={onPress}
    >
      <Token
        size="md"
        tokenImageUris={getHyperliquidTokenImageUris(coin)}
        fallbackIcon="CryptoCoinOutline"
      />
      <YStack
        flex={onPress ? undefined : 1}
        flexShrink={onPress ? 1 : undefined}
        minWidth={0}
      >
        <XStack
          alignItems="center"
          gap="$1.5"
          transition={transition}
          y={titleOffset}
        >
          <SizableText size="$headingMd" numberOfLines={1} flexShrink={1}>
            {displayName}
          </SizableText>
          <PerpDexBadge dexLabel={dexLabel} borderRadius="$full" />
          {onPress ? (
            <Icon
              name="ChevronDownSmallOutline"
              size="$4"
              flexShrink={0}
              ml={-4}
              y={-1}
            />
          ) : null}
        </XStack>
        <XStack
          gap="$1"
          alignItems="center"
          opacity={showPrice ? 1 : 0}
          y={priceOffset}
          transition={transition}
          pointerEvents={priceVisibility ? 'none' : undefined}
          accessibilityElementsHidden={!showPrice}
          importantForAccessibility={showPrice ? 'auto' : 'no-hide-descendants'}
        >
          <SizableText
            size="$bodySm"
            color="$textSubdued"
            numberOfLines={1}
            flexShrink={1}
          >
            {price}
          </SizableText>
          <SizableText size="$bodySm" color={changeColor} numberOfLines={1}>
            {changeLabel}
          </SizableText>
        </XStack>
      </YStack>
    </XStack>
  );
}

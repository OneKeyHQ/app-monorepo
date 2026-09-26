import {
  NumberSizeableText,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IMarketStockPublicItem } from '@onekeyhq/shared/types/marketV2';

import { SubtitleText } from '../../../components/PerpsBadges';
import { MarketTestIDs } from '../../../testIDs';
import { MARKET_CELL_LINE_GAP, MARKET_CELL_LOGO_GAP } from '../MarketListCell';
import { PriceChangeBadge } from '../PriceChangeBadge';

import { parseMarketStockNumber } from './utils';

// The compact stock row shared by the mobile Stocks tab and the mobile banner
// detail list.
export function MobileMarketStockListItem({
  item,
  onPress,
}: {
  item: IMarketStockPublicItem;
  onPress: (item: IMarketStockPublicItem) => void;
}) {
  const price = parseMarketStockNumber(item.price);
  const priceChange = parseMarketStockNumber(item.priceChange24hPercent);
  const volume = parseMarketStockNumber(item.volume24h);
  return (
    // Same frame as the Trending row (`TokenListItem`): fixed 72px height,
    // 32px logo, 14px to the text, 4px between the two lines, and 8px
    // before the price.
    <XStack
      testID={MarketTestIDs.stockRow(item.stockId)}
      height={72}
      px="$5"
      py="$3"
      gap="$2"
      alignItems="center"
      borderRadius="$3"
      pressStyle={{ bg: '$bgActive' }}
      onPress={() => onPress(item)}
    >
      <XStack
        flex={1}
        minWidth={0}
        alignItems="center"
        gap={MARKET_CELL_LOGO_GAP}
      >
        <Token
          size="md"
          borderRadius="$full"
          round={platformEnv.isNativeAndroid}
          tokenImageUri={item.logoUrl}
          fallbackIcon="CryptoCoinOutline"
        />
        <YStack flex={1} minWidth={0} gap={MARKET_CELL_LINE_GAP}>
          <SizableText size="$bodyLgMedium" numberOfLines={1}>
            {item.symbol}
          </SizableText>
          {/* Same second line as a watchlist stock row (`TokenIdentityItem`):
              the capped company name, then the 24h volume. */}
          <XStack alignItems="center" gap="$1.5" minWidth={0} height={16}>
            {item.name ? (
              <SubtitleText subtitle={item.name} maxWidth={66} />
            ) : null}
            {volume ? (
              <NumberSizeableText
                size="$bodySm"
                color="$textSubdued"
                numberOfLines={1}
                formatter="marketCap"
                formatterOptions={{ currency: '$' }}
              >
                {volume}
              </NumberSizeableText>
            ) : null}
          </XStack>
        </YStack>
      </XStack>
      <XStack alignItems="center" gap="$2">
        {price === undefined ? (
          <SizableText
            size="$bodyLgMedium"
            color="$textSubdued"
            flexShrink={1}
            numberOfLines={1}
          >
            --
          </SizableText>
        ) : (
          <NumberSizeableText
            size="$bodyLgMedium"
            formatter="price"
            formatterOptions={{ currency: '$' }}
            flexShrink={1}
            numberOfLines={1}
          >
            {price}
          </NumberSizeableText>
        )}
        <PriceChangeBadge change={priceChange ?? '--'} />
      </XStack>
    </XStack>
  );
}

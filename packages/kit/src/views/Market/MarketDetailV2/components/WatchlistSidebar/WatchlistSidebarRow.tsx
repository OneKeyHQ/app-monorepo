import { memo, useCallback } from 'react';

import {
  Badge,
  NumberSizeableText,
  SizableText,
  Skeleton,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { IRenderItemParams } from '@onekeyhq/components/src/layouts/SortableListView/types';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { useNetworkLogoUri } from '@onekeyhq/kit/src/hooks/useNetworkLogoUri';
import { parseDexCoin } from '@onekeyhq/shared/src/utils/perpsUtils';
import { getTokenPriceChangeStyle } from '@onekeyhq/shared/src/utils/tokenUtils';

import { CommunityRecognizedBadge } from '../../../components/CommunityRecognizedBadge';
import { LeverageBadge, PerpDexBadge } from '../../../components/PerpsBadges';
import {
  getMarketWatchlistRowKind,
  getStockListingName,
} from '../../../MarketHomeV2/components/MarketTokenList/utils/marketWatchlistRowKind';
import { MarketTestIDs } from '../../../testIDs';
import { prewarmMarketTokenImages } from '../../utils/marketDetailImagePreload';
import {
  TOKEN_SELECTOR_NAME_GAP,
  TOKEN_SELECTOR_ROW_HEIGHT,
  TOKEN_SELECTOR_STAR_COLUMN_WIDTH,
} from '../TokenSelector/constants';
import { SelectorTokenStar } from '../TokenSelector/selectorStar';

import { getWatchlistSidebarPriceChange } from './filterWatchlistTokens';

import type { IMarketToken } from '../../../MarketHomeV2/components/MarketTokenList/MarketTokenData';

export const WATCHLIST_SIDEBAR_ROW_HEIGHT = TOKEN_SELECTOR_ROW_HEIGHT;

function MissingValue({
  size,
}: {
  size: '$bodyMdMedium' | '$bodySm' | '$bodySmMedium';
}) {
  return (
    <SizableText size={size} color="$textSubdued">
      --
    </SizableText>
  );
}

// A stock listing bundles several tokenized variants, so instead of a volume
// it reads like the token selector's Favorites row: market badges (US / HK)
// before the company name.
function StockListingSubtitle({ item }: { item: IMarketToken }) {
  const name = getStockListingName(item);
  return (
    <XStack height={16} alignItems="center" gap="$1.5" minWidth={0}>
      {item.stockTags?.filter(Boolean).map((tag) => (
        <Badge
          key={tag}
          badgeType="default"
          badgeSize="sm"
          px="$1"
          py="$0.5"
          flexShrink={0}
        >
          <Badge.Text size="$bodyXs" lineHeight={12}>
            {tag}
          </Badge.Text>
        </Badge>
      ))}
      {name ? (
        <SizableText
          size="$bodySm"
          color="$textSubdued"
          numberOfLines={1}
          flexShrink={1}
        >
          {name}
        </SizableText>
      ) : null}
    </XStack>
  );
}

function VolumeSubtitle({ volume }: { volume: number }) {
  return volume ? (
    <NumberSizeableText
      size="$bodySm"
      color="$textSubdued"
      numberOfLines={1}
      formatter="marketCap"
      formatterOptions={{ currency: '$' }}
    >
      {volume}
    </NumberSizeableText>
  ) : (
    <MissingValue size="$bodySm" />
  );
}

// The token selector's Favorites row, adjusted for the narrower sidebar: a
// headingSm symbol, a bodyMd price and the 24h volume (a listing's badges and
// name) underneath.
// Hover and selection follow the Trade > Stocks ticker list.
function BasicWatchlistSidebarRow({
  item,
  isSelected,
  isDragging = false,
  dragProps,
  onPress,
}: {
  item: IMarketToken;
  isSelected: boolean;
  isDragging?: boolean;
  // The sortable list's handle props. Like the Market table rows, the whole
  // row is the handle: a press opens the token, a drag reorders it.
  dragProps?: IRenderItemParams<IMarketToken>['dragProps'];
  onPress: (item: IMarketToken) => void;
}) {
  const networkLogoUri = useNetworkLogoUri({
    logoUri: item.networkLogoUri,
    networkId: item.networkId ?? '',
  });
  const handlePress = useCallback(() => onPress(item), [item, onPress]);
  const handlePressIn = useCallback(
    () => prewarmMarketTokenImages(item),
    [item],
  );

  const priceChange = getWatchlistSidebarPriceChange(item);
  const { changeColor, showPlusMinusSigns } = getTokenPriceChangeStyle({
    priceChange: priceChange ?? 0,
  });

  return (
    <XStack
      testID={MarketTestIDs.tokenListItem(item.symbol)}
      height={WATCHLIST_SIDEBAR_ROW_HEIGHT}
      px="$2.5"
      gap="$3"
      alignItems="center"
      borderRadius="$3"
      // A default arrow like the Market table rows; only the header sort
      // controls take the pointer.
      cursor="default"
      bg={isSelected && !isDragging ? '$bgActive' : '$bgApp'}
      hoverStyle={{ bg: '$bgHover' }}
      pressStyle={{ bg: '$bgActive' }}
      dataSet={dragProps}
      onPress={handlePress}
      onPressIn={handlePressIn}
    >
      {isDragging ? (
        // `$bgActive` is translucent: on the floating drag clone it is laid
        // over the opaque row so the rows beneath don't show through.
        <Stack
          position="absolute"
          inset={0}
          borderRadius="$3"
          bg="$bgActive"
          pointerEvents="none"
        />
      ) : null}
      <XStack alignItems="center" gap={TOKEN_SELECTOR_NAME_GAP}>
        <Stack
          width={TOKEN_SELECTOR_STAR_COLUMN_WIDTH}
          alignItems="center"
          justifyContent="center"
        >
          <SelectorTokenStar item={item} />
        </Stack>
        <Token
          size="md"
          tokenImageUri={item.tokenImageUri}
          tokenImageUris={item.tokenImageUris}
          networkImageUri={item.networkId ? networkLogoUri : undefined}
          fallbackIcon="CryptoCoinOutline"
        />
      </XStack>
      <YStack flex={1} minWidth={0} gap="$1" justifyContent="center">
        <XStack alignItems="center" gap="$1" minWidth={0}>
          <SizableText size="$headingSm" numberOfLines={1} flexShrink={1}>
            {item.symbol}
          </SizableText>
          {/* Tells perps apart from spot, as the Market Favorites list does. */}
          {item.maxLeverage ? (
            <LeverageBadge leverage={item.maxLeverage} />
          ) : null}
          <PerpDexBadge
            dexLabel={
              item.perpsCoin ? parseDexCoin(item.perpsCoin).dexLabel : undefined
            }
          />
          {item.communityRecognized ? <CommunityRecognizedBadge /> : null}
        </XStack>
        {getMarketWatchlistRowKind(item) === 'stock' ? (
          <StockListingSubtitle item={item} />
        ) : (
          <VolumeSubtitle volume={item.turnover} />
        )}
      </YStack>
      <YStack alignItems="flex-end" justifyContent="center" gap="$1">
        {Number.isFinite(item.price) ? (
          <NumberSizeableText
            size="$bodyMdMedium"
            numberOfLines={1}
            formatter="price"
            formatterOptions={{ currency: '$' }}
          >
            {item.price}
          </NumberSizeableText>
        ) : (
          <MissingValue size="$bodyMdMedium" />
        )}
        {priceChange === undefined ? (
          <MissingValue size="$bodySmMedium" />
        ) : (
          <NumberSizeableText
            size="$bodySmMedium"
            color={changeColor}
            formatter="priceChangeCapped"
            formatterOptions={{ showPlusMinusSigns }}
          >
            {priceChange}
          </NumberSizeableText>
        )}
      </YStack>
    </XStack>
  );
}

export const WatchlistSidebarRow = memo(BasicWatchlistSidebarRow);

function SkeletonLine({
  lineHeight,
  h,
  w,
}: {
  lineHeight: number;
  h: '$2.5' | '$3';
  w: '$12' | '$16';
}) {
  return (
    <Stack height={lineHeight} justifyContent="center">
      <Skeleton h={h} w={w} />
    </Stack>
  );
}

// The token selector's mobile Favorites skeleton row, on this row's insets and
// line heights: a star, the logo, the symbol over the volume, then the price
// over the change.
export function WatchlistSidebarRowSkeleton() {
  return (
    <XStack
      height={WATCHLIST_SIDEBAR_ROW_HEIGHT}
      px="$2.5"
      gap="$3"
      alignItems="center"
    >
      <XStack alignItems="center" gap={TOKEN_SELECTOR_NAME_GAP}>
        <Stack
          width={TOKEN_SELECTOR_STAR_COLUMN_WIDTH}
          alignItems="center"
          justifyContent="center"
        >
          <Skeleton w="$4" h="$4" radius="round" />
        </Stack>
        <Skeleton w="$8" h="$8" radius="round" />
      </XStack>
      <YStack flex={1} gap="$1">
        <SkeletonLine lineHeight={20} h="$3" w="$16" />
        <SkeletonLine lineHeight={16} h="$2.5" w="$12" />
      </YStack>
      <YStack alignItems="flex-end" gap="$1">
        <SkeletonLine lineHeight={20} h="$3" w="$16" />
        <SkeletonLine lineHeight={16} h="$2.5" w="$12" />
      </YStack>
    </XStack>
  );
}

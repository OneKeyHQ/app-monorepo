import type { FC, ReactNode } from 'react';
import { memo, useCallback } from 'react';

import {
  NumberSizeableText,
  SizableText,
  XStack,
  useMedia,
  useThemeName,
} from '@onekeyhq/components';
import { prewarmMarketTokenImages } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/utils/marketDetailImagePreload';
import { preloadMarketDetailV2Page } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/utils/marketDetailPagePreload';
import { resolveMarketStockId } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/utils/resolveIsStockToken';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { parseDexCoin } from '@onekeyhq/shared/src/utils/perpsUtils';

import { MarketTestIDs } from '../../../testIDs';
import { PriceChangeBadge } from '../../PriceChangeBadge';
import { getStockListingName } from '../utils/marketWatchlistRowKind';

import { TokenIdentityItem } from './TokenIdentityItem';

import type { IMarketToken } from '../MarketTokenData';
import type { GestureResponderEvent, LayoutChangeEvent } from 'react-native';

interface ITokenListItemProps {
  item: IMarketToken;
  onPress: () => void;
  leading?: ReactNode;
  showVolume?: boolean;
  onLongPress?: (event: GestureResponderEvent) => void;
  onPressIn?: (event: GestureResponderEvent) => void;
  onTouchMove?: (event: GestureResponderEvent) => void;
  onTouchEnd?: (event: GestureResponderEvent) => void;
  onPressOut?: (event: GestureResponderEvent) => void;
  onLayout?: (event: LayoutChangeEvent) => void;
  isPrimed?: boolean;
  isDragging?: boolean;
  bannerColumnMode?: 'compact' | 'two' | 'three';
}

// Fixed like the desktop table rows: 12px padding around the two-line identity
// block. A row's content can change after its first render (a listing's volume
// line appears once its quote loads), and the web virtualized lists cache the
// height they measure first, so a content-driven height left stale gaps.
const TOKEN_LIST_ITEM_HEIGHT = 72;

const IOS_DRAGGING_SHADOW_STYLE = {
  shadowColor: '#000',
  shadowOpacity: 0.2,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 4 },
} as const;

const ANDROID_DRAGGING_ELEVATION_STYLE = {
  elevation: 0,
} as const;

let DRAGGING_STYLE:
  | typeof IOS_DRAGGING_SHADOW_STYLE
  | typeof ANDROID_DRAGGING_ELEVATION_STYLE
  | undefined;

if (platformEnv.isNativeIOS) {
  DRAGGING_STYLE = IOS_DRAGGING_SHADOW_STYLE;
} else if (platformEnv.isNativeAndroid) {
  DRAGGING_STYLE = ANDROID_DRAGGING_ELEVATION_STYLE;
}

const BasicTokenListItem: FC<ITokenListItemProps> = ({
  item,
  onPress,
  leading,
  showVolume = true,
  onLongPress,
  onPressIn,
  onTouchMove,
  onTouchEnd,
  onPressOut,
  onLayout,
  isPrimed,
  isDragging,
  bannerColumnMode = 'compact',
}) => {
  const themeName = useThemeName();
  const media = useMedia();
  const isDarkMode = themeName?.includes('dark');
  const isHighlighted = Boolean(isPrimed || (isDragging && isDarkMode));
  const priceChange =
    item.priceChangeRaw === '-' ? item.priceChangeRaw : item.change24h;
  const preloadLayout =
    media.gtLg && !platformEnv.isNative ? 'desktop' : 'mobile';

  const prewarmTokenDetail = useCallback(() => {
    void preloadMarketDetailV2Page({
      includeBodyModules: true,
      includeHeavyModules: true,
      isStockRoute: Boolean(resolveMarketStockId(item)),
      layout: preloadLayout,
    });
    prewarmMarketTokenImages(item);
  }, [item, preloadLayout]);

  const handlePressIn = useCallback(
    (event: GestureResponderEvent) => {
      prewarmTokenDetail();
      onPressIn?.(event);
    },
    [onPressIn, prewarmTokenDetail],
  );

  const volumeColumn = !Number.isFinite(item.turnover) ? (
    <SizableText
      flex={1}
      textAlign="right"
      numberOfLines={1}
      size="$bodyMd"
      color="$textSubdued"
    >
      --
    </SizableText>
  ) : (
    <NumberSizeableText
      flex={1}
      textAlign="right"
      numberOfLines={1}
      size="$bodyMd"
      formatter="marketCap"
      formatterOptions={{ currency: '$' }}
    >
      {item.turnover}
    </NumberSizeableText>
  );
  const widePriceColumn = Number.isFinite(item.price) ? (
    <NumberSizeableText
      flex={1}
      textAlign="right"
      numberOfLines={1}
      size="$bodyLgMedium"
      formatter="price"
      formatterOptions={{ currency: '$' }}
    >
      {item.price}
    </NumberSizeableText>
  ) : (
    <SizableText
      flex={1}
      textAlign="right"
      numberOfLines={1}
      size="$bodyLgMedium"
      color="$textSubdued"
    >
      --
    </SizableText>
  );

  return (
    <XStack
      testID={MarketTestIDs.tokenListItem(item.symbol)}
      pressStyle={{ opacity: 0.8 }}
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={handlePressIn}
      onHoverIn={prewarmTokenDetail}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onPressOut={onPressOut}
      onLayout={onLayout}
      px="$5"
      py="$3"
      height={TOKEN_LIST_ITEM_HEIGHT}
      // Keeps a long name or subtitle from running into the price.
      gap="$2"
      alignItems="center"
      borderRadius="$3"
      bg={isHighlighted ? '$bgActive' : '$bgApp'}
      style={isDragging ? DRAGGING_STYLE : undefined}
    >
      <XStack
        flex={bannerColumnMode === 'compact' ? 1 : 2}
        alignItems="center"
        minWidth={0}
        gap="$2"
      >
        {leading}
        <TokenIdentityItem
          tokenLogoURI={item.tokenImageUri}
          tokenLogoURIs={item.tokenImageUris}
          networkLogoURI={item.networkLogoUri}
          networkId={item.networkId}
          symbol={item.symbol}
          address={item.address}
          showVolume={showVolume}
          volume={bannerColumnMode === 'three' ? undefined : item.turnover}
          communityRecognized={item.communityRecognized}
          stock={item.stock}
          maxLeverage={item.maxLeverage}
          perpsSubtitle={item.perpsSubtitle}
          stockListingName={getStockListingName(item)}
          perpsDexLabel={
            item.perpsCoin ? parseDexCoin(item.perpsCoin).dexLabel : undefined
          }
        />
      </XStack>

      {bannerColumnMode === 'compact' ? (
        <XStack alignItems="center" gap="$2">
          <NumberSizeableText
            userSelect="none"
            flexShrink={1}
            numberOfLines={1}
            size="$bodyLgMedium"
            formatter="price"
            formatterOptions={{ currency: '$' }}
          >
            {Number.isFinite(item.price) ? item.price : '--'}
          </NumberSizeableText>
          <PriceChangeBadge change={priceChange} />
        </XStack>
      ) : (
        <>
          {widePriceColumn}
          <XStack flex={1} jc="flex-end" minWidth={0}>
            <PriceChangeBadge change={priceChange} />
          </XStack>
          {bannerColumnMode === 'three' ? volumeColumn : null}
        </>
      )}
    </XStack>
  );
};

export const TokenListItem = memo(BasicTokenListItem);

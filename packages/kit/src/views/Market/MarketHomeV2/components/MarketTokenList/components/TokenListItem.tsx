import type { FC } from 'react';
import { memo } from 'react';

import { NumberSizeableText, XStack, useThemeName } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { PriceChangeBadge } from '../../PriceChangeBadge';

import { TokenIdentityItem } from './TokenIdentityItem';

import type { IMarketToken } from '../MarketTokenData';
import type { GestureResponderEvent, LayoutChangeEvent } from 'react-native';

interface ITokenListItemProps {
  item: IMarketToken;
  onPress: () => void;
  onLongPress?: (event: GestureResponderEvent) => void;
  onPressIn?: (event: GestureResponderEvent) => void;
  onTouchMove?: (event: GestureResponderEvent) => void;
  onTouchEnd?: (event: GestureResponderEvent) => void;
  onPressOut?: (event: GestureResponderEvent) => void;
  onLayout?: (event: LayoutChangeEvent) => void;
  isPrimed?: boolean;
  isDragging?: boolean;
}

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
  onLongPress,
  onPressIn,
  onTouchMove,
  onTouchEnd,
  onPressOut,
  onLayout,
  isPrimed,
  isDragging,
}) => {
  const themeName = useThemeName();
  const isDarkMode = themeName?.includes('dark');
  const isHighlighted = Boolean(isPrimed || (isDragging && isDarkMode));
  return (
    <XStack
      pressStyle={{ opacity: 0.8 }}
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={onPressIn}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onPressOut={onPressOut}
      onLayout={onLayout}
      px="$5"
      py="$3"
      alignItems="center"
      borderRadius="$3"
      bg={isHighlighted ? '$bgActive' : '$bgApp'}
      style={isDragging ? DRAGGING_STYLE : undefined}
    >
      <XStack flex={1} alignItems="center" minWidth={0}>
        <TokenIdentityItem
          tokenLogoURI={item.tokenImageUri}
          tokenLogoURIs={item.tokenImageUris}
          networkLogoURI={item.networkLogoUri}
          networkId={item.networkId}
          symbol={item.symbol}
          address={item.address}
          showVolume
          volume={item.turnover}
          communityRecognized={item.communityRecognized}
          stock={item.stock}
          maxLeverage={item.maxLeverage}
          perpsSubtitle={item.perpsSubtitle}
        />
      </XStack>

      <XStack alignItems="center" gap="$2">
        <NumberSizeableText
          userSelect="none"
          flexShrink={1}
          numberOfLines={1}
          size="$bodyLgMedium"
          formatter="price"
          formatterOptions={{ currency: '$' }}
        >
          {item.price}
        </NumberSizeableText>
        <PriceChangeBadge change={item.change24h} />
      </XStack>
    </XStack>
  );
};

export const TokenListItem = memo(BasicTokenListItem);

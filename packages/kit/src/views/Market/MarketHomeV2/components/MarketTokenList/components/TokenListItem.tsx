import type { FC } from 'react';
import { memo } from 'react';

import { NumberSizeableText, XStack } from '@onekeyhq/components';

import { PriceChangeBadge } from '../../PriceChangeBadge';

import { TokenIdentityItem } from './TokenIdentityItem';

import type { IMarketToken } from '../MarketTokenData';

interface ITokenListItemProps {
  item: IMarketToken;
  onPress: () => void;
  onLongPress?: () => void;
}

const BasicTokenListItem: FC<ITokenListItemProps> = ({
  item,
  onPress,
  onLongPress,
}) => {
  return (
    <XStack
      pressStyle={{ opacity: 0.8 }}
      onPress={onPress}
      onLongPress={onLongPress}
      px="$5"
      py="$3"
      alignItems="center"
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

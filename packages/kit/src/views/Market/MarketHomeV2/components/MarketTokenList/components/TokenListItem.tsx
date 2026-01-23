import type { FC } from 'react';
import { memo } from 'react';

import { NumberSizeableText, XStack, YStack } from '@onekeyhq/components';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import { TokenIdentityItem } from './TokenIdentityItem';
import type { IMarketToken } from '../MarketTokenData';

interface ITokenListItemProps {
  item: IMarketToken;
  onPress: () => void;
}

const BasicTokenListItem: FC<ITokenListItemProps> = ({ item, onPress }) => {
  const [settings] = useSettingsPersistAtom();
  const currency = settings.currencyInfo.symbol;

  return (
    <XStack
      pressStyle={{ opacity: 0.8 }}
      onPress={onPress}
      px="$3"
      py="$3"
      alignItems="center"
    >
      {/* Left side: Token Info + Volume */}
      <XStack flex={1} alignItems="center" minWidth={0}>
        <TokenIdentityItem
          tokenLogoURI={item.tokenImageUri}
          networkLogoURI={item.networkLogoUri}
          networkId={item.networkId}
          symbol={item.symbol}
          address={item.address}
          showVolume
          volume={item.turnover}
          communityRecognized={item.communityRecognized}
        />
      </XStack>

      {/* Right side: Price + Change */}
      <YStack alignItems="flex-end" justifyContent="center">
        <NumberSizeableText
          userSelect="none"
          flexShrink={1}
          numberOfLines={1}
          size="$bodyLgMedium"
          formatter="price"
          formatterOptions={{ currency }}
        >
          {item.price}
        </NumberSizeableText>
        <NumberSizeableText
          size="$bodyMd"
          color={Number(item.change24h) >= 0 ? '$textSuccess' : '$textCritical'}
          formatter="priceChange"
          formatterOptions={{
            showPlusMinusSigns: true,
          }}
        >
          {item.change24h}
        </NumberSizeableText>
      </YStack>
    </XStack>
  );
};

export const TokenListItem = memo(BasicTokenListItem);

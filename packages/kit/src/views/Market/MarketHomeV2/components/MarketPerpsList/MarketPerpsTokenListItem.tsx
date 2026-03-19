import type { FC } from 'react';
import { memo } from 'react';

import {
  NumberSizeableText,
  SizableText,
  SkeletonContainer,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';

import { LeverageBadge, SubtitleBadge } from '../../../components/PerpsBadges';
import { PriceChangeBadge } from '../PriceChangeBadge';

import type { IMarketPerpsToken } from './hooks/useMarketPerpsTokenList';

interface IMarketPerpsTokenListItemProps {
  item: IMarketPerpsToken;
  onPress: () => void;
}

const BasicMarketPerpsTokenListItem: FC<IMarketPerpsTokenListItemProps> = ({
  item,
  onPress,
}) => {
  const hasRealTimeData = item.markPrice !== undefined;

  return (
    <XStack
      pressStyle={{ opacity: 0.8 }}
      onPress={onPress}
      px="$5"
      py="$3"
      alignItems="center"
    >
      {/* Left side: Token Icon + Name + Badges + Volume */}
      <XStack flex={1} alignItems="center" gap="$3" minWidth={0}>
        <Token
          size="md"
          borderRadius="$full"
          tokenImageUri={item.tokenImageUrl}
          fallbackIcon="CryptoCoinOutline"
        />
        <YStack flex={1} minWidth={0}>
          <XStack alignItems="center" gap="$1" minWidth={0} overflow="hidden">
            <SizableText
              size="$bodyLgMedium"
              numberOfLines={1}
              flexShrink={1}
              ellipsizeMode="tail"
              userSelect="none"
            >
              {item.displayName}
            </SizableText>
            <LeverageBadge leverage={item.maxLeverage} />
            {item.subtitle ? <SubtitleBadge subtitle={item.subtitle} /> : null}
          </XStack>
          <XStack alignItems="center" height="$4">
            <SkeletonContainer isLoading={!hasRealTimeData}>
              <NumberSizeableText
                size="$bodyMd"
                color="$textSubdued"
                numberOfLines={1}
                formatter="marketCap"
                formatterOptions={{ currency: '$' }}
                userSelect="none"
              >
                {item.volume24h ?? '0'}
              </NumberSizeableText>
            </SkeletonContainer>
          </XStack>
        </YStack>
      </XStack>

      {/* Right side: Price + Change */}
      <SkeletonContainer isLoading={!hasRealTimeData}>
        <XStack alignItems="center" gap="$2">
          <NumberSizeableText
            userSelect="none"
            flexShrink={1}
            numberOfLines={1}
            size="$bodyLgMedium"
            formatter="price"
            formatterOptions={{ currency: '$' }}
          >
            {item.markPrice ?? '0'}
          </NumberSizeableText>
          <PriceChangeBadge change={item.change24hPercent ?? 0} />
        </XStack>
      </SkeletonContainer>
    </XStack>
  );
};

export const MarketPerpsTokenListItem = memo(BasicMarketPerpsTokenListItem);

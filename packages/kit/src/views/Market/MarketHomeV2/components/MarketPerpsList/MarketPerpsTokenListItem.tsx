import type { FC } from 'react';
import { memo, useMemo } from 'react';

import {
  NumberSizeableText,
  SizableText,
  SkeletonContainer,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';

import {
  LeverageBadge,
  SubtitleBadge,
} from '../../../components/PerpsBadges';

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

  const changeColor = useMemo(() => {
    if (item.change24hPercent === undefined) return '$textSubdued';
    return item.change24hPercent >= 0 ? '$textSuccess' : '$textCritical';
  }, [item.change24hPercent]);

  return (
    <XStack
      pressStyle={{ opacity: 0.8 }}
      onPress={onPress}
      px="$3"
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
          <XStack alignItems="center" gap="$1">
            <SizableText
              size="$bodyLgMedium"
              numberOfLines={1}
              flexShrink={1}
              userSelect="none"
            >
              {item.displayName}
            </SizableText>
            <LeverageBadge leverage={item.maxLeverage} />
            {item.subtitle ? <SubtitleBadge subtitle={item.subtitle} /> : null}
          </XStack>
          <SkeletonContainer isLoading={!hasRealTimeData}>
            <NumberSizeableText
              size="$bodyMd"
              color="$textSubdued"
              numberOfLines={1}
              formatter="marketCap"
              userSelect="none"
            >
              {item.volume24h ?? '0'}
            </NumberSizeableText>
          </SkeletonContainer>
        </YStack>
      </XStack>

      {/* Right side: Price + Change */}
      <YStack alignItems="flex-end" justifyContent="center">
        <SkeletonContainer isLoading={!hasRealTimeData}>
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
        </SkeletonContainer>
        <SkeletonContainer isLoading={!hasRealTimeData}>
          <NumberSizeableText
            size="$bodyMd"
            color={changeColor}
            formatter="priceChange"
            formatterOptions={{
              showPlusMinusSigns: true,
            }}
          >
            {item.change24hPercent ?? 0}
          </NumberSizeableText>
        </SkeletonContainer>
      </YStack>
    </XStack>
  );
};

export const MarketPerpsTokenListItem = memo(BasicMarketPerpsTokenListItem);

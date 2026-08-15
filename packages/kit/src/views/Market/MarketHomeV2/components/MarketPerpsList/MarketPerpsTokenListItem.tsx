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

import {
  LeverageBadge,
  PerpDexBadge,
  SubtitleText,
} from '../../../components/PerpsBadges';
import { MARKET_MOBILE_ROW_HEIGHT } from '../../layouts/mobileLayoutUtils';
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
      // Geometry matches the spot mobile row (TokenListItem).
      px="$5"
      py="$3"
      minHeight={MARKET_MOBILE_ROW_HEIGHT}
      alignItems="center"
      gap="$3"
    >
      {/* Left side: Token Icon + Name + Badges + Volume */}
      <XStack
        flexGrow={1}
        flexBasis={0}
        alignItems="center"
        gap="$3"
        minWidth={0}
        overflow="hidden"
      >
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
              adjustsFontSizeToFit
              minimumFontScale={0.85}
              userSelect="none"
            >
              {item.displayName}
            </SizableText>
            <LeverageBadge leverage={item.maxLeverage} compact />
            <PerpDexBadge dexLabel={item.dexLabel} compact />
          </XStack>
          <XStack
            alignItems="center"
            gap="$1"
            minWidth={0}
            overflow="hidden"
            pr="$3"
          >
            {item.subtitle ? <SubtitleText subtitle={item.subtitle} /> : null}
            <SkeletonContainer isLoading={!hasRealTimeData}>
              <NumberSizeableText
                size="$bodySm"
                color="$textSubdued"
                numberOfLines={1}
                flexShrink={0}
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
        <XStack alignItems="center" gap="$2" flexShrink={0}>
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

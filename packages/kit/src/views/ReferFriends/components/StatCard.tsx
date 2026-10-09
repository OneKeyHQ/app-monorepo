import {
  IconButton,
  SizableText,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import type { ColorTokens } from '@onekeyhq/components/src/shared/tamagui';
import { useInviteCardStyle } from '@onekeyhq/kit/src/views/ReferFriends/pages/InviteReward/components/useInviteCardStyle';

import { RewardValue } from './RewardSummaryCard';

export interface IStatCardProps {
  title: string;
  value: string;
  isCurrency?: boolean;
  // Show `value` in this currency instead of the wallet currency.
  fixedCurrency?: string;
  prefix?: string;
  subtitle?: string;
  showRefreshButton?: boolean;
  isLoading?: boolean;
  onRefresh?: () => void;
  valueColor?: ColorTokens;
}

// Pointer layouts' reward stat tile; compact layouts sum the same figures up
// in RewardSummaryCard.
export function StatCard({
  title,
  value,
  isCurrency = true,
  fixedCurrency,
  prefix,
  subtitle,
  showRefreshButton,
  isLoading,
  onRefresh,
  valueColor = '$text',
}: IStatCardProps) {
  const { xl } = useMedia();
  const cardStyle = useInviteCardStyle();

  return (
    // Same card as the overview page; no decorative icon tile, so the figure
    // leads and the card stays compact.
    <YStack flex={1} flexBasis={0} minWidth={0} p="$5" {...cardStyle}>
      <YStack gap={subtitle ? '$2.5' : undefined}>
        <YStack>
          <XStack ai="center" jc="space-between" gap="$2">
            <SizableText
              size="$bodyLgMedium"
              color="$textSubdued"
              numberOfLines={1}
              flexShrink={1}
            >
              {title}
            </SizableText>
            {showRefreshButton ? (
              <IconButton
                testID="refer-friends-get-value-size-icon-btn"
                icon="RefreshCcwOutline"
                variant="tertiary"
                size="small"
                loading={isLoading}
                onPress={onRefresh}
              />
            ) : null}
          </XStack>
          <RewardValue
            value={value}
            isCurrency={isCurrency}
            fixedCurrency={fixedCurrency}
            prefix={prefix}
            // Three tiles share the row; mid-size windows step the figure down.
            size={xl ? '$heading3xl' : '$heading4xl'}
            color={valueColor}
          />
        </YStack>
        {subtitle ? (
          <SizableText size="$bodyMd" color="$textSubdued">
            {subtitle}
          </SizableText>
        ) : null}
      </YStack>
    </YStack>
  );
}

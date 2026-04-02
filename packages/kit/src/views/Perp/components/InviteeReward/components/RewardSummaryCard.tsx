import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  NumberSizeableText,
  SizableText,
  Skeleton,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { InfoIcon } from '@onekeyhq/kit/src/views/ReferFriends/pages/InviteReward/components/RewardCard/InfoIcon';
import { ETranslations } from '@onekeyhq/shared/src/locale';

interface IRewardSummaryCardProps {
  isLoading?: boolean;
  totalBonus?: string;
  undistributed?: string;
  tokenSymbol?: string;
}

export function RewardSummaryCard({
  isLoading,
  totalBonus,
  undistributed,
  tokenSymbol,
}: IRewardSummaryCardProps) {
  const intl = useIntl();
  const displayTotalBonus = totalBonus ?? '0';
  const displayUndistributed = undistributed ?? '0';
  const displayTokenSymbol = tokenSymbol ?? 'USDC';
  const hasUndistributed = new BigNumber(displayUndistributed).gt(0);

  const tooltipContent = intl.formatMessage({
    id: ETranslations.earn_reward_distribution_schedule,
  });

  return (
    <YStack gap="$2">
      <XStack ai="center" gap="$2">
        <XStack ai="center" gap="$1.5" py="$0.5">
          <SizableText size="$headingSm">
            {intl.formatMessage({
              id: ETranslations.dexmarket_total,
            })}
          </SizableText>
        </XStack>
      </XStack>

      <XStack ai="center" gap="$1.5" flexWrap="nowrap">
        {isLoading ? (
          <Skeleton width={120} height={28} />
        ) : (
          <NumberSizeableText
            size="$bodyMd"
            formatter="value"
            formatterOptions={{
              tokenSymbol: displayTokenSymbol,
            }}
            numberOfLines={1}
          >
            {displayTotalBonus}
          </NumberSizeableText>
        )}

        {hasUndistributed ? (
          <XStack ai="center" gap="$1" flexShrink={1}>
            <SizableText size="$bodyMd" color="$textSubdued">
              +
            </SizableText>
            <NumberSizeableText
              size="$bodyMd"
              color="$textSubdued"
              formatter="value"
              formatterOptions={{
                tokenSymbol: displayTokenSymbol,
              }}
              numberOfLines={1}
              flexShrink={1}
            >
              {displayUndistributed}
            </NumberSizeableText>
            <SizableText
              size="$bodyMd"
              color="$textSubdued"
              numberOfLines={1}
              flexShrink={0}
            >
              {intl.formatMessage({
                id: ETranslations.referral_undistributed,
              })}
            </SizableText>
          </XStack>
        ) : null}

        <InfoIcon tooltip={tooltipContent} size="$5" />
      </XStack>
    </YStack>
  );
}

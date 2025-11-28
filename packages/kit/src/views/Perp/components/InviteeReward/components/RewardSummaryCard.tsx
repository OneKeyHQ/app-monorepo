import BigNumber from 'bignumber.js';

import {
  Icon,
  NumberSizeableText,
  SizableText,
  Skeleton,
  Tooltip,
  XStack,
  YStack,
} from '@onekeyhq/components';

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
  const displayTotalBonus = totalBonus ?? '0';
  const displayUndistributed = undistributed ?? '0';
  const displayTokenSymbol = tokenSymbol ?? 'USDC';
  const hasUndistributed = new BigNumber(displayUndistributed).gt(0);

  return (
    <YStack gap="$2">
      <XStack ai="center" gap="$2">
        <XStack ai="center" gap="$1.5" py="$0.5">
          <Icon name="OnekeyBrand" />
          <SizableText size="$bodySm">Referral bonus</SizableText>
        </XStack>
      </XStack>

      <XStack ai="center" gap="$1.5" flexWrap="nowrap">
        {isLoading ? (
          <Skeleton width={120} height={28} />
        ) : (
          <NumberSizeableText
            size="$bodySm"
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
            <SizableText size="$bodySm" color="$textSubdued">
              +
            </SizableText>
            <NumberSizeableText
              size="$bodySm"
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
              size="$bodySm"
              color="$textSubdued"
              numberOfLines={1}
              flexShrink={0}
            >
              Undistributed
            </SizableText>
          </XStack>
        ) : null}

        <Tooltip
          renderTrigger={
            <Icon
              name="InfoCircleOutline"
              size="$5"
              color="$iconSubdued"
              cursor="pointer"
            />
          }
          renderContent="This is your total referral bonus from trading on Perps."
        />
      </XStack>
    </YStack>
  );
}

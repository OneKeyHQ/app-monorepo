import BigNumber from 'bignumber.js';
import Svg, { Circle } from 'react-native-svg';

import type { IIconProps } from '@onekeyhq/components';
import {
  Divider,
  Icon,
  SizableText,
  Stack,
  XStack,
  YStack,
  useTheme,
} from '@onekeyhq/components';
import { HELP_CENTER_URL } from '@onekeyhq/shared/src/config/appConfig';
import type { IPerpsRecallProgress } from '@onekeyhq/shared/src/referralCode/recall';
import { formatDate } from '@onekeyhq/shared/src/utils/dateUtils';

import { openGuideUrl } from './Guide/perpGuideData';
import { PerpsRecallIllustration } from './PerpsRecallIllustration';

export function formatRecallAmount(value: string, minimumDecimals = 2) {
  const amount = new BigNumber(value);
  return amount.toFormat(
    Math.max(minimumDecimals, amount.decimalPlaces() ?? 0),
  );
}

function formatRewardAmount(value: string) {
  return formatRecallAmount(value, 0);
}

export function PerpsRecallProgressCard({
  progress,
  hasEnded,
  onOpenHelp,
}: {
  progress: IPerpsRecallProgress;
  hasEnded: boolean;
  onOpenHelp?: () => void;
}) {
  const deadline = formatDate(progress.deadline, {
    formatTemplate: 'MMM d, yyyy',
    locale: 'en-US',
    timeZone: 'UTC',
  });
  const achieved = progress.status === 'achieved';
  const paid = progress.payoutStatus === 'paid';
  const skipped = progress.payoutStatus === 'skipped';
  const awaitingPayout = achieved && progress.payoutStatus === 'pending';
  const canTrade = !hasEnded && !achieved && !paid && !skipped;
  const target = progress.topTarget;
  const percentage = BigNumber.minimum(
    100,
    new BigNumber(progress.volume).div(target).times(100),
  ).toNumber();
  let featuredReward = progress.totalReward;
  if (achieved || hasEnded) {
    featuredReward = progress.earnedReward;
  }
  if (paid) {
    featuredReward = progress.paidAmount ?? progress.earnedReward;
  }
  let statusIcon: IIconProps['name'] = 'InfoCircleOutline';
  if (paid) {
    statusIcon = 'CheckRadioOutline';
  } else if (canTrade) {
    statusIcon = 'LockOutline';
  } else if (achieved && !skipped) {
    statusIcon = 'ClockTimeHistoryOutline';
  }

  let statusTitle = 'Awaiting payout';
  if (paid) {
    statusTitle = 'Reward received';
  } else if (skipped) {
    statusTitle = 'Payout skipped';
  } else if (canTrade && progress.current) {
    statusTitle = 'Reward locked';
  } else if (!achieved && hasEnded) {
    statusTitle =
      progress.activityStatus === 'ended'
        ? 'Target not reached'
        : 'Awaiting final results';
  }

  return (
    <YStack testID="perps-recall-progress" gap="$6" py="$2">
      <XStack alignItems="center" gap="$3">
        <YStack flex={1} minWidth={0} gap="$2">
          <YStack gap="$1">
            <SizableText size="$bodyMd" color="$textSubdued">
              Total reward
            </SizableText>
            <XStack gap="$2" alignItems="baseline" flexWrap="wrap">
              <SizableText
                size="$heading5xl"
                maxWidth="100%"
                testID="perps-recall-reward"
              >
                {formatRewardAmount(featuredReward)}
              </SizableText>
              <SizableText size="$headingLg" color="$textSubdued">
                USDC
              </SizableText>
            </XStack>
          </YStack>
          <XStack
            testID="perps-recall-status"
            alignSelf="flex-start"
            maxWidth="100%"
            alignItems="center"
            gap="$1"
            px="$2"
            py="$1"
            borderRadius="$full"
            bg={paid ? '$brand3' : '$bgSubdued'}
            {...(awaitingPayout && { bg: '$bgInfo' })}
          >
            <Icon
              name={statusIcon}
              size="$3.5"
              color={paid ? '$textInteractive' : '$iconSubdued'}
              {...(awaitingPayout && { color: '$iconInfo' })}
            />
            <SizableText
              size="$bodyXsMedium"
              color={paid ? '$textInteractive' : '$textSubdued'}
              {...(awaitingPayout && { color: '$textInfo' })}
              flexShrink={1}
            >
              {statusTitle}
            </SizableText>
          </XStack>
        </YStack>
        <Stack
          width="32%"
          maxWidth={128}
          aspectRatio={144 / 128}
          flexShrink={0}
          pointerEvents="none"
          accessible={false}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <PerpsRecallIllustration />
        </Stack>
      </XStack>

      <YStack gap="$4" p="$3" borderRadius="$4" bg="$bgStrong">
        <XStack alignItems="center" gap="$3">
          <RecallProgressRing percentage={percentage} achieved={achieved} />
          <YStack flex={1} minWidth={0} gap="$1">
            <SizableText size="$bodyMdMedium">
              {achieved ? 'Trading target completed' : 'Trading volume'}
            </SizableText>
            <SizableText
              size="$bodySm"
              color="$textSubdued"
              testID="perps-recall-traded"
            >
              {achieved
                ? `$${formatRewardAmount(progress.volume)}`
                : `$${formatRewardAmount(progress.volume)} / $${formatRewardAmount(target)}`}
            </SizableText>
          </YStack>
        </XStack>
        <Divider borderColor="$borderSubdued" />
        <SizableText
          testID="perps-recall-details"
          size="$bodySm"
          color="$textSubdued"
        >
          {`Campaign ${hasEnded ? 'ended' : 'ends'} on ${deadline}. `}
          <SizableText
            testID="perps-recall-help"
            size="$bodySm"
            color="$textInteractive"
            textDecorationLine="underline"
            cursor="pointer"
            accessibilityRole="link"
            onPress={onOpenHelp ?? (() => openGuideUrl(HELP_CENTER_URL))}
          >
            Learn more
          </SizableText>{' '}
          about this campaign.
        </SizableText>
      </YStack>
    </YStack>
  );
}

function RecallProgressRing({
  percentage,
  achieved,
}: {
  percentage: number;
  achieved: boolean;
}) {
  const theme = useTheme();
  const circumference = 2 * Math.PI * 20;
  return (
    <Stack
      width={48}
      height={48}
      flexShrink={0}
      alignItems="center"
      justifyContent="center"
      accessibilityRole="progressbar"
      accessibilityLabel="Trading volume"
      accessibilityValue={{ min: 0, max: 100, now: percentage }}
    >
      <Svg width={48} height={48} viewBox="0 0 48 48">
        <Circle
          cx={24}
          cy={24}
          r={20}
          fill="none"
          stroke={theme.borderSubdued.val}
          strokeWidth={5}
        />
        {percentage > 0 ? (
          <Circle
            cx={24}
            cy={24}
            r={20}
            fill="none"
            stroke={theme.bgAccent.val}
            strokeWidth={5}
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - percentage / 100)}
            strokeLinecap="round"
            transform="rotate(-90 24 24)"
          />
        ) : null}
      </Svg>
      <Stack
        position="absolute"
        top={0}
        right={0}
        bottom={0}
        left={0}
        alignItems="center"
        justifyContent="center"
      >
        <SizableText
          size="$bodySmMedium"
          fontSize={10}
          lineHeight={14}
          textAlign="center"
          color={achieved ? '$textInteractive' : '$textSubdued'}
          testID="perps-recall-percentage"
        >
          {`${Math.floor(percentage)}%`}
        </SizableText>
      </Stack>
    </Stack>
  );
}

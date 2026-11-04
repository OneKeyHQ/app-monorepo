import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';
import Svg, { Circle } from 'react-native-svg';

import type { IIconProps } from '@onekeyhq/components';
import {
  Divider,
  Icon,
  Image,
  SizableText,
  Stack,
  XStack,
  YStack,
  useTheme,
} from '@onekeyhq/components';
import { useThemeVariant } from '@onekeyhq/kit/src/hooks/useThemeVariant';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IPerpsRecallProgress } from '@onekeyhq/shared/src/referralCode/recall';

import { openGuideUrl } from './Guide/perpGuideData';

function formatRewardAmount(value: string) {
  const amount = new BigNumber(value);
  return amount.toFormat(amount.decimalPlaces() ?? 0);
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
  const intl = useIntl();
  const isDarkTheme = useThemeVariant() === 'dark';
  const surfaceBg = isDarkTheme ? '$bgStrong' : '$bgSubdued';
  const deadline = intl.formatDate(new Date(progress.deadline), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
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

  let statusTitle: ETranslations = ETranslations.rebate_awaiting_payout;
  if (paid) {
    statusTitle = ETranslations.perps_recall_reward_received__title;
  } else if (skipped) {
    statusTitle = ETranslations.perps_recall_payout_skipped__title;
  } else if (canTrade && progress.current) {
    statusTitle = ETranslations.perps_recall_reward_locked__title;
  } else if (!achieved && hasEnded) {
    statusTitle =
      progress.activityStatus === 'ended'
        ? ETranslations.perps_recall_target_not_reached__title
        : ETranslations.perps_recall_awaiting_results__title;
  }

  return (
    <YStack testID="perps-recall-progress" gap="$6" py="$2">
      <XStack alignItems="center" gap="$3">
        <YStack flex={1} minWidth={0} gap="$2">
          <YStack gap="$1">
            <SizableText size="$bodyMd" color="$textSubdued">
              {intl.formatMessage({ id: ETranslations.referral_total_reward })}
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
            bg={paid ? '$brand3' : surfaceBg}
            {...(awaitingPayout && { bg: '$bgInfo' })}
          >
            <Icon
              name={statusIcon}
              size="$3.5"
              color={paid ? '$textInteractive' : '$icon'}
              {...(awaitingPayout && { color: '$iconInfo' })}
            />
            <SizableText
              size="$bodyXsMedium"
              color={paid ? '$textInteractive' : '$textSubdued'}
              {...(awaitingPayout && { color: '$textInfo' })}
              flexShrink={1}
            >
              {intl.formatMessage({ id: statusTitle })}
            </SizableText>
          </XStack>
        </YStack>
        <Stack
          width="32%"
          maxWidth={128}
          aspectRatio={1}
          flexShrink={0}
          transform={[{ translateX: -10 }, { scale: 1.1 }]}
          pointerEvents="none"
          accessible={false}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Image
            width="100%"
            height="100%"
            resizeMode="contain"
            source={require('@onekeyhq/kit/assets/perps/recall-reward-gift.png')}
          />
        </Stack>
      </XStack>

      <YStack gap="$4" p="$3" borderRadius="$4" bg={surfaceBg}>
        <XStack alignItems="center" gap="$3">
          <RecallProgressRing percentage={percentage} achieved={achieved} />
          <YStack flex={1} minWidth={0} gap="$1">
            <SizableText size="$bodyMdMedium">
              {intl.formatMessage({
                id: achieved
                  ? ETranslations.perps_recall_target_completed__title
                  : ETranslations.referral_perps_trading_volume,
              })}
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
        <Divider
          borderColor={isDarkTheme ? '$borderStrong' : '$borderSubdued'}
        />
        <SizableText
          testID="perps-recall-details"
          size="$bodySm"
          color="$textSubdued"
        >
          {intl.formatMessage(
            {
              id: hasEnded
                ? ETranslations.perps_recall_campaign_ended__desc
                : ETranslations.perps_recall_campaign_ends__desc,
            },
            { date: deadline },
          )}
          {progress.blogUrl ? (
            <>
              {' '}
              <SizableText
                testID="perps-recall-help"
                size="$bodySm"
                color="$textInteractive"
                textDecorationLine="underline"
                cursor="pointer"
                accessibilityRole="link"
                onPress={
                  onOpenHelp ??
                  (() => {
                    if (progress.blogUrl) openGuideUrl(progress.blogUrl);
                  })
                }
              >
                {intl.formatMessage({ id: ETranslations.global_learn_more })}
              </SizableText>
            </>
          ) : null}
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
  const intl = useIntl();
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
      accessibilityLabel={intl.formatMessage({
        id: ETranslations.referral_perps_trading_volume,
      })}
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

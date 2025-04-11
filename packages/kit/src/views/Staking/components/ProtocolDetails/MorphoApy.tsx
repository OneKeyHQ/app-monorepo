import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import { Icon, SizableText, XStack, YStack } from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { formatApy } from '@onekeyhq/kit/src/views/Staking/components/utils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  IEarnTokenItem,
  IRewardApys,
} from '@onekeyhq/shared/types/staking';

const isPositiveNumber = (value: string | number | undefined): boolean => {
  if (!value) return false;
  return new BigNumber(value).isGreaterThan(0);
};

export function MorphoApy({
  apys,
  rewardAssets,
  poolFee,
}: {
  apys: IRewardApys;
  rewardAssets?: Record<string, IEarnTokenItem>;
  poolFee?: string;
}) {
  const intl = useIntl();
  const showNativeApy = isPositiveNumber(apys.dailyApy);
  const showTotalApy = isPositiveNumber(apys.performanceFee);
  const rewardTokenEntries = Object.entries(apys.rewards ?? {}).filter(
    ([address, apy]) => isPositiveNumber(apy) && rewardAssets?.[address],
  );

  return (
    <YStack p="$5">
      <YStack gap="$2.5">
        {showNativeApy ? (
          <XStack gap="$2" alignItems="center" justifyContent="space-between">
            <XStack gap="$2" alignItems="center">
              <Icon name="ChartTrendingUpOutline" size="$5" />
              <SizableText color="$textSubdued" size="$bodyMd">
                {intl.formatMessage({
                  id: ETranslations.earn_native_apy,
                })}
              </SizableText>
            </XStack>
            <SizableText size="$bodyMdMedium">
              +{formatApy(apys.dailyApy)}%
            </SizableText>
          </XStack>
        ) : null}

        {rewardTokenEntries.map(([address, apy]) => {
          const token = rewardAssets?.[address];
          return (
            <XStack
              key={address}
              gap="$2"
              alignItems="center"
              justifyContent="space-between"
            >
              <XStack gap="$2" alignItems="center">
                <Token tokenImageUri={token?.info?.logoURI ?? ''} size="xs" />
                <SizableText color="$textSubdued" size="$bodyMd">
                  {token?.info?.symbol ?? ''}
                </SizableText>
              </XStack>
              <SizableText size="$bodyMdMedium">+{formatApy(apy)}%</SizableText>
            </XStack>
          );
        })}
        <XStack gap="$2" alignItems="center" justifyContent="space-between">
          <XStack gap="$2" alignItems="center">
            <Icon name="GiftOutline" size="$5" />
            <SizableText color="$textSubdued" size="$bodyMd">
              {intl.formatMessage({
                id: ETranslations.earn_referral_referral_reward,
              })}
            </SizableText>
          </XStack>
          <SizableText size="$bodyMdMedium">
            {`+${formatApy(apys.rebateReward)}%`}
          </SizableText>
        </XStack>
        {showTotalApy ? (
          <XStack gap="$2" alignItems="center" justifyContent="space-between">
            <XStack gap="$2" alignItems="center">
              <Icon name="HandCoinsOutline" size="$5" />
              <SizableText color="$textSubdued" size="$bodyMd">
                {`${intl.formatMessage({
                  id: ETranslations.earn_performance_fee,
                })}${poolFee ? ` (${poolFee}%)` : ''}`}
              </SizableText>
            </XStack>
            <SizableText size="$bodyMdMedium">
              {`-${formatApy(apys.performanceFee)}%`}
            </SizableText>
          </XStack>
        ) : null}
      </YStack>
      <XStack
        mt="$4"
        py="$3"
        borderWidth={StyleSheet.hairlineWidth}
        borderColor="$borderSubdued"
        borderRadius="$2"
        justifyContent="space-between"
        width="100%"
      >
        <YStack flex={1} alignItems="center" justifyContent="space-between">
          <SizableText color="$textSubdued" size="$bodySm">
            {intl.formatMessage({
              id: ETranslations.earn_last_day,
            })}
          </SizableText>
          <SizableText color="$text" size="$bodyMdMedium">
            {isPositiveNumber(apys.dailyNetApy)
              ? `${formatApy(apys.dailyNetApy)}%`
              : '-'}
          </SizableText>
        </YStack>
        <YStack flex={1} alignItems="center" justifyContent="space-between">
          <SizableText color="$textSubdued" size="$bodySm">
            {intl.formatMessage({
              id: ETranslations.earn_last_week,
            })}
          </SizableText>
          <SizableText color="$text" size="$bodyMdMedium">
            {isPositiveNumber(apys.weeklyNetApy)
              ? `${formatApy(apys.weeklyNetApy)}%`
              : '-'}
          </SizableText>
        </YStack>
        <YStack flex={1} alignItems="center" justifyContent="space-between">
          <SizableText color="$textSubdued" size="$bodySm">
            {intl.formatMessage({
              id: ETranslations.earn_last_month,
            })}
          </SizableText>
          <SizableText color="$text" size="$bodyMdMedium">
            {isPositiveNumber(apys.monthlyNetApy)
              ? `${formatApy(apys.monthlyNetApy)}%`
              : '-'}
          </SizableText>
        </YStack>
      </XStack>
    </YStack>
  );
}

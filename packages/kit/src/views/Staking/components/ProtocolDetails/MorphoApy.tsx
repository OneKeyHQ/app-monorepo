import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import { Icon, SizableText, XStack, YStack } from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IRewardApys } from '@onekeyhq/shared/types/staking';
import type { IToken } from '@onekeyhq/shared/types/token';

const formatApy = (apy: string | number | undefined): string => {
  if (!apy) return '0';
  return new BigNumber(apy).decimalPlaces(2, BigNumber.ROUND_DOWN).toFixed(2);
};

const isPositiveNumber = (value: string | number | undefined): boolean => {
  if (!value) return false;
  return new BigNumber(value).isGreaterThan(0);
};

export function MorphoApy({
  apys,
  rewardAssets,
}: {
  apys: IRewardApys;
  rewardAssets?: Record<string, IToken>;
}) {
  const intl = useIntl();
  const showNativeApy = isPositiveNumber(apys.rate);
  const showTotalApy = isPositiveNumber(apys.netApy);
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
            <SizableText color="$textSubdued">
              +{formatApy(apys.rate)}%
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
                <Token tokenImageUri={token?.logoURI ?? ''} size="xs" />
                <SizableText color="$textSubdued" size="$bodyMd">
                  {token?.symbol ?? ''}
                </SizableText>
              </XStack>
              <SizableText color="$textSubdued">+{formatApy(apy)}%</SizableText>
            </XStack>
          );
        })}
        {showTotalApy ? (
          <XStack gap="$2" alignItems="center" justifyContent="space-between">
            <XStack gap="$2" alignItems="center">
              <Icon name="CoinsAddOutline" size="$5" />
              <SizableText color="$textSubdued" size="$bodyMd">
                {intl.formatMessage({
                  id: ETranslations.earn_total_apy,
                })}
              </SizableText>
            </XStack>
            <SizableText color="$textSuccess">
              = {formatApy(apys.netApy)}%
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

import type { ComponentProps } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Anchor,
  Icon,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { IColorTokens } from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { formatApy } from '@onekeyhq/kit/src/views/Staking/components/utils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import type {
  IEarnTokenItem,
  IRewardApys,
} from '@onekeyhq/shared/types/staking';

import { useEarnEventActive } from '../../hooks/useEarnEventActive';

const isPositiveNumber = (value: string | number | undefined): boolean => {
  if (!value) return false;
  return new BigNumber(value).isGreaterThan(0);
};

// Reusable component for displaying a single line item in the APY details
type IApyLineItemProps = {
  iconName?: ComponentProps<typeof Icon>['name'];
  iconColor?: IColorTokens;
  label: string | ReturnType<typeof useIntl>['formatMessage'];
  value?: string | number;
  valuePrefix?: '+' | '-';
  tokenInfo?: {
    logoURI?: string;
    symbol?: string;
  };
};

function ApyLineItem({
  iconName,
  iconColor = '$iconSubdued',
  label,
  value,
  valuePrefix = '+',
  tokenInfo,
}: IApyLineItemProps) {
  // Don't render if the value is not positive
  if (!isPositiveNumber(value)) {
    return null;
  }

  // Determine the icon element based on props
  let iconElement = null;
  if (tokenInfo) {
    iconElement = <Token tokenImageUri={tokenInfo.logoURI ?? ''} size="xs" />;
  } else if (iconName) {
    iconElement = <Icon name={iconName} size="$5" color={iconColor} />;
  }

  return (
    <XStack gap="$2" alignItems="center" justifyContent="space-between">
      <XStack gap="$2" alignItems="center">
        {/* Render the determined icon element */}
        {iconElement}
        <SizableText color="$textSubdued" size="$bodyMd">
          {label}
        </SizableText>
      </XStack>
      <SizableText size="$bodyMdMedium">
        {valuePrefix}
        {formatApy(value)}%
      </SizableText>
    </XStack>
  );
}

function MorphoApyInternal({
  apys,
  rewardAssets,
  poolFee,
}: {
  apys: IRewardApys;
  rewardAssets?: Record<string, IEarnTokenItem>;
  poolFee?: string;
}) {
  const intl = useIntl();
  const rewardTokenEntries = Object.entries(apys?.rewards ?? {}).filter(
    ([address, apy]) => isPositiveNumber(apy) && rewardAssets?.[address],
  );

  return (
    <YStack p="$5">
      <YStack gap="$2.5">
        <ApyLineItem
          iconName="ChartTrendingUpOutline"
          label={intl.formatMessage({ id: ETranslations.earn_native_apy })}
          value={apys?.dailyApy}
        />
        {rewardTokenEntries.map(([address, apy]) => {
          const token = rewardAssets?.[address];
          return (
            <ApyLineItem
              key={address}
              tokenInfo={{
                logoURI: token?.info?.logoURI,
                symbol: token?.info?.symbol,
              }}
              label={token?.info?.symbol ?? ''} // Use symbol as label for token rewards
              value={apy}
            />
          );
        })}
        {/* <ApyLineItem
          iconName="GiftOutline"
          label={intl.formatMessage({
            id: ETranslations.earn_referral_referral_reward,
          })}
          value={apys?.rebateReward}
        /> */}
        <ApyLineItem
          iconName="HandCoinsOutline"
          label={`${intl.formatMessage({
            id: ETranslations.earn_performance_fee,
          })}${poolFee ? ` (${poolFee}%)` : ''}`}
          value={apys?.performanceFee}
          valuePrefix="-"
        />
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
            {isPositiveNumber(apys?.dailyNetApy)
              ? `${formatApy(apys?.dailyNetApy)}%`
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
            {isPositiveNumber(apys?.weeklyNetApy)
              ? `${formatApy(apys?.weeklyNetApy)}%`
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
            {isPositiveNumber(apys?.monthlyNetApy)
              ? `${formatApy(apys?.monthlyNetApy)}%`
              : '-'}
          </SizableText>
        </YStack>
      </XStack>
    </YStack>
  );
}

function FalconApyInternal({
  apys,
  poolFee,
  isEventActive,
}: {
  apys: IRewardApys;
  poolFee?: string;
  isEventActive: boolean;
}) {
  const intl = useIntl();

  return (
    <YStack p="$5">
      <YStack gap="$2.5">
        <ApyLineItem
          iconName="ChartTrendingUpOutline"
          label={intl.formatMessage({ id: ETranslations.earn_base_apy })}
          value={apys?.weeklyNetApy}
        />
        {isEventActive ? (
          <ApyLineItem
            iconName="AirdropOutline"
            iconColor="$iconSubdued"
            label={intl.formatMessage({
              id: ETranslations.earn_falcon_token_airdrop,
            })}
            value={apys?.airdrop}
          />
        ) : null}
        <ApyLineItem
          iconName="HandCoinsOutline"
          label={`${intl.formatMessage({
            id: ETranslations.earn_performance_fee,
          })}${poolFee ? ` (${poolFee}%)` : ''}`}
          value={apys?.performanceFee}
          valuePrefix="-"
        />
      </YStack>
      {isEventActive ? (
        <>
          <SizableText pt="$4" pb="$2" size="$bodySm" color="$textSubdued">
            {intl.formatMessage({
              id: ETranslations.earn_fixed_yield_info,
            })}
          </SizableText>
          <Anchor
            href="https://help.onekey.so/articles/11461265"
            color="$textInfo"
            size="$bodyMd"
            textDecorationLine="underline"
          >
            {intl.formatMessage({
              id: ETranslations.global_learn_more,
            })}
          </Anchor>
        </>
      ) : null}
    </YStack>
  );
}

export function ProtocolApyRewards({
  eventEndTime,
  apys,
  providerName,
  poolFee,
  rewardAssets,
}: {
  eventEndTime?: number;
  apys: IRewardApys;
  providerName: string;
  poolFee?: string;
  rewardAssets?: Record<string, IEarnTokenItem>;
}) {
  const { isEventActive } = useEarnEventActive(eventEndTime);

  if (!apys) {
    return null;
  }

  if (earnUtils.isMorphoProvider({ providerName })) {
    return (
      <MorphoApyInternal
        apys={apys}
        rewardAssets={rewardAssets}
        poolFee={poolFee}
      />
    );
  }

  if (earnUtils.isFalconProvider({ providerName })) {
    return (
      <FalconApyInternal
        apys={apys}
        poolFee={poolFee}
        isEventActive={isEventActive}
      />
    );
  }

  return null;
}

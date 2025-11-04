import { useCallback } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Icon,
  NumberSizeableText,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { Currency } from '@onekeyhq/kit/src/components/Currency';
import { Token } from '@onekeyhq/kit/src/components/Token';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { ETabReferFriendsRoutes } from '@onekeyhq/shared/src/routes';

import { FiatValue } from '../shared/FiatValue';
import { NoRewardYet } from '../shared/NoRewardYet';

import type { IHardwareSalesRewardProps } from './types';

export function HardwareSalesReward({
  hardwareSales,
  levelPercent: _levelPercent,
  rebateLevels: _rebateLevels,
  rebateConfig,
}: IHardwareSalesRewardProps) {
  const navigation = useAppNavigation();
  const intl = useIntl();

  const toHardwareSalesRewardPage = useCallback(() => {
    navigation.push(ETabReferFriendsRoutes.TabHardwareSalesReward);
  }, [navigation]);

  const showHardwareSalesAvailableFiat =
    (hardwareSales.available?.length || 0) > 0;
  const showHardwarePendingFiat = (hardwareSales.pending?.length || 0) > 0;

  return (
    <YStack
      pb="$4"
      borderWidth={StyleSheet.hairlineWidth}
      borderColor="$borderSubdued"
      borderRadius="$3"
    >
      <YStack
        pt="$4"
        px="$5"
        onPress={toHardwareSalesRewardPage}
        cursor="pointer"
      >
        <XStack ai="center" jc="space-between">
          <XStack gap="$1" ai="center">
            <Icon name="OnekeyLiteOutline" size="$5" />
            <SizableText size="$headingMd">{hardwareSales.title}</SizableText>
          </XStack>
          <Icon size="$4.5" color="$iconSubdued" name="ChevronRightOutline" />
        </XStack>
        <SizableText mt="$0.5" size="$bodyMd" color="$textSubdued">
          {hardwareSales.description}
        </SizableText>
      </YStack>
      <YStack px="$5">
        <YStack>
          <XStack py="$6" jc="space-between" ai="center">
            <XStack gap="$2" ai="center" jc="center">
              <XStack
                borderRadius="$2"
                w="$8"
                h="$8"
                bg="$bgStrong"
                ai="center"
                jc="center"
              >
                <SizableText size="$headingXl">
                  {rebateConfig.emoji}
                </SizableText>
              </XStack>
              <YStack>
                <SizableText size="$headingMd">
                  {rebateConfig.label}
                </SizableText>
                <SizableText size="$bodyMd" color="$textSubdued">
                  {intl.formatMessage(
                    {
                      id: ETranslations.referral_hw_level_rebate_rate,
                    },
                    {
                      percent: `${rebateConfig.rebate}%`,
                    },
                  )}
                </SizableText>
              </YStack>
            </XStack>
            <YStack ai="flex-end">
              <Currency size="$headingMd" formatter="value">
                {hardwareSales?.monthlySalesFiatValue
                  ? BigNumber(hardwareSales.monthlySalesFiatValue).toFixed(2)
                  : 0}
              </Currency>
              <SizableText size="$bodyMd" color="$textSubdued">
                {intl.formatMessage({
                  id: ETranslations.referral_hw_sales_title,
                })}
              </SizableText>
            </YStack>
          </XStack>
        </YStack>
        {(() => {
          if (!showHardwareSalesAvailableFiat && !showHardwarePendingFiat) {
            return <NoRewardYet />;
          }

          const hasTokenNetworkId =
            hardwareSales.available?.[0]?.token?.networkId ||
            hardwareSales.pending?.[0]?.token?.networkId;

          return (
            <XStack gap="$2" pt="$4">
              {hasTokenNetworkId ? (
                <Token
                  size="xs"
                  tokenImageUri={
                    hardwareSales.available?.[0]?.token?.logoURI ||
                    hardwareSales.pending?.[0]?.token?.logoURI
                  }
                />
              ) : null}
              <SizableText size="$bodyMd">
                <NumberSizeableText
                  formatter="value"
                  size="$bodyMd"
                  formatterOptions={{
                    tokenSymbol: hardwareSales.available?.[0]?.token?.symbol,
                  }}
                >
                  {hardwareSales.available?.[0]?.amount || 0}
                </NumberSizeableText>
                {hardwareSales.available?.[0]?.amount ? (
                  <FiatValue
                    fiatValue={hardwareSales.available?.[0]?.fiatValue}
                  />
                ) : null}
                {showHardwarePendingFiat ? (
                  <>
                    <SizableText size="$bodyMd">{` + `}</SizableText>
                    <NumberSizeableText
                      formatter="value"
                      size="$bodyMd"
                      formatterOptions={{
                        tokenSymbol: hardwareSales.pending?.[0]?.token?.symbol,
                      }}
                    >
                      {hardwareSales.pending?.[0]?.amount || 0}
                    </NumberSizeableText>
                    {hardwareSales.pending?.[0]?.amount ? (
                      <FiatValue
                        fiatValue={hardwareSales.pending?.[0]?.fiatValue}
                      />
                    ) : null}
                  </>
                ) : null}
              </SizableText>
              {showHardwarePendingFiat ? (
                <SizableText size="$bodyMd" color="$textSubdued">
                  {intl.formatMessage({
                    id: ETranslations.referral_sales_reward_pending,
                  })}
                </SizableText>
              ) : null}
            </XStack>
          );
        })()}
      </YStack>
    </YStack>
  );
}

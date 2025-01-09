import { useCallback } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Dialog,
  Icon,
  NumberSizeableText,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IEarnEstimateFeeResp } from '@onekeyhq/shared/types/staking';

import { CalculationListItem } from '../CalculationList';

export const useShowStakeEstimateGasAlert = () => {
  const intl = useIntl();
  const [
    {
      currencyInfo: { symbol: fiatSymbol },
    },
  ] = useSettingsPersistAtom();
  return useCallback(
    ({
      daysConsumed,
      estFiatValue,
      onConfirm,
    }: {
      estFiatValue: string;
      daysConsumed?: number;
      onConfirm?: () => void;
    }) => {
      const description = daysConsumed
        ? (intl.formatMessage(
            {
              id: ETranslations.earn_transaction_loss_when_stake,
            },
            {
              number: (
                <SizableText size="$bodyLgMedium" color="$textCaution">
                  {daysConsumed}
                </SizableText>
              ),
            },
          ) as string)
        : undefined;
      Dialog.show({
        title: intl.formatMessage({ id: ETranslations.earn_transaction_loss }),
        icon: 'InfoCircleOutline',
        description,
        renderContent: (
          <XStack>
            <SizableText size="$bodyLg" mr="$1">
              {intl.formatMessage({ id: ETranslations.global_est_network_fee })}
              :
            </SizableText>
            <NumberSizeableText
              size="$bodyLgMedium"
              formatter="value"
              formatterOptions={{ currency: fiatSymbol }}
            >
              {estFiatValue}
            </NumberSizeableText>
          </XStack>
        ),
        onConfirm,
      });
    },
    [intl, fiatSymbol],
  );
};

export const useShowClaimEstimateGasAlert = () => {
  const intl = useIntl();
  const [
    {
      currencyInfo: { symbol: fiatSymbol },
    },
  ] = useSettingsPersistAtom();
  return useCallback(
    ({
      claimTokenFiatValue,
      estFiatValue,
      onConfirm,
    }: {
      estFiatValue: string;
      claimTokenFiatValue: string;
      onConfirm?: () => void;
    }) => {
      const lossValue = BigNumber(claimTokenFiatValue)
        .minus(estFiatValue)
        .absoluteValue()
        .toFixed();
      const description = intl.formatMessage(
        {
          id: ETranslations.earn_transaction_loss_when_claim,
        },
        {
          number: (
            <NumberSizeableText
              size="$bodyLgMedium"
              formatter="value"
              color="$textCaution"
              formatterOptions={{ currency: fiatSymbol }}
            >
              {lossValue}
            </NumberSizeableText>
          ),
        },
      ) as string;
      Dialog.show({
        title: intl.formatMessage({ id: ETranslations.earn_transaction_loss }),
        icon: 'InfoCircleOutline',
        description,
        renderContent: (
          <YStack>
            <XStack>
              <SizableText size="$bodyLg" mr="$1">
                {intl.formatMessage({
                  id: ETranslations.global_est_network_fee,
                })}
                :
              </SizableText>
              <NumberSizeableText
                size="$bodyLgMedium"
                formatter="value"
                formatterOptions={{ currency: fiatSymbol }}
              >
                {estFiatValue}
              </NumberSizeableText>
            </XStack>
            <XStack>
              <SizableText size="$bodyLg" mr="$1">
                {intl.formatMessage({
                  id: ETranslations.earn_reward_value,
                })}
                :
              </SizableText>
              <NumberSizeableText
                size="$bodyLgMedium"
                formatter="value"
                formatterOptions={{ currency: fiatSymbol }}
              >
                {claimTokenFiatValue}
              </NumberSizeableText>
            </XStack>
          </YStack>
        ),
        onConfirm,
      });
    },
    [intl, fiatSymbol],
  );
};

const EstimateNetworkFeeListItem = ({
  estFiatValue,
  onPress,
}: {
  estFiatValue: string;
  onPress?: () => void;
}) => {
  const intl = useIntl();
  const [
    {
      currencyInfo: { symbol: fiatSymbol },
    },
  ] = useSettingsPersistAtom();

  return Number(estFiatValue) > 0 ? (
    <CalculationListItem onPress={onPress}>
      <CalculationListItem.Label>
        {intl.formatMessage({
          id: ETranslations.global_est_network_fee,
        })}
      </CalculationListItem.Label>
      <XStack
        alignItems="center"
        cursor={onPress ? 'pointer' : undefined}
        mr={onPress ? -6 : undefined}
      >
        <NumberSizeableText
          size="$bodyLgMedium"
          formatter="value"
          formatterOptions={{ currency: fiatSymbol }}
        >
          {estFiatValue}
        </NumberSizeableText>
        {onPress ? <Icon name="ChevronRightSmallOutline" size={24} /> : null}
      </XStack>
    </CalculationListItem>
  ) : null;
};

export const calcDaysSpent = (
  annualRewardFiatValue: string,
  currentFeeFiatValue: string,
) => {
  const daysBN = BigNumber(currentFeeFiatValue)
    .div(annualRewardFiatValue)
    .multipliedBy(365);
  return daysBN.isNaN() ? undefined : Math.ceil(daysBN.toNumber());
};

export const EstimateNetworkFee = ({
  estimateFeeResp,
  onPress,
  isVisible,
}: {
  estimateFeeResp?: IEarnEstimateFeeResp;
  isVisible?: boolean;
  onPress?: () => void;
}) =>
  estimateFeeResp && isVisible ? (
    <EstimateNetworkFeeListItem
      estFiatValue={estimateFeeResp.feeFiatValue}
      onPress={onPress}
    />
  ) : null;

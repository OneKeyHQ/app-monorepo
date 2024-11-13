import type { PropsWithChildren } from 'react';
import { useCallback, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';
import { Keyboard } from 'react-native';

import {
  Alert,
  Dialog,
  IconButton,
  Image,
  NumberSizeableText,
  Page,
  Popover,
  SizableText,
  Stack,
  XStack,
} from '@onekeyhq/components';
import { AmountInput } from '@onekeyhq/kit/src/components/AmountInput';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  formatDate,
  formatDistanceToNow,
} from '@onekeyhq/shared/src/utils/dateUtils';
import { EEarnProviderEnum } from '@onekeyhq/shared/types/earn';
import type { IFeeUTXO } from '@onekeyhq/shared/types/fee';
import type {
  IEarnEstimateFeeResp,
  IStakeProtocolDetails,
} from '@onekeyhq/shared/types/staking';

import { capitalizeString, countDecimalPlaces } from '../../utils/utils';
import { BtcFeeRateInput } from '../BtcFeeRateInput';
import { CalculationList, CalculationListItem } from '../CalculationList';
import { StakeShouldUnderstand } from '../EarnShouldUnderstand';
import {
  EstimateNetworkFee,
  calcDaysSpent,
  useShowStakeEstimateGasAlert,
} from '../EstimateNetworkFee';
import StakingFormWrapper from '../StakingFormWrapper';
import { TradeOrBuy } from '../TradeOrBuy';
import { ValuePriceListItem } from '../ValuePriceListItem';

type IUniversalStakeProps = {
  accountId: string;
  networkId: string;
  price: string;
  balance: string;

  details: IStakeProtocolDetails;

  providerLabel?: string;

  tokenImageUri?: string;
  tokenSymbol?: string;

  decimals?: number;

  minAmount?: string;
  maxAmount?: string;

  providerName?: string;
  providerLogo?: string;

  minTransactionFee?: string;
  apr?: string;

  showEstReceive?: boolean;
  estReceiveToken?: string;
  estReceiveTokenRate?: string;

  minStakeBlocks?: number;
  minStakeTerm?: number;

  isReachBabylonCap?: boolean;
  isDisabled?: boolean;

  estimateFeeResp?: IEarnEstimateFeeResp;
  estimateFeeUTXO?: Required<Pick<IFeeUTXO, 'feeRate'>>[];

  onConfirm?: (amount: string) => Promise<void>;
  onFeeRateChange?: (rate: string) => void;

  stakingTime?: number;
  nextLaunchLeft?: string;
  rewardToken?: string;
};

export const UniversalStake = ({
  accountId,
  networkId,
  price,
  balance,
  apr,
  details,
  decimals,
  minAmount = '0',
  minTransactionFee = '0',
  providerLabel,
  minStakeTerm,
  minStakeBlocks,
  tokenImageUri,
  tokenSymbol,
  providerName,
  providerLogo,
  isReachBabylonCap,
  showEstReceive,
  estReceiveToken,
  estReceiveTokenRate = '1',
  estimateFeeResp,
  estimateFeeUTXO,
  isDisabled,
  maxAmount,
  onConfirm,
  onFeeRateChange,
  stakingTime,
  nextLaunchLeft,
  rewardToken,
}: PropsWithChildren<IUniversalStakeProps>) => {
  const intl = useIntl();
  const showEstimateGasAlert = useShowStakeEstimateGasAlert();
  const [loading, setLoading] = useState<boolean>(false);
  const [amountValue, setAmountValue] = useState('');
  const [
    {
      currencyInfo: { symbol },
    },
  ] = useSettingsPersistAtom();
  const onChangeAmountValue = useCallback(
    (value: string) => {
      const valueBN = new BigNumber(value);
      if (valueBN.isNaN()) {
        if (value === '') {
          setAmountValue('');
        }
        return;
      }
      const isOverflowDecimals = Boolean(
        decimals &&
          Number(decimals) > 0 &&
          countDecimalPlaces(value) > decimals,
      );
      if (isOverflowDecimals) {
        setAmountValue((oldValue) => oldValue);
      } else {
        setAmountValue(value);
      }
    },
    [decimals],
  );

  const onMax = useCallback(() => {
    const balanceBN = new BigNumber(balance);
    const remainBN = balanceBN.minus(minTransactionFee);
    if (remainBN.gt(0)) {
      onChangeAmountValue(remainBN.toFixed());
    } else {
      onChangeAmountValue(balance);
    }
  }, [onChangeAmountValue, balance, minTransactionFee]);

  const currentValue = useMemo<string | undefined>(() => {
    if (Number(amountValue) > 0 && Number(price) > 0) {
      const amountValueBn = new BigNumber(amountValue);
      return amountValueBn.multipliedBy(price).toFixed();
    }
    return undefined;
  }, [amountValue, price]);

  const isInsufficientBalance = useMemo<boolean>(
    () => new BigNumber(amountValue).gt(balance),
    [amountValue, balance],
  );

  const isLessThanMinAmount = useMemo<boolean>(() => {
    const minAmountBn = new BigNumber(minAmount);
    const amountValueBn = new BigNumber(amountValue);
    if (minAmountBn.isGreaterThan(0) && amountValueBn.isGreaterThan(0)) {
      return amountValueBn.isLessThan(minAmountBn);
    }
    return false;
  }, [minAmount, amountValue]);

  const isGreaterThanMaxAmount = useMemo(() => {
    if (maxAmount && Number(maxAmount) > 0 && Number(amountValue) > 0) {
      return new BigNumber(amountValue).isGreaterThan(maxAmount);
    }
    return false;
  }, [maxAmount, amountValue]);

  const isDisable = useMemo(() => {
    const amountValueBN = BigNumber(amountValue);
    return (
      amountValueBN.isNaN() ||
      amountValueBN.isLessThanOrEqualTo(0) ||
      isInsufficientBalance ||
      isLessThanMinAmount ||
      isGreaterThanMaxAmount ||
      isReachBabylonCap
    );
  }, [
    amountValue,
    isInsufficientBalance,
    isLessThanMinAmount,
    isGreaterThanMaxAmount,
    isReachBabylonCap,
  ]);

  const estAnnualRewardsState = useMemo(() => {
    if (Number(amountValue) > 0 && Number(apr) > 0) {
      const amountBN = BigNumber(amountValue)
        .multipliedBy(apr ?? 0)
        .dividedBy(100);
      return {
        amount: amountBN.toFixed(),
        fiatValue:
          Number(price) > 0
            ? amountBN.multipliedBy(price).toFixed()
            : undefined,
      };
    }
  }, [amountValue, apr, price]);

  const btcStakeTerm = useMemo(() => {
    if (minStakeTerm && Number(minStakeTerm) > 0 && minStakeBlocks) {
      const days = Math.ceil(minStakeTerm / (1000 * 60 * 60 * 24));
      return intl.formatMessage(
        { id: ETranslations.earn_number_days_number_block },
        { 'number_days': days, 'number': minStakeBlocks },
      );
    }
    return null;
  }, [minStakeTerm, minStakeBlocks, intl]);

  const btcUnlockTime = useMemo(() => {
    if (minStakeTerm) {
      const currentDate = new Date();
      const endDate = new Date(currentDate.getTime() + minStakeTerm);
      return formatDate(endDate, { hideTimeForever: true });
    }
    return null;
  }, [minStakeTerm]);

  const daysSpent = useMemo(() => {
    if (estAnnualRewardsState?.fiatValue && estimateFeeResp?.feeFiatValue) {
      return calcDaysSpent(
        estAnnualRewardsState?.fiatValue,
        estimateFeeResp.feeFiatValue,
      );
    }
  }, [estimateFeeResp?.feeFiatValue, estAnnualRewardsState?.fiatValue]);

  const onPress = useCallback(async () => {
    Keyboard.dismiss();
    const showDialog = () => {
      Dialog.show({
        renderIcon: (
          <Image width="$14" height="$14" src={details.token.info.logoURI} />
        ),
        title: intl.formatMessage(
          { id: ETranslations.earn_provider_asset_staking },
          {
            'provider': capitalizeString(details.provider.name.toLowerCase()),
            'asset': details.token.info.symbol.toUpperCase(),
          },
        ),
        renderContent: (
          <StakeShouldUnderstand
            provider={details.provider.name.toLowerCase()}
            symbol={details.token.info.symbol.toLowerCase()}
            apr={details.provider.apr}
            updateFrequency={details.updateFrequency}
            unstakingPeriod={details.unstakingPeriod}
            receiveSymbol={details.rewardToken}
          />
        ),
        onConfirm: async (inst) => {
          try {
            setLoading(true);
            await inst.close();
            await onConfirm?.(amountValue);
          } finally {
            setLoading(false);
          }
        },
        onConfirmText: intl.formatMessage({ id: ETranslations.earn_stake }),
        showCancelButton: false,
      });
    };
    if (estAnnualRewardsState?.fiatValue && estimateFeeResp) {
      const daySpent = calcDaysSpent(
        estAnnualRewardsState.fiatValue,
        estimateFeeResp.feeFiatValue,
      );
      if (daySpent && daySpent > 5) {
        showEstimateGasAlert({
          daysConsumed: daySpent,
          estFiatValue: estimateFeeResp.feeFiatValue,
          onConfirm: showDialog,
        });
        return;
      }
    }
    showDialog();
  }, [
    onConfirm,
    amountValue,
    details,
    intl,
    estAnnualRewardsState?.fiatValue,
    estimateFeeResp,
    showEstimateGasAlert,
  ]);

  return (
    <StakingFormWrapper>
      <Stack position="relative" opacity={isDisabled ? 0.7 : 1}>
        <AmountInput
          bg={isDisabled ? '$bgDisabled' : '$bgApp'}
          hasError={isInsufficientBalance || isLessThanMinAmount}
          value={amountValue}
          onChange={onChangeAmountValue}
          tokenSelectorTriggerProps={{
            selectedTokenImageUri: tokenImageUri,
            selectedTokenSymbol: tokenSymbol?.toUpperCase(),
          }}
          balanceProps={{
            value: balance,
            onPress: onMax,
          }}
          inputProps={{
            placeholder: '0',
            autoFocus: !isDisabled,
          }}
          valueProps={{
            value: currentValue,
            currency: currentValue ? symbol : undefined,
          }}
          enableMaxAmount
        />
        {isDisabled ? (
          <Stack position="absolute" w="100%" h="100%" zIndex={1} />
        ) : null}
      </Stack>

      {isLessThanMinAmount ? (
        <Alert
          icon="InfoCircleOutline"
          type="critical"
          title={intl.formatMessage(
            { id: ETranslations.earn_minimum_amount },
            { number: minAmount, symbol: tokenSymbol },
          )}
        />
      ) : null}
      {isInsufficientBalance ? (
        <Alert
          icon="InfoCircleOutline"
          type="critical"
          title={intl.formatMessage({
            id: ETranslations.earn_insufficient_balance,
          })}
        />
      ) : null}
      {isGreaterThanMaxAmount ? (
        <Alert
          icon="InfoCircleOutline"
          type="critical"
          title={intl.formatMessage(
            {
              id: ETranslations.earn_maximum_staking_alert,
            },
            { number: maxAmount ?? '', symbol: tokenSymbol },
          )}
        />
      ) : null}
      {isReachBabylonCap ? (
        <Alert
          icon="InfoCircleOutline"
          type="critical"
          title={intl.formatMessage({
            id: ETranslations.earn_reaching_staking_cap,
          })}
        />
      ) : null}
      <CalculationList>
        {estAnnualRewardsState ? (
          <CalculationListItem>
            <CalculationListItem.Label>
              {intl.formatMessage({
                id: ETranslations.earn_est_annual_rewards,
              })}
            </CalculationListItem.Label>
            <CalculationListItem.Value>
              <ValuePriceListItem
                tokenSymbol={tokenSymbol ?? ''}
                fiatSymbol={symbol}
                amount={estAnnualRewardsState.amount}
                fiatValue={estAnnualRewardsState.fiatValue}
              />
            </CalculationListItem.Value>
          </CalculationListItem>
        ) : null}
        {showEstReceive && estReceiveToken && Number(amountValue) > 0 ? (
          <CalculationListItem>
            <CalculationListItem.Label>
              {intl.formatMessage({
                id: ETranslations.earn_est_receive,
              })}
            </CalculationListItem.Label>
            <CalculationListItem.Value>
              <NumberSizeableText
                formatter="balance"
                size="$bodyLgMedium"
                formatterOptions={{ tokenSymbol: estReceiveToken }}
              >
                {BigNumber(amountValue)
                  .multipliedBy(estReceiveTokenRate)
                  .toFixed()}
              </NumberSizeableText>
            </CalculationListItem.Value>
          </CalculationListItem>
        ) : null}
        {apr && Number(apr) > 0 ? (
          <CalculationListItem>
            <CalculationListItem.Label>
              {intl.formatMessage({ id: ETranslations.global_apr })}
            </CalculationListItem.Label>
            <CalculationListItem.Value color="$textSuccess">
              {`${apr}%`}
            </CalculationListItem.Value>
          </CalculationListItem>
        ) : null}
        {btcStakeTerm ? (
          <CalculationListItem>
            <XStack flex={1} alignItems="center" gap="$1">
              <CalculationListItem.Label>
                {intl.formatMessage({ id: ETranslations.earn_term })}
              </CalculationListItem.Label>

              <Popover
                title={intl.formatMessage({ id: ETranslations.earn_term })}
                placement="bottom-start"
                renderTrigger={
                  <IconButton
                    iconColor="$iconSubdued"
                    size="small"
                    icon="InfoCircleOutline"
                    variant="tertiary"
                  />
                }
                renderContent={
                  <Stack p="$5">
                    <SizableText>
                      {intl.formatMessage({
                        id: ETranslations.earn_term_tooltip,
                      })}
                    </SizableText>
                  </Stack>
                }
              />
            </XStack>
            <CalculationListItem.Value>
              {btcStakeTerm}
            </CalculationListItem.Value>
          </CalculationListItem>
        ) : null}
        {btcUnlockTime ? (
          <CalculationListItem>
            <CalculationListItem.Label>
              {intl.formatMessage({
                id: ETranslations.earn_unlock_time,
              })}
            </CalculationListItem.Label>
            <CalculationListItem.Value>
              {btcUnlockTime}
            </CalculationListItem.Value>
          </CalculationListItem>
        ) : null}
        {providerLogo && providerName ? (
          <CalculationListItem>
            <CalculationListItem.Label>
              {providerLabel ??
                intl.formatMessage({ id: ETranslations.global_protocol })}
            </CalculationListItem.Label>
            <CalculationListItem.Value>
              <XStack gap="$2" alignItems="center">
                <Image
                  width="$5"
                  height="$5"
                  src={providerLogo}
                  borderRadius="$2"
                />
                <SizableText size="$bodyLgMedium">
                  {capitalizeString(providerName)}
                </SizableText>
              </XStack>
            </CalculationListItem.Value>
          </CalculationListItem>
        ) : null}
        {estimateFeeResp ? (
          <EstimateNetworkFee
            estimateFeeResp={estimateFeeResp}
            isVisible={!!estAnnualRewardsState?.fiatValue}
            onPress={() => {
              showEstimateGasAlert({
                daysConsumed: daysSpent,
                estFiatValue: estimateFeeResp.feeFiatValue,
              });
            }}
          />
        ) : null}
        {stakingTime ? (
          <CalculationListItem>
            <CalculationListItem.Label>
              {intl.formatMessage({ id: ETranslations.earn_earnings_start })}
            </CalculationListItem.Label>
            <CalculationListItem.Value>
              <SizableText size="$bodyLgMedium">
                {intl.formatMessage(
                  { id: ETranslations.earn_in_number },
                  {
                    number: formatDistanceToNow(
                      Date.now() + Number(stakingTime * 1000),
                      false,
                    ),
                  },
                )}
              </SizableText>
            </CalculationListItem.Value>
          </CalculationListItem>
        ) : null}
        {nextLaunchLeft && rewardToken ? (
          <CalculationListItem>
            <CalculationListItem.Label
              tooltip={intl.formatMessage({
                id: ETranslations.earn_until_next_launch_tooltip,
              })}
            >
              {intl.formatMessage({
                id: ETranslations.earn_until_next_launch,
              })}
            </CalculationListItem.Label>
            <CalculationListItem.Value>
              <SizableText size="$bodyLgMedium">
                {intl.formatMessage(
                  { id: ETranslations.earn_number_symbol_left },
                  {
                    number: Number(nextLaunchLeft).toFixed(2),
                    symbol: rewardToken,
                  },
                )}
              </SizableText>
            </CalculationListItem.Value>
          </CalculationListItem>
        ) : null}
        {providerName?.toLowerCase() ===
          EEarnProviderEnum.Babylon.toLowerCase() && estimateFeeUTXO ? (
          <BtcFeeRateInput
            estimateFeeUTXO={estimateFeeUTXO}
            onFeeRateChange={onFeeRateChange}
          />
        ) : null}
      </CalculationList>
      <TradeOrBuy
        token={details.token.info}
        accountId={accountId}
        networkId={networkId}
      />
      <Page.Footer
        onConfirmText={intl.formatMessage({
          id: ETranslations.global_continue,
        })}
        confirmButtonProps={{
          onPress,
          loading,
          disabled: isDisable,
        }}
      />
    </StakingFormWrapper>
  );
};

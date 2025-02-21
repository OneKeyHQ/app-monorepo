import type { PropsWithChildren } from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';
import { useDebouncedCallback } from 'use-debounce';

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
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AmountInput } from '@onekeyhq/kit/src/components/AmountInput';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import type { IEarnEstimateFeeResp } from '@onekeyhq/shared/types/staking';

import { validateAmountInput } from '../../../Swap/utils/utils';
import { capitalizeString, countDecimalPlaces } from '../../utils/utils';
import { CalculationList, CalculationListItem } from '../CalculationList';
import { WithdrawShouldUnderstand } from '../EarnShouldUnderstand';
import { EstimateNetworkFee } from '../EstimateNetworkFee';
import StakingFormWrapper from '../StakingFormWrapper';
import { ValuePriceListItem } from '../ValuePriceListItem';

type IUniversalWithdrawProps = {
  balance: string;
  price: string;

  accountId?: string;
  networkId?: string;

  providerLogo?: string;
  providerName?: string;

  providerLabel?: string;

  decimals?: number;

  initialAmount?: string;
  tokenImageUri?: string;
  tokenSymbol?: string;

  minAmount?: string;
  showDetailWithdrawalRequested: boolean;
  unstakingPeriod?: number;

  showPayWith?: boolean;
  payWithToken?: string;
  payWithTokenRate?: string;

  hideReceived?: boolean;

  estimateFeeResp?: IEarnEstimateFeeResp;

  morphoVault?: string;

  onConfirm?: ({
    amount,
    withdrawAll,
  }: {
    amount: string;
    withdrawAll: boolean;
  }) => Promise<void>;
};

const isNaN = (num: string) =>
  BigNumber(num).isNaN() || (typeof num === 'string' && num.endsWith('.'));

export const UniversalWithdraw = ({
  balance,
  price: inputPrice,
  accountId,
  networkId,
  tokenImageUri,
  tokenSymbol,
  providerLogo,
  providerName,
  initialAmount,
  minAmount = '0',
  showDetailWithdrawalRequested,
  unstakingPeriod,
  providerLabel,
  decimals,
  morphoVault,
  // pay with
  showPayWith,
  payWithToken,
  payWithTokenRate = '1',

  hideReceived,
  estimateFeeResp,

  onConfirm,
}: PropsWithChildren<IUniversalWithdrawProps>) => {
  const price = Number(inputPrice) > 0 ? inputPrice : '0';
  const [loading, setLoading] = useState<boolean>(false);
  const withdrawAllRef = useRef(false);
  const [amountValue, setAmountValue] = useState(initialAmount ?? '');
  const [
    {
      currencyInfo: { symbol },
    },
  ] = useSettingsPersistAtom();

  const intl = useIntl();

  const isMorphoProvider = earnUtils.isMorphoProvider({
    providerName: providerName ?? '',
  });

  const network = usePromiseResult(
    () =>
      backgroundApiProxy.serviceNetwork.getNetwork({
        networkId,
      }),
    [networkId],
  ).result;

  const onPress = useCallback(async () => {
    try {
      setLoading(true);
      await onConfirm?.({
        amount: amountValue,
        withdrawAll: withdrawAllRef.current,
      });
    } finally {
      setLoading(false);
    }
  }, [amountValue, onConfirm]);

  const [checkAmountMessage, setCheckoutAmountMessage] = useState('');
  const checkAmount = useDebouncedCallback(async (amount: string) => {
    if (isNaN(amount)) {
      return;
    }
    const message = await backgroundApiProxy.serviceStaking.checkAmount({
      accountId,
      networkId,
      symbol: tokenSymbol,
      provider: providerName,
      action: 'unstake',
      amount,
      morphoVault,
      withdrawAll: withdrawAllRef.current,
    });
    setCheckoutAmountMessage(message);
  }, 300);

  const onChangeAmountValue = useCallback(
    (value: string, isMax = false) => {
      if (!validateAmountInput(value, decimals)) {
        return;
      }
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
      withdrawAllRef.current = !!isMax;
      void checkAmount(value);
    },
    [checkAmount, decimals],
  );

  const currentValue = useMemo<string | undefined>(() => {
    if (Number(amountValue) > 0 && Number(price) > 0) {
      return BigNumber(amountValue).multipliedBy(price).toFixed();
    }
    return undefined;
  }, [amountValue, price]);

  const remainingLessThanMinAmountWarning = useMemo<boolean>(() => {
    if (Number(minAmount) > 0) {
      const minAmountBN = new BigNumber(Number(minAmount));
      const amountValueBN = new BigNumber(amountValue);
      const balanceBN = new BigNumber(balance);
      if (minAmountBN.gt(0) && amountValueBN.gt(0) && balanceBN.gte(0)) {
        return (
          amountValueBN.gt(0) &&
          amountValueBN.gte(minAmountBN) &&
          balanceBN.minus(amountValueBN).gt(0) &&
          balanceBN.minus(amountValueBN).lt(minAmountBN)
        );
      }
    }
    return false;
  }, [minAmount, amountValue, balance]);

  const onMax = useCallback(() => {
    onChangeAmountValue(balance, true);
  }, [onChangeAmountValue, balance]);

  const isCheckAmountMessageError =
    amountValue?.length > 0 && !!checkAmountMessage;

  const isDisable = useMemo(
    () =>
      isNaN(amountValue) ||
      BigNumber(amountValue).isLessThanOrEqualTo(0) ||
      isCheckAmountMessageError,
    [amountValue, isCheckAmountMessageError],
  );

  const editable = initialAmount === undefined;

  const fiatValue = useMemo(
    () => BigNumber(amountValue).multipliedBy(price).toFixed(),
    [amountValue, price],
  );

  return (
    <StakingFormWrapper>
      <Stack position="relative" opacity={editable ? 1 : 0.7}>
        <AmountInput
          bg={editable ? '$bgApp' : '$bgDisabled'}
          hasError={isCheckAmountMessageError}
          value={amountValue}
          onChange={onChangeAmountValue}
          tokenSelectorTriggerProps={{
            selectedTokenImageUri: tokenImageUri,
            selectedTokenSymbol: tokenSymbol,
            selectedNetworkImageUri: network?.logoURI,
          }}
          inputProps={{
            placeholder: '0',
            autoFocus: editable,
          }}
          balanceProps={{
            value: balance,
            iconText: intl.formatMessage({ id: ETranslations.earn_deposited }),
            onPress: onMax,
          }}
          valueProps={{
            value: currentValue,
            currency: currentValue ? symbol : undefined,
          }}
          enableMaxAmount
        />
        {!editable ? (
          <Stack position="absolute" w="100%" h="100%" zIndex={1} />
        ) : null}
      </Stack>

      {remainingLessThanMinAmountWarning ? (
        <Alert
          icon="InfoCircleOutline"
          type="warning"
          title={intl.formatMessage(
            { id: ETranslations.earn_unstake_all_due_to_min_withdrawal },
            { number: minAmount, symbol: tokenSymbol },
          )}
        />
      ) : null}
      {isCheckAmountMessageError ? (
        <Alert
          icon="InfoCircleOutline"
          type="critical"
          title={checkAmountMessage}
        />
      ) : null}
      <CalculationList>
        {amountValue && !hideReceived ? (
          <CalculationListItem ai="flex-start">
            <CalculationListItem.Label>
              {intl.formatMessage({ id: ETranslations.earn_receive })}
            </CalculationListItem.Label>
            <CalculationListItem.Value>
              <ValuePriceListItem
                tokenSymbol={tokenSymbol ?? ''}
                fiatSymbol={symbol}
                amount={amountValue}
                fiatValue={fiatValue}
              />
            </CalculationListItem.Value>
          </CalculationListItem>
        ) : null}
        {showPayWith && payWithToken && Number(amountValue) > 0 ? (
          <CalculationListItem>
            <CalculationListItem.Label>
              {intl.formatMessage({ id: ETranslations.earn_pay_with })}
            </CalculationListItem.Label>
            <CalculationListItem.Value>
              <NumberSizeableText
                formatter="balance"
                size="$bodyLgMedium"
                formatterOptions={{ tokenSymbol: payWithToken }}
              >
                {BigNumber(amountValue)
                  .multipliedBy(payWithTokenRate)
                  .toFixed()}
              </NumberSizeableText>
            </CalculationListItem.Value>
          </CalculationListItem>
        ) : null}
        {providerLogo && providerName ? (
          <CalculationListItem>
            <CalculationListItem.Label>
              {providerLabel ??
                intl.formatMessage({
                  id: ETranslations.global_protocol,
                })}
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
        {unstakingPeriod ? (
          <CalculationListItem>
            <XStack flex={1} alignItems="center" gap="$1">
              <CalculationListItem.Label
                tooltip={intl.formatMessage({
                  id: ETranslations.earn_unstaking_period_tooltip,
                })}
              >
                {intl.formatMessage({
                  id: ETranslations.earn_unstaking_period,
                })}
              </CalculationListItem.Label>
            </XStack>

            <CalculationListItem.Value>
              {intl.formatMessage(
                {
                  id: showDetailWithdrawalRequested
                    ? ETranslations.earn_claim_available_in_number_days
                    : ETranslations.earn_up_to_number_days,
                },
                { 'number': unstakingPeriod },
              )}
            </CalculationListItem.Value>
          </CalculationListItem>
        ) : null}
        {estimateFeeResp ? (
          <EstimateNetworkFee
            estimateFeeResp={estimateFeeResp}
            isVisible={Number(amountValue) > 0}
          />
        ) : null}
      </CalculationList>

      <Page.Footer
        onConfirmText={intl.formatMessage({
          id: ETranslations.global_withdraw,
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

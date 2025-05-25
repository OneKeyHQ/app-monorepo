import type { PropsWithChildren } from 'react';
import { useCallback, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';
import { isNaN } from 'lodash';
import { useIntl } from 'react-intl';
import { useDebouncedCallback } from 'use-debounce';

import {
  Alert,
  Image,
  Page,
  SizableText,
  Stack,
  XStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  PercentageStageOnKeyboard,
  calcPercentBalance,
} from '@onekeyhq/kit/src/components/PercentageStageOnKeyboard';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { validateAmountInput } from '@onekeyhq/kit/src/utils/validateAmountInput';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  ECheckAmountActionType,
  type IEarnEstimateFeeResp,
} from '@onekeyhq/shared/types/staking';

import { capitalizeString, countDecimalPlaces } from '../../utils/utils';
import { CalculationList, CalculationListItem } from '../CalculationList';
import { EstimateNetworkFee } from '../EstimateNetworkFee';
import { StakingAmountInput } from '../StakingAmountInput';
import StakingFormWrapper from '../StakingFormWrapper';
import { ValuePriceListItem } from '../ValuePriceListItem';

type IUniversalClaimProps = {
  accountId: string;
  networkId: string;

  balance: string;
  price: string;

  tokenImageUri?: string;
  tokenSymbol?: string;
  providerLogo?: string;
  providerName?: string;
  providerLabel?: string;
  initialAmount?: string;
  rate?: string;
  minAmount?: string;
  decimals?: number;

  estimateFeeResp?: IEarnEstimateFeeResp;

  onConfirm?: (amount: string) => Promise<void>;
};

export const UniversalClaim = ({
  accountId,
  networkId,
  balance,
  price: inputPrice,
  tokenImageUri,
  tokenSymbol,
  providerLogo,
  providerName,
  providerLabel,
  initialAmount,
  minAmount = '0',
  rate = '1',
  decimals,
  estimateFeeResp,
  onConfirm,
}: PropsWithChildren<IUniversalClaimProps>) => {
  const price = Number(inputPrice) > 0 ? inputPrice : '0';
  const [loading, setLoading] = useState<boolean>(false);
  const [amountValue, setAmountValue] = useState(initialAmount ?? '');
  const [
    {
      currencyInfo: { symbol },
    },
  ] = useSettingsPersistAtom();

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
      await onConfirm?.(amountValue);
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
      action: ECheckAmountActionType.CLAIM,
      amount,
      withdrawAll: false,
    });
    setCheckoutAmountMessage(message);
  }, 300);

  const onChangeAmountValue = useCallback(
    (value: string) => {
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
      void checkAmount(value);
    },
    [decimals, checkAmount],
  );

  const currentValue = useMemo<string | undefined>(() => {
    const amountValueBn = new BigNumber(amountValue);
    if (amountValueBn.isNaN()) return undefined;
    return amountValueBn.multipliedBy(price).toFixed();
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

  const onMax = useCallback(() => {
    onChangeAmountValue(balance);
  }, [onChangeAmountValue, balance]);

  const onSelectPercentageStage = useCallback(
    (percent: number) => {
      onChangeAmountValue(
        calcPercentBalance({
          balance,
          percent,
          decimals,
        }),
      );
    },
    [balance, decimals, onChangeAmountValue],
  );

  const isCheckAmountMessageError =
    amountValue?.length > 0 && !!checkAmountMessage;

  const isDisable = useMemo(
    () =>
      BigNumber(amountValue).isNaN() ||
      BigNumber(amountValue).isLessThanOrEqualTo(0) ||
      isInsufficientBalance ||
      isLessThanMinAmount ||
      isCheckAmountMessageError,
    [
      amountValue,
      isCheckAmountMessageError,
      isInsufficientBalance,
      isLessThanMinAmount,
    ],
  );

  const receiving = useMemo(() => {
    if (Number(amountValue) > 0) {
      const receivingAmount = BigNumber(amountValue).dividedBy(rate);
      return (
        <ValuePriceListItem
          amount={receivingAmount.toFixed()}
          fiatSymbol={symbol}
          fiatValue={
            Number(price) > 0
              ? receivingAmount.multipliedBy(price).dividedBy(rate).toFixed()
              : undefined
          }
          tokenSymbol={tokenSymbol ?? ''}
        />
      );
    }
    return null;
  }, [amountValue, price, tokenSymbol, rate, symbol]);
  const intl = useIntl();

  const editable = initialAmount === undefined;

  return (
    <StakingFormWrapper>
      <Stack position="relative" opacity={editable ? 1 : 0.7}>
        <StakingAmountInput
          title={intl.formatMessage({ id: ETranslations.earn_claim })}
          disabled={!editable}
          hasError={
            isInsufficientBalance ||
            isLessThanMinAmount ||
            isCheckAmountMessageError
          }
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
            onPress: onMax,
          }}
          valueProps={{
            value: currentValue,
            currency: currentValue ? symbol : undefined,
          }}
          onSelectPercentageStage={onSelectPercentageStage}
        />
        {!editable ? (
          <Stack position="absolute" w="100%" h="100%" zIndex={1} />
        ) : null}
      </Stack>
      {isCheckAmountMessageError ? (
        <Alert
          icon="InfoCircleOutline"
          type="critical"
          title={checkAmountMessage}
        />
      ) : null}
      <CalculationList>
        {receiving ? (
          <CalculationListItem>
            <CalculationListItem.Label>
              {intl.formatMessage({ id: ETranslations.earn_receive })}
            </CalculationListItem.Label>
            <CalculationListItem.Value>{receiving}</CalculationListItem.Value>
          </CalculationListItem>
        ) : null}
        {providerName && providerLogo ? (
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
            isVisible={Number(amountValue) > 0}
          />
        ) : null}
      </CalculationList>
      <Page.Footer>
        <Page.FooterActions
          onConfirmText={intl.formatMessage({
            id: ETranslations.earn_claim,
          })}
          confirmButtonProps={{
            onPress,
            loading,
            disabled: isDisable,
          }}
        />
        <PercentageStageOnKeyboard
          onSelectPercentageStage={onSelectPercentageStage}
        />
      </Page.Footer>
    </StakingFormWrapper>
  );
};

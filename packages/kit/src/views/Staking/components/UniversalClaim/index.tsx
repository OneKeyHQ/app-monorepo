import type { PropsWithChildren } from 'react';
import { useCallback, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Alert,
  Page,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { AmountInput } from '@onekeyhq/kit/src/components/AmountInput';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { capitalizeString, countDecimalPlaces } from '../../utils/utils';
import { ValuePriceListItem } from '../ValuePriceListItem';

const fieldTitleProps = { color: '$textSubdued', size: '$bodyLg' } as const;

type IUniversalClaimProps = {
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
  onConfirm?: (amount: string) => Promise<void>;
};

export const UniversalClaim = ({
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

  const onPress = useCallback(async () => {
    try {
      setLoading(true);
      await onConfirm?.(amountValue);
    } finally {
      setLoading(false);
    }
  }, [amountValue, onConfirm]);

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

  const isDisable = useMemo(
    () =>
      BigNumber(amountValue).isNaN() ||
      BigNumber(amountValue).isLessThanOrEqualTo(0) ||
      isInsufficientBalance ||
      isLessThanMinAmount,
    [amountValue, isInsufficientBalance, isLessThanMinAmount],
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
    <YStack>
      <Stack mx="$2" px="$3" gap="$5">
        <Stack position="relative" opacity={editable ? 1 : 0.7}>
          <AmountInput
            bg={editable ? '$bgApp' : '$bgDisabled'}
            hasError={isInsufficientBalance || isLessThanMinAmount}
            value={amountValue}
            onChange={onChangeAmountValue}
            tokenSelectorTriggerProps={{
              selectedTokenImageUri: tokenImageUri,
              selectedTokenSymbol: tokenSymbol,
            }}
            inputProps={{
              placeholder: '0',
            }}
            balanceProps={{
              value: balance,
              onPress: onMax,
            }}
            valueProps={{
              value: currentValue,
              currency: currentValue ? symbol : undefined,
            }}
          />
          {!editable ? <Stack position="absolute" w="100%" h="100%" /> : null}
        </Stack>

        <YStack gap="$1">
          {isLessThanMinAmount ? (
            <Alert
              icon="InfoCircleOutline"
              type="critical"
              title={intl.formatMessage(
                { id: ETranslations.earn_minimum_amount },
                { number: `${minAmount} ${tokenSymbol ?? ''}` },
              )}
            />
          ) : null}
          {isInsufficientBalance ? (
            <Alert
              icon="InfoCircleOutline"
              type="critical"
              title={intl.formatMessage({
                id: ETranslations.earn_insufficient_claimable_balance,
              })}
            />
          ) : null}
        </YStack>
      </Stack>
      <YStack>
        {receiving ? (
          <ListItem
            title={intl.formatMessage({ id: ETranslations.earn_receive })}
            titleProps={fieldTitleProps}
          >
            {receiving}
          </ListItem>
        ) : null}
        {providerName && providerLogo ? (
          <ListItem
            title={
              providerLabel ??
              intl.formatMessage({ id: ETranslations.global_protocol })
            }
            titleProps={fieldTitleProps}
          >
            <XStack gap="$2" alignItems="center">
              <Token size="xs" tokenImageUri={providerLogo} />
              <SizableText size="$bodyLgMedium">
                {capitalizeString(providerName)}
              </SizableText>
            </XStack>
          </ListItem>
        ) : null}
      </YStack>
      <Page.Footer
        onConfirmText={intl.formatMessage({
          id: ETranslations.earn_claim,
        })}
        confirmButtonProps={{
          onPress,
          loading,
          disabled: isDisable,
        }}
      />
    </YStack>
  );
};

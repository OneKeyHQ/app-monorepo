import type { PropsWithChildren } from 'react';
import { useCallback, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Alert,
  NumberSizeableText,
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

import { LIDO_LOGO_URI } from '../../utils/const';

const fieldTitleProps = { color: '$textSubdued', size: '$bodyLg' } as const;

type ILidoWithdrawProps = {
  balance: string;
  price: string;
  tokenImageUri?: string;
  tokenSymbol: string;
  receivingTokenSymbol: string;
  rate?: string;
  minAmount?: string;
  onConfirm?: (amount: string) => Promise<void>;
};

export const LidoWithdraw = ({
  balance,
  price,
  tokenImageUri,
  tokenSymbol,
  receivingTokenSymbol,
  minAmount = '0',
  rate = '1',
  onConfirm,
}: PropsWithChildren<ILidoWithdrawProps>) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [amountValue, setAmountValue] = useState('');
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

  const onChangeAmountValue = useCallback((value: string) => {
    const valueBN = new BigNumber(value);
    if (valueBN.isNaN()) {
      if (value === '') {
        setAmountValue('');
      }
      return;
    }
    setAmountValue(value);
  }, []);

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
      isInsufficientBalance ||
      isLessThanMinAmount,
    [amountValue, isInsufficientBalance, isLessThanMinAmount],
  );

  const receiving = useMemo(() => {
    const amountValueBN = BigNumber(amountValue);
    if (amountValueBN.isNaN()) return null;
    const receivingAmount = amountValueBN.dividedBy(rate).toFixed();
    const receivingValue = amountValueBN
      .multipliedBy(price)
      .dividedBy(rate)
      .toFixed();
    return (
      <XStack space="$1">
        <SizableText>
          <NumberSizeableText
            formatter="balance"
            size="$bodyLgMedium"
            formatterOptions={{ tokenSymbol: receivingTokenSymbol }}
          >
            {receivingAmount}
          </NumberSizeableText>
          (
          <NumberSizeableText
            formatter="value"
            size="$bodyLgMedium"
            formatterOptions={{ currency: symbol }}
          >
            {receivingValue}
          </NumberSizeableText>
          )
        </SizableText>
      </XStack>
    );
  }, [amountValue, price, symbol, receivingTokenSymbol, rate]);
  const intl = useIntl();
  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({ id: ETranslations.earn_redeem })}
      />
      <Page.Body>
        <YStack>
          <Stack mx="$2" px="$3" space="$5">
            <AmountInput
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
              enableMaxAmount
            />
            <YStack space="$1">
              {isLessThanMinAmount ? (
                <Alert
                  icon="InfoCircleOutline"
                  type="critical"
                  title={intl.formatMessage(
                    { id: ETranslations.earn_minimum_amount },
                    { number: `${minAmount} ${tokenSymbol}` },
                  )}
                />
              ) : null}
              {isInsufficientBalance ? (
                <Alert
                  icon="InfoCircleOutline"
                  type="critical"
                  title={intl.formatMessage({
                    id: ETranslations.earn_insufficient_staked_balance,
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
            {amountValue ? (
              <ListItem
                title={intl.formatMessage({ id: ETranslations.earn_pay_with })}
                titleProps={fieldTitleProps}
              >
                <SizableText>
                  <NumberSizeableText
                    formatter="balance"
                    size="$bodyLgMedium"
                    formatterOptions={{ tokenSymbol }}
                  >
                    {amountValue}
                  </NumberSizeableText>
                </SizableText>
              </ListItem>
            ) : null}
            <ListItem
              title={intl.formatMessage({ id: ETranslations.global_protocol })}
              titleProps={fieldTitleProps}
            >
              <XStack space="$2" alignItems="center">
                <Token size="xs" tokenImageUri={LIDO_LOGO_URI} />
                <SizableText size="$bodyLgMedium">Lido</SizableText>
              </XStack>
            </ListItem>
            <ListItem
              title={intl.formatMessage({
                id: ETranslations.earn_stake_release_period,
              })}
              titleProps={fieldTitleProps}
            >
              <ListItem.Text
                primary={intl.formatMessage(
                  { id: ETranslations.earn_less_than_number_days },
                  { number: 4 },
                )}
              />
            </ListItem>
          </YStack>
        </YStack>
      </Page.Body>
      <Page.Footer
        onConfirmText={intl.formatMessage({ id: ETranslations.earn_redeem })}
        confirmButtonProps={{
          onPress,
          loading,
          disabled: isDisable,
        }}
      />
    </Page>
  );
};

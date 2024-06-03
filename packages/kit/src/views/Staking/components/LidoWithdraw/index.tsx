import type { PropsWithChildren } from 'react';
import { useCallback, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';

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

import { LIDO_LOGO_URI } from '../../utils/const';

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
            formatterOptions={{ tokenSymbol: receivingTokenSymbol }}
          >
            {receivingAmount}
          </NumberSizeableText>
          (
          <NumberSizeableText
            formatter="value"
            formatterOptions={{ currency: symbol }}
          >
            {receivingValue}
          </NumberSizeableText>
          )
        </SizableText>
      </XStack>
    );
  }, [amountValue, price, symbol, receivingTokenSymbol, rate]);

  return (
    <Page>
      <Page.Header title="Redeem" />
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
                  title={`The minimum amount for this staking is ${minAmount} ${tokenSymbol}.`}
                />
              ) : null}
              {isInsufficientBalance ? (
                <Alert
                  icon="InfoCircleOutline"
                  type="critical"
                  title="Insufficient balance."
                />
              ) : null}
            </YStack>
          </Stack>
          <YStack>
            {receiving ? (
              <ListItem title="Receive" titleProps={{ color: '$textSubdued' }}>
                {receiving}
              </ListItem>
            ) : null}
            {amountValue ? (
              <ListItem title="Pay with" titleProps={{ color: '$textSubdued' }}>
                <SizableText>
                  <NumberSizeableText
                    formatter="balance"
                    formatterOptions={{ tokenSymbol }}
                  >
                    {amountValue}
                  </NumberSizeableText>
                </SizableText>
              </ListItem>
            ) : null}
            <ListItem title="Protocol" titleProps={{ color: '$textSubdued' }}>
              <XStack space="$2" alignItems="center">
                <Token size="sm" tokenImageUri={LIDO_LOGO_URI} />
                <SizableText size="$bodyMdMedium">Lido</SizableText>
              </XStack>
            </ListItem>
            <ListItem
              title="Stake Release Period"
              titleProps={{ color: '$textSubdued' }}
            >
              <ListItem.Text primary="< 4 Days" />
            </ListItem>
          </YStack>
        </YStack>
      </Page.Body>
      <Page.Footer
        onConfirmText="Redeem"
        confirmButtonProps={{
          onPress,
          loading,
          disabled: isDisable,
        }}
      />
    </Page>
  );
};

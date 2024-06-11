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

type ILidoStakeProps = {
  price: string;
  balance: string;
  minAmount?: string;
  tokenImageUri?: string;
  tokenSymbol: string;
  stTokenSymbol: string;
  apr?: number;
  onConfirm?: (amount: string) => Promise<void>;
};

const fieldTitleProps = { color: '$textSubdued', size: '$bodyLg' } as const;

export const LidoStake = ({
  price,
  balance,
  apr = 4,
  minAmount = '0',
  tokenImageUri,
  tokenSymbol,
  stTokenSymbol,
  onConfirm,
}: PropsWithChildren<ILidoStakeProps>) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [amountValue, setAmountValue] = useState('');
  const [
    {
      currencyInfo: { symbol },
    },
  ] = useSettingsPersistAtom();

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

  const onPress = useCallback(async () => {
    setLoading(true);
    try {
      await onConfirm?.(amountValue);
    } finally {
      setLoading(false);
    }
  }, [onConfirm, amountValue]);

  const currentValue = useMemo<string | undefined>(() => {
    const amountValueBn = new BigNumber(amountValue);
    if (amountValueBn.isNaN()) return undefined;
    return amountValueBn.multipliedBy(price).toFixed();
  }, [amountValue, price]);

  const isInsufficientBalance = useMemo<boolean>(
    () => new BigNumber(amountValue).gte(balance),
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

  const isDisable = useMemo(() => {
    const amountValueBN = BigNumber(amountValue);
    return (
      amountValueBN.isNaN() ||
      amountValueBN.isLessThanOrEqualTo(0) ||
      isInsufficientBalance ||
      isLessThanMinAmount
    );
  }, [amountValue, isInsufficientBalance, isLessThanMinAmount]);

  const estAnnualRewards = useMemo(() => {
    const bn = BigNumber(amountValue);
    if (!amountValue || bn.isNaN()) {
      return null;
    }
    const amountBN = BigNumber(amountValue).multipliedBy(apr).dividedBy(100);
    return (
      <XStack space="$1">
        <SizableText>
          <NumberSizeableText
            size="$bodyLgMedium"
            formatter="balance"
            formatterOptions={{ tokenSymbol }}
          >
            {amountBN.toFixed()}
          </NumberSizeableText>
          (
          <NumberSizeableText
            size="$bodyLgMedium"
            formatter="value"
            formatterOptions={{ currency: symbol }}
          >
            {amountBN.multipliedBy(price).toFixed()}
          </NumberSizeableText>
          )
        </SizableText>
      </XStack>
    );
  }, [amountValue, apr, price, symbol, tokenSymbol]);

  return (
    <YStack>
      <Stack mx="$2" px="$3" space="$5">
        <AmountInput
          hasError={isInsufficientBalance || isLessThanMinAmount}
          value={amountValue}
          onChange={onChangeAmountValue}
          tokenSelectorTriggerProps={{
            selectedTokenImageUri: tokenImageUri,
            selectedTokenSymbol: tokenSymbol.toUpperCase(),
          }}
          balanceProps={{
            value: balance,
          }}
          inputProps={{
            placeholder: '0',
          }}
          valueProps={{
            value: currentValue,
            currency: currentValue ? symbol : undefined,
          }}
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
      <Stack>
        <YStack>
          {estAnnualRewards ? (
            <ListItem title="Est. annual rewards" titleProps={fieldTitleProps}>
              {estAnnualRewards}
            </ListItem>
          ) : null}
          {amountValue ? (
            <ListItem title="Est. receive" titleProps={fieldTitleProps}>
              <NumberSizeableText
                formatter="balance"
                size="$bodyLgMedium"
                formatterOptions={{ tokenSymbol: stTokenSymbol }}
              >
                {amountValue}
              </NumberSizeableText>
            </ListItem>
          ) : null}
          <ListItem title="APR" titleProps={fieldTitleProps}>
            <ListItem.Text
              primary={`${apr}%`}
              primaryTextProps={{ color: '$textSuccess' }}
            />
          </ListItem>
          <ListItem title="Protocol" titleProps={fieldTitleProps}>
            <XStack space="$2" alignItems="center">
              <Token size="xs" tokenImageUri={LIDO_LOGO_URI} />
              <SizableText size="$bodyLgMedium">Lido</SizableText>
            </XStack>
          </ListItem>
          <ListItem title="Stake Release Period" titleProps={fieldTitleProps}>
            <ListItem.Text primary="< 4 Days" />
          </ListItem>
        </YStack>
      </Stack>
      <Page.Footer
        onConfirmText="Stake"
        confirmButtonProps={{
          onPress,
          loading,
          disabled: isDisable,
        }}
      />
    </YStack>
  );
};

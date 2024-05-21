import type { PropsWithChildren } from 'react';
import { useCallback, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';

import {
  Alert,
  Button,
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

import { LIDO_LOGO_URI } from '../../utils/const';

type ILidoWithdrawProps = {
  balance: string;
  tokenImageUri: string;
  tokenSymbol: string;
  minAmount?: string;
  onConfirm?: (amount: string) => Promise<void>;
};

export const LidoWithdraw = ({
  balance,
  tokenImageUri,
  minAmount = '0',
  tokenSymbol,
  onConfirm,
}: PropsWithChildren<ILidoWithdrawProps>) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [amountValue, setAmountValue] = useState('');

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
            />
            {isLessThanMinAmount ? (
              <Alert
                icon="InfoCircleOutline"
                type="critical"
                title={`The minimum amount for this staking is ${minAmount} ETH.`}
              />
            ) : null}
            <XStack
              bg="$bgSubdued"
              p="$3"
              borderRadius={8}
              overflow="hidden"
              justifyContent="space-between"
              alignItems="center"
            >
              <SizableText size="$bodyMdMedium">Staked amount</SizableText>
              <XStack space="$2" alignItems="center">
                <NumberSizeableText formatter="balance">
                  {balance}
                </NumberSizeableText>
                <Button
                  variant="tertiary"
                  onPress={onMax}
                  color="$textInteractive"
                >
                  Max
                </Button>
              </XStack>
            </XStack>
          </Stack>
          <YStack>
            <ListItem title="Protocol">
              <XStack space="$2" alignItems="center">
                <Token size="sm" tokenImageUri={LIDO_LOGO_URI} />
                <SizableText size="$bodyMdMedium">Lido</SizableText>
              </XStack>
            </ListItem>
            <ListItem title="Stake Release Period">
              <ListItem.Text primary="< 4 Days" />
            </ListItem>
          </YStack>
        </YStack>
      </Page.Body>
      <Page.Footer
        onConfirmText={
          isInsufficientBalance ? 'Insufficient balance' : 'Redeem'
        }
        confirmButtonProps={{
          onPress,
          loading,
          disabled: isDisable,
        }}
      />
    </Page>
  );
};

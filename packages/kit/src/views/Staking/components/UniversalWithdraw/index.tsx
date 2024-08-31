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

const fieldTitleProps = { color: '$textSubdued', size: '$bodyLg' } as const;

type IUniversalWithdrawProps = {
  balance: string;
  price: string;

  providerLogo?: string;
  providerName?: string;

  initialAmount?: string;
  tokenImageUri?: string;
  tokenSymbol?: string;
  minAmount?: string;
  warningMessages?: string[];
  onConfirm?: (amount: string) => Promise<void>;
};

export const UniversalWithdraw = ({
  balance,
  price: inputPrice,
  tokenImageUri,
  tokenSymbol,
  providerLogo,
  providerName,
  initialAmount,
  warningMessages,
  minAmount = '0',
  onConfirm,
}: PropsWithChildren<IUniversalWithdrawProps>) => {
  const price = !inputPrice || Number.isNaN(inputPrice) ? '0' : inputPrice;
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
      BigNumber(amountValue).isLessThanOrEqualTo(0) ||
      isInsufficientBalance ||
      isLessThanMinAmount,
    [amountValue, isInsufficientBalance, isLessThanMinAmount],
  );

  const editable = initialAmount === undefined;

  const intl = useIntl();
  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({ id: ETranslations.earn_redeem })}
      />
      <Page.Body>
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
                enableMaxAmount
              />
              {!editable ? (
                <Stack position="absolute" w="100%" h="100%" />
              ) : null}
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
                    id: ETranslations.earn_insufficient_staked_balance,
                  })}
                />
              ) : null}
              {warningMessages && warningMessages.length
                ? warningMessages.map((o, i) => (
                    <Alert
                      key={i}
                      icon="InfoCircleOutline"
                      type="warning"
                      title={o}
                    />
                  ))
                : null}
            </YStack>
          </Stack>
          <YStack>
            {amountValue ? (
              <ListItem
                title={intl.formatMessage({ id: ETranslations.earn_receive })}
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
            {providerLogo && providerName ? (
              <ListItem
                title={intl.formatMessage({
                  id: ETranslations.global_protocol,
                })}
                titleProps={fieldTitleProps}
              >
                <XStack gap="$2" alignItems="center">
                  <Token size="xs" tokenImageUri={providerLogo} />
                  <SizableText size="$bodyLgMedium">{providerName}</SizableText>
                </XStack>
              </ListItem>
            ) : null}
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

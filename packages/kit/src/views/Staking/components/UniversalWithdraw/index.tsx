import type { PropsWithChildren } from 'react';
import { useCallback, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

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
  YStack,
} from '@onekeyhq/components';
import { AmountInput } from '@onekeyhq/kit/src/components/AmountInput';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { capitalizeString, countDecimalPlaces } from '../../utils/utils';
import { WithdrawShouldUnderstand } from '../EarnShouldUnderstand';

const fieldTitleProps = { color: '$textSubdued', size: '$bodyLg' } as const;

type IUniversalWithdrawProps = {
  balance: string;
  price: string;

  providerLogo?: string;
  providerName?: string;

  providerLabel?: string;

  decimals?: number;

  initialAmount?: string;
  tokenImageUri?: string;
  tokenSymbol?: string;

  minAmount?: string;
  unstakingPeriod?: number;

  showPayWith?: boolean;
  payWithToken?: string;
  payWithTokenRate?: string;

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
  minAmount = '0',
  unstakingPeriod,
  providerLabel,
  decimals,
  // pay with
  showPayWith,
  payWithToken,
  payWithTokenRate = '1',

  onConfirm,
}: PropsWithChildren<IUniversalWithdrawProps>) => {
  const price = Number(inputPrice) > 0 ? inputPrice : '0';
  const [loading, setLoading] = useState<boolean>(false);
  const [amountValue, setAmountValue] = useState(initialAmount ?? '');
  const [
    {
      currencyInfo: { symbol },
    },
  ] = useSettingsPersistAtom();

  const intl = useIntl();

  const onPress = useCallback(async () => {
    Dialog.show({
      renderContent: (
        <WithdrawShouldUnderstand
          provider={providerName ?? ''}
          logoURI={tokenImageUri ?? ''}
          symbol={tokenSymbol ?? ''}
          withdrawalPeriod={unstakingPeriod ?? 3}
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
      onConfirmText: intl.formatMessage({ id: ETranslations.global_withdraw }),
      showCancelButton: false,
    });
  }, [
    amountValue,
    onConfirm,
    intl,
    tokenImageUri,
    tokenSymbol,
    providerName,
    unstakingPeriod,
  ]);

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
    if (Number(amountValue) > 0 && Number(price) > 0) {
      return BigNumber(amountValue).multipliedBy(price).toFixed();
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
            enableMaxAmount
          />
          {!editable ? (
            <Stack position="absolute" w="100%" h="100%" zIndex={1} />
          ) : null}
        </Stack>
        <YStack gap="$1">
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
        </YStack>
      </Stack>
      <YStack>
        {showPayWith && payWithToken && Number(amountValue) > 0 ? (
          <ListItem
            title={intl.formatMessage({ id: ETranslations.earn_pay_with })}
            titleProps={fieldTitleProps}
          >
            <SizableText>
              <NumberSizeableText
                formatter="balance"
                size="$bodyLgMedium"
                formatterOptions={{ tokenSymbol: payWithToken }}
              >
                {BigNumber(amountValue)
                  .multipliedBy(payWithTokenRate)
                  .toFixed()}
              </NumberSizeableText>
            </SizableText>
          </ListItem>
        ) : null}
        {providerLogo && providerName ? (
          <ListItem
            title={
              providerLabel ??
              intl.formatMessage({
                id: ETranslations.global_protocol,
              })
            }
            titleProps={fieldTitleProps}
          >
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
          </ListItem>
        ) : null}
        {unstakingPeriod ? (
          <ListItem>
            <XStack flex={1} alignItems="center" gap="$1">
              <SizableText {...fieldTitleProps}>
                {intl.formatMessage({
                  id: ETranslations.earn_unstaking_period,
                })}
              </SizableText>
              <Popover
                title={intl.formatMessage({
                  id: ETranslations.earn_unstaking_period,
                })}
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
                        id: ETranslations.earn_unstaking_period_tooltip,
                      })}
                    </SizableText>
                  </Stack>
                }
              />
            </XStack>
            <XStack gap="$2" alignItems="center">
              <SizableText size="$bodyLgMedium">
                {intl.formatMessage(
                  {
                    id: ETranslations.earn_up_to_number_days,
                  },
                  { 'number': unstakingPeriod },
                )}
              </SizableText>
            </XStack>
          </ListItem>
        ) : null}
      </YStack>
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
    </YStack>
  );
};

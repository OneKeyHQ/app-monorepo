import { useCallback, useMemo } from 'react';

import BigNumber from 'bignumber.js';

import {
  Input,
  NumberSizeableText,
  SegmentControl,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { getSharedInputStyles } from '@onekeyhq/components/src/forms/Input/sharedStyles';
import { EAmountInputMode } from '@onekeyhq/shared/types/bulkSend';

import { AmountInput as BaseAmountInput } from '@onekeyhq/kit/src/components/AmountInput';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { useAccountData } from '@onekeyhq/kit/src/hooks/useAccountData';

import {
  type IAmountInputError,
  useBulkSendAmountsInputContext,
} from './Context';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

// Validation helper
function validateAmount(
  value: string,
  balance: string,
  decimals: number,
  receiverCount: number,
): string | undefined {
  if (!value || value === '') {
    return 'Amount is required';
  }

  const amount = new BigNumber(value);

  if (amount.isNaN()) {
    return 'Invalid amount';
  }

  if (amount.isNegative()) {
    return 'Amount cannot be negative';
  }

  if (amount.isZero()) {
    return 'Amount cannot be zero';
  }

  const decimalPlaces = amount.decimalPlaces() ?? 0;
  if (decimalPlaces > decimals) {
    return `Maximum ${decimals} decimal places`;
  }

  const totalAmount = amount.times(receiverCount);
  if (totalAmount.isGreaterThan(balance)) {
    return 'Insufficient balance';
  }

  return undefined;
}

function validateRangeAmount(
  value: string,
  balance: string,
  decimals: number,
  fieldName: string,
): string | undefined {
  if (!value || value === '') {
    return `${fieldName} is required`;
  }

  const amount = new BigNumber(value);

  if (amount.isNaN()) {
    return 'Invalid amount';
  }

  if (amount.isNegative()) {
    return 'Amount cannot be negative';
  }

  if (amount.isZero()) {
    return 'Amount cannot be zero';
  }

  const decimalPlaces = amount.decimalPlaces() ?? 0;
  if (decimalPlaces > decimals) {
    return `Maximum ${decimals} decimal places`;
  }

  if (amount.isGreaterThan(balance)) {
    return 'Insufficient balance';
  }

  return undefined;
}

export function SpecifiedAmountInput() {
  const {
    networkId,
    tokenInfo,
    tokenDetails,
    tokenDetailsState,
    transfersInfo,
    amountInputValues,
    setAmountInputValues,
    amountInputErrors,
    setAmountInputErrors,
  } = useBulkSendAmountsInputContext();

  const { network } = useAccountData({ networkId });

  const isLoading =
    !tokenDetailsState.initialized && tokenDetailsState.isRefreshing;
  const balance = tokenDetails?.balanceParsed ?? '0';
  const decimals = tokenInfo.decimals;
  const tokenSymbol = tokenInfo.symbol;

  const handleChange = useCallback(
    (value: string) => {
      setAmountInputValues({
        ...amountInputValues,
        specifiedAmount: value,
      });

      const error = validateAmount(
        value,
        balance,
        decimals,
        transfersInfo.length,
      );
      setAmountInputErrors({
        ...amountInputErrors,
        specifiedAmount: error,
      });
    },
    [
      amountInputValues,
      setAmountInputValues,
      balance,
      decimals,
      transfersInfo.length,
      amountInputErrors,
      setAmountInputErrors,
    ],
  );

  // Calculate fiat value
  const fiatValue = useMemo(() => {
    const amount = new BigNumber(amountInputValues.specifiedAmount || '0');
    if (amount.isNaN() || !tokenDetails?.price) return '$0.00';
    return `$${amount.times(tokenDetails.price).toFixed(2)}`;
  }, [amountInputValues.specifiedAmount, tokenDetails?.price]);

  return (
    <YStack gap="$1.5" w="100%">
      <BaseAmountInput
        value={amountInputValues.specifiedAmount}
        onChange={handleChange}
        hasError={!!amountInputErrors.specifiedAmount}
        inputProps={{
          placeholder: '0',
          loading: isLoading,
        }}
        valueProps={{
          value: fiatValue,
          loading: isLoading,
        }}
        tokenSelectorTriggerProps={{
          selectedTokenImageUri: tokenDetails?.info.logoURI,
          selectedNetworkImageUri: network?.logoURI,
          selectedTokenSymbol: tokenSymbol,
          loading: isLoading,
        }}
      />
      {amountInputErrors.specifiedAmount ? (
        <SizableText size="$bodyMd" color="$textCritical" px="$1">
          {amountInputErrors.specifiedAmount}
        </SizableText>
      ) : null}
    </YStack>
  );
}

export function RangeAmountInput() {
  const {
    tokenDetails,
    amountInputValues,
    setAmountInputValues,
    amountInputErrors,
    setAmountInputErrors,
    tokenInfo,
  } = useBulkSendAmountsInputContext();

  const [settings] = useSettingsPersistAtom();

  const balance = tokenDetails?.balanceParsed ?? '0';
  const decimals = tokenInfo.decimals;

  const validateRange = useCallback(
    (min: string, max: string): IAmountInputError => {
      const errors: IAmountInputError = {};

      errors.rangeMin = validateRangeAmount(min, balance, decimals, 'Min');
      errors.rangeMax = validateRangeAmount(max, balance, decimals, 'Max');

      // Check max > min
      if (!errors.rangeMin && !errors.rangeMax) {
        const minBN = new BigNumber(min);
        const maxBN = new BigNumber(max);
        if (maxBN.isLessThanOrEqualTo(minBN)) {
          errors.rangeMax = 'Max must be greater than Min';
        }
      }

      return errors;
    },
    [balance, decimals],
  );

  const handleMinChange = useCallback(
    (value: string) => {
      const newValues = { ...amountInputValues, rangeMin: value };
      setAmountInputValues(newValues);

      const errors = validateRange(value, amountInputValues.rangeMax);
      setAmountInputErrors({
        ...amountInputErrors,
        rangeMin: errors.rangeMin,
        rangeMax: errors.rangeMax,
      });
    },
    [
      amountInputValues,
      setAmountInputValues,
      validateRange,
      amountInputErrors,
      setAmountInputErrors,
    ],
  );

  const handleMaxChange = useCallback(
    (value: string) => {
      const newValues = { ...amountInputValues, rangeMax: value };
      setAmountInputValues(newValues);

      const errors = validateRange(amountInputValues.rangeMin, value);
      setAmountInputErrors({
        ...amountInputErrors,
        rangeMin: errors.rangeMin,
        rangeMax: errors.rangeMax,
      });
    },
    [
      amountInputValues,
      setAmountInputValues,
      validateRange,
      amountInputErrors,
      setAmountInputErrors,
    ],
  );

  // Calculate fiat values
  const minFiatValue = useMemo(() => {
    const amount = new BigNumber(amountInputValues.rangeMin || '0');
    if (amount.isNaN() || !tokenDetails?.price) return '0';
    return amount.times(tokenDetails.price).toFixed();
  }, [amountInputValues.rangeMin, tokenDetails?.price]);

  const maxFiatValue = useMemo(() => {
    const amount = new BigNumber(amountInputValues.rangeMax || '0');
    if (amount.isNaN() || !tokenDetails?.price) return '0';
    return amount.times(tokenDetails.price).toFixed();
  }, [amountInputValues.rangeMax, tokenDetails?.price]);

  const minSharedStyles = getSharedInputStyles({
    error: !!amountInputErrors.rangeMin,
  });
  const maxSharedStyles = getSharedInputStyles({
    error: !!amountInputErrors.rangeMax,
  });

  return (
    <YStack gap="$1.5" w="100%">
      <XStack gap="$2" alignItems="flex-start" w="100%">
        <YStack flex={1} gap="$1">
          <Stack
            borderRadius="$3"
            borderWidth={minSharedStyles.borderWidth}
            borderColor={minSharedStyles.borderColor}
            overflow="hidden"
          >
            <XStack alignItems="center" px="$3.5" pt="$2.5" pb="$1">
              <Input
                flex={1}
                value={amountInputValues.rangeMin}
                onChangeText={handleMinChange}
                placeholder="0"
                keyboardType="decimal-pad"
                borderWidth={0}
                backgroundColor="transparent"
                fontSize={28}
                fontWeight="600"
                px="$0"
              />
            </XStack>
            <XStack
              alignItems="center"
              justifyContent="space-between"
              px="$3.5"
              pb="$2"
            >
              <NumberSizeableText
                size="$bodyMd"
                color="$textSubdued"
                formatter="value"
                formatterOptions={{ currency: settings.currencyInfo.symbol }}
              >
                {minFiatValue}
              </NumberSizeableText>
              <SizableText size="$bodyMdMedium" color="$text">
                {tokenDetails?.info.symbol}
              </SizableText>
            </XStack>
          </Stack>
          {amountInputErrors.rangeMin ? (
            <SizableText size="$bodySm" color="$textCritical" px="$1">
              {amountInputErrors.rangeMin}
            </SizableText>
          ) : null}
        </YStack>

        <Stack w="$2" h={1} bg="$text" mt="$8" />

        <YStack flex={1} gap="$1">
          <Stack
            borderRadius="$3"
            borderWidth={maxSharedStyles.borderWidth}
            borderColor={maxSharedStyles.borderColor}
            overflow="hidden"
          >
            <XStack alignItems="center" px="$3.5" pt="$2.5" pb="$1">
              <Input
                flex={1}
                value={amountInputValues.rangeMax}
                onChangeText={handleMaxChange}
                placeholder="Max"
                keyboardType="decimal-pad"
                borderWidth={0}
                backgroundColor="transparent"
                fontSize={28}
                fontWeight="600"
                px="$0"
              />
            </XStack>
            <XStack
              alignItems="center"
              justifyContent="space-between"
              px="$3.5"
              pb="$2"
            >
              <NumberSizeableText
                size="$bodyMd"
                color="$textSubdued"
                formatter="value"
                formatterOptions={{ currency: settings.currencyInfo.symbol }}
              >
                {maxFiatValue}
              </NumberSizeableText>
              <SizableText size="$bodyMdMedium" color="$text">
                {tokenDetails?.info.symbol}
              </SizableText>
            </XStack>
          </Stack>
          {amountInputErrors.rangeMax ? (
            <SizableText size="$bodySm" color="$textCritical" px="$1">
              {amountInputErrors.rangeMax}
            </SizableText>
          ) : null}
        </YStack>
      </XStack>
    </YStack>
  );
}

function CustomAmountDisplay() {
  const {
    networkId,
    tokenDetails,
    tokenInfo,
    totalTokenAmount,
    totalFiatAmount,
  } = useBulkSendAmountsInputContext();

  const { network } = useAccountData({ networkId });

  const [settings] = useSettingsPersistAtom();

  const tokenSymbol = tokenInfo.symbol;

  return (
    <ListItem
      renderAvatar={() => (
        <Token
          tokenImageUri={tokenDetails?.info.logoURI}
          size="sm"
          showNetworkIcon
          networkImageUri={network?.logoURI}
          networkId={network?.id}
        />
      )}
      bg="$bgSubdued"
      mx="$0"
      $gtMd={{
        px: '$0',
        bg: '$bgApp',
      }}
    >
      <XStack alignItems="center" gap="$2" justifyContent="space-between">
        <ListItem.Text
          flex={1}
          primary={
            <NumberSizeableText
              size="$bodyLgMedium"
              formatter="balance"
              formatterOptions={{ tokenSymbol }}
            >
              {totalTokenAmount}
            </NumberSizeableText>
          }
          secondary={
            <NumberSizeableText
              size="$bodyMd"
              color="$textSubdued"
              formatter="value"
              formatterOptions={{ currency: settings.currencyInfo.symbol }}
            >
              {totalFiatAmount}
            </NumberSizeableText>
          }
        />
        <SizableText size="$bodyMd" color="$textSubdued">
          Sending Amount
        </SizableText>
      </XStack>
    </ListItem>
  );
}

export function AmountInputSection() {
  const { amountInputMode, setAmountInputMode, setAmountInputErrors } =
    useBulkSendAmountsInputContext();

  const segmentOptions = useMemo(() => {
    const options = [
      { label: 'Specified', value: EAmountInputMode.Specified },
      { label: 'Range', value: EAmountInputMode.Range },
      { label: 'Custom', value: EAmountInputMode.Custom },
    ];
    return options;
  }, []);

  const handleModeChange = useCallback(
    (value: string | number) => {
      setAmountInputMode(value as EAmountInputMode);
      // Clear errors when switching modes
      setAmountInputErrors({});
    },
    [setAmountInputMode, setAmountInputErrors],
  );

  const renderContent = useCallback(() => {
    switch (amountInputMode) {
      case EAmountInputMode.Specified:
        return <SpecifiedAmountInput />;
      case EAmountInputMode.Range:
        return <RangeAmountInput />;
      case EAmountInputMode.Custom:
        return <CustomAmountDisplay />;
      default:
        return null;
    }
  }, [amountInputMode]);

  return (
    <YStack gap="$4" px="$5" pb="$6" w="100%">
      <SegmentControl
        fullWidth
        value={amountInputMode}
        options={segmentOptions}
        onChange={handleModeChange}
      />
      {renderContent()}
    </YStack>
  );
}

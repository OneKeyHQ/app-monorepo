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
import { AmountInput as BaseAmountInput } from '@onekeyhq/kit/src/components/AmountInput';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { useAccountData } from '@onekeyhq/kit/src/hooks/useAccountData';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { validateTokenAmount } from '@onekeyhq/shared/src/utils/tokenUtils';
import {
  EAmountInputMode,
  type IAmountInputError,
} from '@onekeyhq/shared/types/bulkSend';

import { useBulkSendAmountsInputContext } from './Context';

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

  const [settings] = useSettingsPersistAtom();

  const isLoading =
    !tokenDetailsState.initialized && tokenDetailsState.isRefreshing;
  const balance = tokenDetails?.balanceParsed ?? '0';
  const tokenSymbol = tokenInfo.symbol;

  const handleChange = useCallback(
    (value: string) => {
      setAmountInputValues({
        ...amountInputValues,
        specifiedAmount: value,
      });

      const { error } = validateTokenAmount({
        token: tokenInfo,
        amount: new BigNumber(value || '0')
          .times(transfersInfo.length)
          .toFixed(),
        maxAmount: balance ?? '0',
        allowZero: false,
        customErrorMessages: {
          maxAmount: 'Insufficient balance',
          zeroAmount: 'Amount must be greater than 0',
        },
      });
      setAmountInputErrors({
        ...amountInputErrors,
        specifiedAmount: error,
      });
    },
    [
      amountInputValues,
      setAmountInputValues,
      tokenInfo,
      balance,
      transfersInfo.length,
      amountInputErrors,
      setAmountInputErrors,
    ],
  );

  // Calculate fiat value
  const fiatValue = useMemo(() => {
    const amount = new BigNumber(amountInputValues.specifiedAmount || '0');
    if (amount.isNaN() || !tokenDetails?.price) return '0';
    return amount.times(tokenDetails.price).toFixed();
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
          currency: settings.currencyInfo.symbol,
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

  const validateRange = useCallback(
    (min: string, max: string): IAmountInputError => {
      const errors: IAmountInputError = {};

      // rangeMin can be 0 (it's just the lower bound of the range)
      const { error: rangeMinError } = validateTokenAmount({
        token: tokenInfo,
        amount: min,
        maxAmount: balance,
        allowZero: true,
        customErrorMessages: {
          emptyAmount: 'Min is required',
          maxAmount: 'Insufficient balance',
        },
      });
      errors.rangeMin = rangeMinError;
      const { error: rangeMaxError } = validateTokenAmount({
        token: tokenInfo,
        amount: max,
        maxAmount: balance,
        allowZero: false,
        customErrorMessages: {
          emptyAmount: 'Max is required',
          maxAmount: 'Insufficient balance',
          zeroAmount: 'Max must be greater than 0',
        },
      });
      errors.rangeMax = rangeMaxError;
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
    [tokenInfo, balance],
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
                containerProps={{
                  width: '100%',
                  borderWidth: 0,
                }}
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
                containerProps={{
                  width: '100%',
                  borderWidth: 0,
                }}
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

function CustomAmountDisplay({ inDialog }: { inDialog?: boolean }) {
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

  if (inDialog) {
    return (
      <YStack alignItems="center" justifyContent="center" p="$5">
        <SizableText
          size="$bodyLg"
          color="$textSubdued"
          textAlign="center"
          maxWidth={256}
        >
          Each transfer will use the amount you entered.
        </SizableText>
      </YStack>
    );
  }

  return (
    <ListItem
      renderAvatar={() => (
        <Token
          tokenImageUri={tokenDetails?.info.logoURI}
          size="lg"
          showNetworkIcon
          networkImageUri={network?.logoURI}
          networkId={network?.id}
        />
      )}
      mx="$0"
      px="$0"
    >
      <XStack alignItems="center" gap="$2" flex={1}>
        <YStack flex={1}>
          <NumberSizeableText
            size="$bodyLgMedium"
            formatter="balance"
            formatterOptions={{ tokenSymbol }}
          >
            {totalTokenAmount}
          </NumberSizeableText>
          <NumberSizeableText
            size="$bodyMd"
            color="$textSubdued"
            formatter="value"
            formatterOptions={{ currency: settings.currencyInfo.symbol }}
          >
            {totalFiatAmount}
          </NumberSizeableText>
        </YStack>
        <SizableText size="$bodyMd" color="$textSubdued">
          Sending Amount
        </SizableText>
      </XStack>
    </ListItem>
  );
}

export function AmountInputSection({ inDialog }: { inDialog?: boolean }) {
  const {
    amountInputMode,
    setAmountInputMode,
    setAmountInputErrors,
    transfersInfo,
    tokenInfo,
    tokenDetails,
    amountInputValues,
  } = useBulkSendAmountsInputContext();

  const segmentOptions = useMemo(
    () => [
      { label: 'Specified', value: EAmountInputMode.Specified },
      { label: 'Range', value: EAmountInputMode.Range },
      { label: 'Custom', value: EAmountInputMode.Custom },
    ],
    [],
  );

  const validateSpecifiedAmount = useCallback(() => {
    const balance = tokenDetails?.balanceParsed ?? '0';
    const { error } = validateTokenAmount({
      token: tokenInfo,
      amount: new BigNumber(amountInputValues.specifiedAmount || '0')
        .times(transfersInfo.length)
        .toFixed(),
      maxAmount: balance,
      allowZero: false,
      customErrorMessages: {
        maxAmount: 'Insufficient balance',
        zeroAmount: 'Amount must be greater than 0',
      },
    });
    return { specifiedAmount: error };
  }, [
    tokenInfo,
    tokenDetails?.balanceParsed,
    amountInputValues.specifiedAmount,
    transfersInfo.length,
  ]);

  const validateRangeAmount = useCallback(() => {
    const balance = tokenDetails?.balanceParsed ?? '0';
    const errors: IAmountInputError = {};

    // rangeMin can be 0 (it's just the lower bound of the range)
    const { error: rangeMinError } = validateTokenAmount({
      token: tokenInfo,
      amount: amountInputValues.rangeMin,
      maxAmount: balance,
      allowZero: true,
      customErrorMessages: {
        emptyAmount: 'Min is required',
        maxAmount: 'Insufficient balance',
      },
    });
    errors.rangeMin = rangeMinError;

    const { error: rangeMaxError } = validateTokenAmount({
      token: tokenInfo,
      amount: amountInputValues.rangeMax,
      maxAmount: balance,
      allowZero: false,
      customErrorMessages: {
        emptyAmount: 'Max is required',
        maxAmount: 'Insufficient balance',
        zeroAmount: 'Max must be greater than 0',
      },
    });
    errors.rangeMax = rangeMaxError;

    // Check max > min
    if (!errors.rangeMin && !errors.rangeMax) {
      const minBN = new BigNumber(amountInputValues.rangeMin);
      const maxBN = new BigNumber(amountInputValues.rangeMax);
      if (maxBN.isLessThanOrEqualTo(minBN)) {
        errors.rangeMax = 'Max must be greater than Min';
      }
    }

    return errors;
  }, [
    tokenInfo,
    tokenDetails?.balanceParsed,
    amountInputValues.rangeMin,
    amountInputValues.rangeMax,
  ]);

  const handleModeChange = useCallback(
    (value: string | number) => {
      const newMode = value as EAmountInputMode;
      setAmountInputMode(newMode);

      // Only re-validate in Dialog mode (Desktop)
      // MobileLayout has independent data for each mode, so no need to re-validate
      if (!inDialog) {
        setAmountInputErrors({});
        return;
      }

      // Re-validate based on the new mode (Dialog only)
      switch (newMode) {
        case EAmountInputMode.Specified:
          setAmountInputErrors(validateSpecifiedAmount());
          break;
        case EAmountInputMode.Range:
          setAmountInputErrors(validateRangeAmount());
          break;
        case EAmountInputMode.Custom:
        default:
          setAmountInputErrors({});
      }
    },
    [
      inDialog,
      setAmountInputMode,
      setAmountInputErrors,
      validateSpecifiedAmount,
      validateRangeAmount,
    ],
  );

  const renderContent = useCallback(() => {
    switch (amountInputMode) {
      case EAmountInputMode.Specified:
        return <SpecifiedAmountInput />;
      case EAmountInputMode.Range:
        return <RangeAmountInput />;
      case EAmountInputMode.Custom:
        return <CustomAmountDisplay inDialog={inDialog} />;
      default:
        return null;
    }
  }, [amountInputMode, inDialog]);

  return (
    <YStack gap="$4" w="100%">
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

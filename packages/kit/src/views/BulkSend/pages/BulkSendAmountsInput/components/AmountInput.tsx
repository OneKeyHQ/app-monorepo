import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';
import { useDebouncedCallback } from 'use-debounce';

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
import { useAccountData } from '@onekeyhq/kit/src/hooks/useAccountData';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { validateTokenAmount } from '@onekeyhq/shared/src/utils/tokenUtils';
import {
  EAmountInputMode,
  type IAmountInputError,
} from '@onekeyhq/shared/types/bulkSend';

import {
  filterNumericInput,
  generateRandomAmountsFromRange,
  validateRangeInput,
} from '../../../utils';

import { useBulkSendAmountsInputContext } from './Context';

export function SpecifiedAmountInput() {
  const intl = useIntl();
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
    previewState,
    setPreviewState,
  } = useBulkSendAmountsInputContext();

  const isInPreviewMode = previewState.specifiedPreviewed;

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

      // Reset preview state when input changes
      setPreviewState((prev) => ({ ...prev, specifiedPreviewed: false }));

      const { error } = validateTokenAmount({
        token: tokenInfo,
        amount: new BigNumber(value || '0')
          .times(transfersInfo.length)
          .toFixed(),
        maxAmount: balance ?? '0',
        allowZero: false,
        customErrorMessages: {
          maxAmount: intl.formatMessage({
            id: ETranslations.swap_page_button_insufficient_balance,
          }),
          zeroAmount: intl.formatMessage({
            id: ETranslations.wallet_bulk_send_error_amount_zero,
          }),
          decimalPlaces: intl.formatMessage(
            {
              id: ETranslations.wallet_bulk_send_error_max_decimal_places,
            },
            { decimals: tokenInfo.decimals },
          ),
        },
      });
      setAmountInputErrors({
        ...amountInputErrors,
        specifiedAmount: error,
      });
    },
    [
      intl,
      amountInputValues,
      setAmountInputValues,
      tokenInfo,
      balance,
      transfersInfo.length,
      amountInputErrors,
      setAmountInputErrors,
      setPreviewState,
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
          autoFocus: !isInPreviewMode,
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
  const intl = useIntl();
  const {
    tokenDetails,
    tokenInfo,
    transfersInfo,
    amountInputValues,
    setAmountInputValues,
    amountInputErrors,
    setAmountInputErrors,
    setPreviewState,
  } = useBulkSendAmountsInputContext();

  const [settings] = useSettingsPersistAtom();

  const balance = tokenDetails?.balanceParsed ?? '0';

  // Local display values for immediate UI feedback
  const [localMin, setLocalMin] = useState(amountInputValues.rangeMin);
  const [localMax, setLocalMax] = useState(amountInputValues.rangeMax);

  // Keep local values in sync with external changes
  const prevAmountInputValuesRef = useRef(amountInputValues);
  useEffect(() => {
    const prev = prevAmountInputValuesRef.current;
    if (prev.rangeMin !== amountInputValues.rangeMin) {
      setLocalMin(amountInputValues.rangeMin);
    }
    if (prev.rangeMax !== amountInputValues.rangeMax) {
      setLocalMax(amountInputValues.rangeMax);
    }
    prevAmountInputValuesRef.current = amountInputValues;
  }, [amountInputValues]);

  const validateRange = useCallback(
    (min: string, max: string): IAmountInputError => {
      const error = validateRangeInput({
        rangeMin: min,
        rangeMax: max,
        balance,
      });
      return error ? { rangeError: error } : {};
    },
    [balance],
  );

  const generatePreviewAmounts = useCallback(
    (min: string, max: string): string[] => {
      if (!tokenInfo || !min || !max || transfersInfo.length === 0) return [];
      return generateRandomAmountsFromRange({
        transfersInfo,
        rangeMin: min,
        rangeMax: max,
        decimals: tokenInfo.decimals,
        balance: [balance],
      });
    },
    [transfersInfo, tokenInfo, balance],
  );

  // Use refs to avoid stale closures in useEffect
  const validateRangeRef = useRef(validateRange);
  validateRangeRef.current = validateRange;
  const generatePreviewAmountsRef = useRef(generatePreviewAmounts);
  generatePreviewAmountsRef.current = generatePreviewAmounts;
  const amountInputValuesRef = useRef(amountInputValues);
  amountInputValuesRef.current = amountInputValues;

  // Generate initial preview amounts when component mounts with valid values
  // or when transfersInfo length changes (e.g., user adds/removes addresses)
  useEffect(() => {
    const { rangeMin, rangeMax } = amountInputValuesRef.current;
    if (!rangeMin || !rangeMax || transfersInfo.length === 0) return;

    const errors = validateRangeRef.current(rangeMin, rangeMax);
    if (errors.rangeError) {
      // Set validation error on mount (e.g., balance=0 → both inputs are 0)
      /* eslint-disable @typescript-eslint/no-use-before-define */
      setAmountInputErrors({
        ...amountInputErrorsRef.current,
        rangeError: errors.rangeError,
      });
      /* eslint-enable @typescript-eslint/no-use-before-define */
    } else {
      const previewAmounts = generatePreviewAmountsRef.current(
        rangeMin,
        rangeMax,
      );
      setPreviewState((prev) => ({
        ...prev,
        rangePreviewAmounts: previewAmounts,
      }));
    }
  }, [transfersInfo.length, setPreviewState, setAmountInputErrors]);

  const amountInputErrorsRef = useRef(amountInputErrors);
  amountInputErrorsRef.current = amountInputErrors;

  // Debounced handler for validation and preview generation
  const debouncedUpdatePreview = useDebouncedCallback(
    (newValues: { rangeMin: string; rangeMax: string }) => {
      setAmountInputValues({
        ...amountInputValuesRef.current,
        rangeMin: newValues.rangeMin,
        rangeMax: newValues.rangeMax,
      });

      const errors = validateRangeRef.current(
        newValues.rangeMin,
        newValues.rangeMax,
      );
      setAmountInputErrors({
        ...amountInputErrorsRef.current,
        rangeError: errors.rangeError,
      });

      const hasValidRange =
        !errors.rangeError && newValues.rangeMin && newValues.rangeMax;
      const previewAmounts = hasValidRange
        ? generatePreviewAmountsRef.current(
            newValues.rangeMin,
            newValues.rangeMax,
          )
        : [];

      setPreviewState((prev) => ({
        ...prev,
        rangePreviewed: false,
        rangePreviewAmounts: previewAmounts,
      }));
    },
    300,
  );

  const localMinRef = useRef(localMin);
  localMinRef.current = localMin;
  const localMaxRef = useRef(localMax);
  localMaxRef.current = localMax;

  const handleMinChange = useCallback(
    (value: string) => {
      const filtered = filterNumericInput(value);
      setLocalMin(filtered);
      debouncedUpdatePreview({
        rangeMin: filtered,
        rangeMax: localMaxRef.current,
      });
    },
    [debouncedUpdatePreview],
  );

  const handleMaxChange = useCallback(
    (value: string) => {
      const filtered = filterNumericInput(value);
      setLocalMax(filtered);
      debouncedUpdatePreview({
        rangeMin: localMinRef.current,
        rangeMax: filtered,
      });
    },
    [debouncedUpdatePreview],
  );

  // Calculate fiat values from local display values for immediate feedback
  const minFiatValue = useMemo(() => {
    const amount = new BigNumber(localMin || '0');
    if (amount.isNaN() || !tokenDetails?.price) return '0';
    return amount.times(tokenDetails.price).toFixed();
  }, [localMin, tokenDetails?.price]);

  const maxFiatValue = useMemo(() => {
    const amount = new BigNumber(localMax || '0');
    if (amount.isNaN() || !tokenDetails?.price) return '0';
    return amount.times(tokenDetails.price).toFixed();
  }, [localMax, tokenDetails?.price]);

  const hasError = !!amountInputErrors.rangeError;
  const sharedStyles = getSharedInputStyles({
    error: hasError,
  });

  return (
    <YStack gap="$1.5" w="100%">
      <XStack gap="$2" alignItems="center" w="100%">
        <Stack
          flex={1}
          borderRadius="$3"
          borderWidth={sharedStyles.borderWidth}
          borderColor={sharedStyles.borderColor}
          overflow="hidden"
        >
          <XStack alignItems="center" px="$3.5" pt="$2.5" pb="$1">
            <Input
              flex={1}
              value={localMin}
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
              {...(platformEnv.isNativeAndroid && {
                includeFontPadding: false,
                h: 44,
              })}
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

        <Stack w="$2" h="$0.5" bg="$borderStrong" />

        <Stack
          flex={1}
          borderRadius="$3"
          borderWidth={sharedStyles.borderWidth}
          borderColor={sharedStyles.borderColor}
          overflow="hidden"
        >
          <XStack alignItems="center" px="$3.5" pt="$2.5" pb="$1">
            <Input
              flex={1}
              value={localMax}
              onChangeText={handleMaxChange}
              placeholder={intl.formatMessage({
                id: ETranslations.global_max,
              })}
              keyboardType="decimal-pad"
              containerProps={{
                width: '100%',
                borderWidth: 0,
              }}
              fontSize={28}
              fontWeight="600"
              px="$0"
              {...(platformEnv.isNativeAndroid && {
                includeFontPadding: false,
                h: 44,
              })}
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
      </XStack>
      {amountInputErrors.rangeError ? (
        <SizableText size="$bodyMd" color="$textCritical" px="$1">
          {amountInputErrors.rangeError}
        </SizableText>
      ) : null}
    </YStack>
  );
}

function CustomAmountDisplay() {
  const intl = useIntl();
  return (
    <YStack alignItems="center" justifyContent="center" p="$5">
      <SizableText
        size="$bodyLg"
        color="$textSubdued"
        textAlign="center"
        maxWidth={256}
      >
        {intl.formatMessage({
          id: ETranslations.wallet_bulk_send_custom_mode_hint,
        })}
      </SizableText>
    </YStack>
  );
}

export function AmountInputSection({ inDialog }: { inDialog?: boolean }) {
  const intl = useIntl();
  const {
    amountInputMode,
    setAmountInputMode,
    setAmountInputErrors,
    setPreviewState,
    transfersInfo,
    tokenInfo,
    tokenDetails,
    amountInputValues,
    hasCustomAmounts,
  } = useBulkSendAmountsInputContext();

  // Only show Custom option if receivers have custom amounts from address input
  const segmentOptions = useMemo(() => {
    const options = [
      {
        label: intl.formatMessage({
          id: ETranslations.wallet_bulk_send_amount_mode_specified,
        }),
        value: EAmountInputMode.Specified,
      },
      {
        label: intl.formatMessage({
          id: ETranslations.wallet_bulk_send_amount_mode_range,
        }),
        value: EAmountInputMode.Range,
      },
    ];
    if (hasCustomAmounts) {
      options.push({
        label: intl.formatMessage({
          id: ETranslations.wallet_bulk_send_amount_mode_custom,
        }),
        value: EAmountInputMode.Custom,
      });
    }
    return options;
  }, [intl, hasCustomAmounts]);

  const validateSpecifiedAmount = useCallback((): IAmountInputError => {
    const balance = tokenDetails?.balanceParsed ?? '0';
    const { error } = validateTokenAmount({
      token: tokenInfo,
      amount: new BigNumber(amountInputValues.specifiedAmount || '0')
        .times(transfersInfo.length)
        .toFixed(),
      maxAmount: balance,
      allowZero: false,
      customErrorMessages: {
        maxAmount: intl.formatMessage({
          id: ETranslations.swap_page_button_insufficient_balance,
        }),
        zeroAmount: intl.formatMessage({
          id: ETranslations.wallet_bulk_send_error_amount_zero,
        }),
        decimalPlaces: intl.formatMessage(
          {
            id: ETranslations.wallet_bulk_send_error_max_decimal_places,
          },
          { decimals: tokenInfo.decimals },
        ),
      },
    });
    return { specifiedAmount: error };
  }, [
    intl,
    tokenInfo,
    tokenDetails?.balanceParsed,
    amountInputValues.specifiedAmount,
    transfersInfo.length,
  ]);

  const validateRangeAmount = useCallback((): IAmountInputError => {
    const balance = tokenDetails?.balanceParsed ?? '0';
    const error = validateRangeInput({
      rangeMin: amountInputValues.rangeMin,
      rangeMax: amountInputValues.rangeMax,
      balance,
    });
    return error ? { rangeError: error } : {};
  }, [
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
      if (inDialog) {
        switch (newMode) {
          case EAmountInputMode.Specified:
            setAmountInputErrors(validateSpecifiedAmount());
            break;
          case EAmountInputMode.Range:
            setAmountInputErrors(validateRangeAmount());
            break;
          default:
            setAmountInputErrors({});
        }
      } else {
        // Mobile mode: reset preview state when switching tabs
        // User should click "Next" again to confirm the new mode
        setAmountInputErrors({});
        setPreviewState((prev) => ({
          ...prev,
          specifiedPreviewed: false,
          rangePreviewed: false,
        }));
      }
    },
    [
      inDialog,
      setAmountInputMode,
      setAmountInputErrors,
      setPreviewState,
      validateSpecifiedAmount,
      validateRangeAmount,
    ],
  );

  const renderContent = () => {
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
  };

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

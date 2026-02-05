import { useCallback, useEffect, useMemo, useRef } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

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
import { validateTokenAmount } from '@onekeyhq/shared/src/utils/tokenUtils';
import {
  EAmountInputMode,
  type IAmountInputError,
} from '@onekeyhq/shared/types/bulkSend';

import {
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
        balance: [balance], // Pass balance to constrain total
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

    // Use validateRange to check validity
    const errors = validateRangeRef.current(rangeMin, rangeMax);
    if (!errors.rangeError) {
      const previewAmounts = generatePreviewAmountsRef.current(
        rangeMin,
        rangeMax,
      );
      setPreviewState((prev) => ({
        ...prev,
        rangePreviewAmounts: previewAmounts,
      }));
    }
  }, [transfersInfo.length, setPreviewState]);

  const handleRangeChange = useCallback(
    (field: 'rangeMin' | 'rangeMax', value: string) => {
      const newValues = { ...amountInputValues, [field]: value };
      setAmountInputValues(newValues);

      const errors = validateRange(newValues.rangeMin, newValues.rangeMax);
      setAmountInputErrors({
        ...amountInputErrors,
        rangeError: errors.rangeError,
      });

      // Generate preview amounts if valid
      const hasValidRange =
        !errors.rangeError && newValues.rangeMin && newValues.rangeMax;
      const previewAmounts = hasValidRange
        ? generatePreviewAmounts(newValues.rangeMin, newValues.rangeMax)
        : [];

      setPreviewState((prev) => ({
        ...prev,
        rangePreviewed: false,
        rangePreviewAmounts: previewAmounts,
      }));
    },
    [
      amountInputValues,
      setAmountInputValues,
      validateRange,
      amountInputErrors,
      setAmountInputErrors,
      setPreviewState,
      generatePreviewAmounts,
    ],
  );

  const handleMinChange = useCallback(
    (value: string) => handleRangeChange('rangeMin', value),
    [handleRangeChange],
  );

  const handleMaxChange = useCallback(
    (value: string) => handleRangeChange('rangeMax', value),
    [handleRangeChange],
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
              value={amountInputValues.rangeMax}
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

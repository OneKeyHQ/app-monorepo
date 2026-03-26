import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';
import { useDebouncedCallback } from 'use-debounce';

import {
  Button,
  Dialog,
  Icon,
  IconButton,
  Input,
  NumberSizeableText,
  Select,
  SizableText,
  Skeleton,
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
  EBulkSendMode,
  EIntervalMode,
  type IIntervalSettings,
  type ITransferInfoErrors,
} from '@onekeyhq/shared/types/bulkSend';

import {
  INTERVAL_SETTINGS_CANCEL_TEXT,
  INTERVAL_SETTINGS_CONFIRM_TEXT,
  INTERVAL_SETTINGS_NONE_LABEL,
  INTERVAL_SETTINGS_TITLE,
  IntervalSettingsContent,
} from '../../../components/IntervalSettingsContent';
import {
  filterNumericInput,
  formatIntervalSecondsRange,
  getBulkSendMinTransferDisplayAmount,
  validateIntervalSettings,
  validateRangeInput,
} from '../../../utils';

import { useBulkSendAmountsInputContext } from './Context';
import { useAmountPreview } from './useAmountPreview';
import { useTransferInfoActions } from './useTransferInfoActions';

function IntervalDialogContent({
  initialSettings,
  onConfirm,
}: {
  initialSettings: IIntervalSettings;
  onConfirm: (settings: IIntervalSettings) => void;
}) {
  const [settings, setSettings] = useState<IIntervalSettings>(initialSettings);
  const [showValidationError, setShowValidationError] = useState(false);

  const intervalError = useMemo(
    () => validateIntervalSettings(settings),
    [settings],
  );
  const shouldShowIntervalError = useMemo(
    () =>
      settings.mode === EIntervalMode.Specified &&
      (showValidationError ||
        settings.minSeconds !== '' ||
        settings.maxSeconds !== ''),
    [settings, showValidationError],
  );

  const handleConfirm = useCallback(() => {
    if (intervalError) {
      setShowValidationError(true);
      return;
    }
    onConfirm(settings);
  }, [intervalError, settings, onConfirm]);

  return (
    <YStack>
      <IntervalSettingsContent
        value={settings}
        error={shouldShowIntervalError ? intervalError : undefined}
        onChange={setSettings}
      />
      <Dialog.Footer
        onConfirm={handleConfirm}
        onConfirmText={INTERVAL_SETTINGS_CONFIRM_TEXT}
        onCancelText={INTERVAL_SETTINGS_CANCEL_TEXT}
      />
    </YStack>
  );
}

function IntervalCard() {
  const { intervalSettings, setIntervalSettings } =
    useBulkSendAmountsInputContext();

  const handlePress = useCallback(() => {
    Dialog.show({
      title: INTERVAL_SETTINGS_TITLE,
      showFooter: false,
      renderContent: (
        <IntervalDialogContent
          initialSettings={intervalSettings}
          onConfirm={setIntervalSettings}
        />
      ),
    });
  }, [intervalSettings, setIntervalSettings]);

  const intervalSummary = useMemo(() => {
    if (intervalSettings.mode === EIntervalMode.Specified) {
      return formatIntervalSecondsRange({
        minSeconds: intervalSettings.minSeconds,
        maxSeconds: intervalSettings.maxSeconds,
      });
    }
    return INTERVAL_SETTINGS_NONE_LABEL;
  }, [intervalSettings]);

  return (
    <YStack
      flex={1}
      flexBasis={0}
      gap="$3"
      bg="$bgSubdued"
      borderRadius="$3"
      p="$5"
      cursor="pointer"
      hoverStyle={{ bg: '$bgHover' }}
      pressStyle={{ bg: '$bgActive' }}
      onPress={handlePress}
    >
      {/* Header: Title + Summary */}
      <XStack alignItems="center" justifyContent="space-between">
        <SizableText size="$bodyLgMedium">
          {INTERVAL_SETTINGS_TITLE}
        </SizableText>
        <Button
          variant="tertiary"
          size="small"
          iconAfter="ChevronDownSmallOutline"
          onPress={handlePress}
        >
          {intervalSummary}
        </Button>
      </XStack>

      {/* Content */}
      <YStack flex={1} justifyContent="center" alignItems="center">
        <SizableText size="$heading3xl" textAlign="center">
          {intervalSummary}
        </SizableText>
      </YStack>
    </YStack>
  );
}

function AmountCard() {
  const intl = useIntl();
  const {
    networkId,
    tokenInfo,
    tokenDetails,
    transfersInfo,
    amountInputMode,
    amountInputValues,
    amountInputErrors,
    setAmountInputMode,
    setAmountInputValues,
    setAmountInputErrors,
    setTransfersInfo,
    setTransferInfoErrors,
    previewState,
    setPreviewState,
    hasCustomAmounts,
    minTransferAmount,
    bulkSendMode,
    isMaxMode,
    setIsMaxMode,
  } = useBulkSendAmountsInputContext();

  const [settings] = useSettingsPersistAtom();
  const { network } = useAccountData({ networkId });

  const isOneToMany = bulkSendMode === EBulkSendMode.OneToMany;
  const balance = tokenDetails?.balanceParsed ?? '0';
  const minTransferDisplayAmount = useMemo(
    () =>
      getBulkSendMinTransferDisplayAmount({
        minTransferAmount,
        tokenDecimals: tokenInfo?.decimals,
      }),
    [minTransferAmount, tokenInfo?.decimals],
  );

  const { updateTransfersInfoWithAmounts } = useAmountPreview({
    tokenInfo,
    transfersInfo,
    setTransfersInfo,
    previewState,
    setPreviewState,
    balance: isOneToMany ? tokenDetails?.balanceParsed : undefined,
  });

  // Mode select options
  const modeOptions = useMemo(() => {
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

  // Handle mode change
  const handleModeChange = useCallback(
    (value: EAmountInputMode) => {
      if (!tokenInfo) return;
      setAmountInputMode(value);
      // Reset Max mode when switching away from Specified
      if (value !== EAmountInputMode.Specified && isMaxMode) {
        setIsMaxMode(false);
      }
      updateTransfersInfoWithAmounts(value, amountInputValues);
      if (value === EAmountInputMode.Custom) {
        const errors: ITransferInfoErrors = {};
        transfersInfo.forEach((transfer, index) => {
          const { isValid, error } = validateTokenAmount({
            token: tokenInfo,
            amount: transfer.amount,
            allowZero: false,
            minAmount:
              minTransferAmount && minTransferAmount !== '0'
                ? minTransferAmount
                : undefined,
            customErrorMessages: {
              zeroAmount: intl.formatMessage({
                id: ETranslations.wallet_bulk_send_error_amount_zero,
              }),
              decimalPlaces: intl.formatMessage(
                {
                  id: ETranslations.wallet_bulk_send_error_max_decimal_places,
                },
                { decimals: tokenInfo.decimals },
              ),
              minAmount: intl.formatMessage(
                { id: ETranslations.send_error_minimum_amount },
                {
                  amount: minTransferDisplayAmount,
                  token: tokenInfo.symbol,
                },
              ),
            },
          });
          if (!isValid && error) {
            errors[index] = { amount: error };
          }
        });
        setTransferInfoErrors(errors);
      } else {
        setTransferInfoErrors({});
      }
    },
    [
      intl,
      setAmountInputMode,
      isMaxMode,
      setIsMaxMode,
      updateTransfersInfoWithAmounts,
      amountInputValues,
      transfersInfo,
      tokenInfo,
      setTransferInfoErrors,
      minTransferAmount,
      minTransferDisplayAmount,
    ],
  );

  // Handle specified amount change
  const handleSpecifiedAmountChange = useCallback(
    (value: string) => {
      if (!tokenInfo) return;
      const newValues = { ...amountInputValues, specifiedAmount: value };
      setAmountInputValues(newValues);

      // Check per-transfer minTransferAmount first
      const valueBN = new BigNumber(value || '0');
      const minTransferAmountBN = new BigNumber(minTransferAmount);
      if (
        !minTransferAmountBN.isZero() &&
        !valueBN.isZero() &&
        !valueBN.isNaN() &&
        valueBN.isLessThan(minTransferAmountBN)
      ) {
        setAmountInputErrors({
          ...amountInputErrors,
          specifiedAmount: intl.formatMessage(
            { id: ETranslations.send_error_minimum_amount },
            { amount: minTransferDisplayAmount, token: tokenInfo.symbol },
          ),
        });
        updateTransfersInfoWithAmounts(amountInputMode, newValues);
        return;
      }

      const { error } = validateTokenAmount({
        token: tokenInfo,
        amount: valueBN.times(transfersInfo.length).toFixed(),
        maxAmount: isOneToMany ? balance : undefined,
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
      setAmountInputErrors({ ...amountInputErrors, specifiedAmount: error });

      updateTransfersInfoWithAmounts(amountInputMode, newValues);
    },
    [
      intl,
      amountInputValues,
      setAmountInputValues,
      tokenInfo,
      transfersInfo.length,
      balance,
      isOneToMany,
      amountInputErrors,
      setAmountInputErrors,
      updateTransfersInfoWithAmounts,
      amountInputMode,
      minTransferAmount,
      minTransferDisplayAmount,
    ],
  );

  // Local display values for range inputs (immediate UI feedback)
  const [localRangeMin, setLocalRangeMin] = useState(
    amountInputValues.rangeMin,
  );
  const [localRangeMax, setLocalRangeMax] = useState(
    amountInputValues.rangeMax,
  );

  // Keep local values in sync with external changes (e.g., mode switch)
  const prevAmountInputValuesRef = useRef(amountInputValues);
  useEffect(() => {
    const prev = prevAmountInputValuesRef.current;
    if (prev.rangeMin !== amountInputValues.rangeMin) {
      setLocalRangeMin(amountInputValues.rangeMin);
    }
    if (prev.rangeMax !== amountInputValues.rangeMax) {
      setLocalRangeMax(amountInputValues.rangeMax);
    }
    prevAmountInputValuesRef.current = amountInputValues;
  }, [amountInputValues]);

  // Refs for stable access in debounced callback
  const amountInputValuesRef = useRef(amountInputValues);
  amountInputValuesRef.current = amountInputValues;
  const amountInputErrorsRef = useRef(amountInputErrors);
  amountInputErrorsRef.current = amountInputErrors;
  const localRangeMinRef = useRef(localRangeMin);
  localRangeMinRef.current = localRangeMin;
  const localRangeMaxRef = useRef(localRangeMax);
  localRangeMaxRef.current = localRangeMax;

  // Debounced handler for validation and transfer info update
  const debouncedRangeUpdate = useDebouncedCallback(
    (newValues: { rangeMin: string; rangeMax: string }) => {
      const fullValues = {
        ...amountInputValuesRef.current,
        rangeMin: newValues.rangeMin,
        rangeMax: newValues.rangeMax,
      };
      setAmountInputValues(fullValues);

      const error = validateRangeInput({
        rangeMin: newValues.rangeMin,
        rangeMax: newValues.rangeMax,
        balance: isOneToMany ? balance : undefined,
        minTransferAmount,
        tokenSymbol: tokenInfo?.symbol,
        tokenDecimals: tokenInfo?.decimals,
      });
      setAmountInputErrors({
        ...amountInputErrorsRef.current,
        rangeError: error,
      });

      updateTransfersInfoWithAmounts(amountInputMode, fullValues);
    },
    300,
  );

  const handleRangeMinChange = useCallback(
    (value: string) => {
      const filtered = filterNumericInput(value);
      setLocalRangeMin(filtered);
      debouncedRangeUpdate({
        rangeMin: filtered,
        rangeMax: localRangeMaxRef.current,
      });
    },
    [debouncedRangeUpdate],
  );

  const handleRangeMaxChange = useCallback(
    (value: string) => {
      const filtered = filterNumericInput(value);
      setLocalRangeMax(filtered);
      debouncedRangeUpdate({
        rangeMin: localRangeMinRef.current,
        rangeMax: filtered,
      });
    },
    [debouncedRangeUpdate],
  );

  // Handle Max button press
  const handleMaxPress = useCallback(() => {
    if (!tokenInfo) return;
    if (amountInputMode !== EAmountInputMode.Specified) return;

    // Non-OneToMany: toggle Max mode (send full balance per sender)
    if (!isOneToMany) {
      setIsMaxMode(!isMaxMode);
      return;
    }

    // OneToMany: calculate max amount per address from balance
    if (!balance || transfersInfo.length === 0) return;
    const maxAmountPerAddress = new BigNumber(balance)
      .dividedBy(transfersInfo.length)
      .decimalPlaces(tokenInfo.decimals, BigNumber.ROUND_DOWN)
      .toFixed();
    const newValues = {
      ...amountInputValues,
      specifiedAmount: maxAmountPerAddress,
    };
    setAmountInputValues(newValues);
    // Validate against minTransferAmount
    const maxAmountBN = new BigNumber(maxAmountPerAddress);
    const minTransferAmountBN = new BigNumber(minTransferAmount);
    if (
      !minTransferAmountBN.isZero() &&
      !maxAmountBN.isZero() &&
      maxAmountBN.isLessThan(minTransferAmountBN)
    ) {
      setAmountInputErrors({
        ...amountInputErrors,
        specifiedAmount: intl.formatMessage(
          { id: ETranslations.send_error_minimum_amount },
          { amount: minTransferDisplayAmount, token: tokenInfo.symbol },
        ),
      });
    } else {
      setAmountInputErrors({
        ...amountInputErrors,
        specifiedAmount: undefined,
      });
    }
    updateTransfersInfoWithAmounts(amountInputMode, newValues);
  }, [
    intl,
    amountInputMode,
    isOneToMany,
    isMaxMode,
    setIsMaxMode,
    balance,
    transfersInfo.length,
    tokenInfo,
    amountInputValues,
    setAmountInputValues,
    amountInputErrors,
    setAmountInputErrors,
    updateTransfersInfoWithAmounts,
    minTransferAmount,
    minTransferDisplayAmount,
  ]);

  // Calculate fiat value for specified amount
  const specifiedFiatValue = useMemo(() => {
    const amount = new BigNumber(amountInputValues.specifiedAmount || '0');
    if (amount.isNaN() || !tokenDetails?.price) return '0';
    return amount.times(tokenDetails.price).toFixed();
  }, [amountInputValues.specifiedAmount, tokenDetails?.price]);

  // Calculate fiat values for range from local values for immediate feedback
  const minFiatValue = useMemo(() => {
    const amount = new BigNumber(localRangeMin || '0');
    if (amount.isNaN() || !tokenDetails?.price) return '0';
    return amount.times(tokenDetails.price).toFixed();
  }, [localRangeMin, tokenDetails?.price]);

  const maxFiatValue = useMemo(() => {
    const amount = new BigNumber(localRangeMax || '0');
    if (amount.isNaN() || !tokenDetails?.price) return '0';
    return amount.times(tokenDetails.price).toFixed();
  }, [localRangeMax, tokenDetails?.price]);

  // Guard: Don't render if tokenInfo is not available
  if (!tokenInfo) {
    return null;
  }

  const hasRangeError = !!amountInputErrors.rangeError;
  const hasSpecifiedAmountError =
    !isMaxMode && !!amountInputErrors.specifiedAmount;
  const sharedStyles = getSharedInputStyles({ error: hasRangeError });

  const renderAmountInput = () => {
    switch (amountInputMode) {
      case EAmountInputMode.Specified:
        return (
          <BaseAmountInput
            bg="$bgApp"
            value={isMaxMode ? 'Max' : amountInputValues.specifiedAmount}
            onChange={handleSpecifiedAmountChange}
            hasError={hasSpecifiedAmountError}
            inputProps={{
              placeholder: '0',
              readonly: isMaxMode,
            }}
            valueProps={{
              value: isMaxMode ? '-' : specifiedFiatValue,
              currency: settings.currencyInfo.symbol,
            }}
            tokenSelectorTriggerProps={{
              selectedTokenImageUri: tokenDetails?.info.logoURI,
              selectedNetworkImageUri: network?.logoURI,
              selectedTokenSymbol: tokenInfo.symbol,
            }}
          />
        );

      case EAmountInputMode.Range:
        return (
          <XStack gap="$2" alignItems="center">
            {/* Min Input */}
            <Stack
              flex={1}
              flexBasis={0}
              borderRadius="$3"
              borderWidth={sharedStyles.borderWidth}
              borderColor={sharedStyles.borderColor}
              bg="$bgApp"
              overflow="hidden"
            >
              <XStack alignItems="center" px="$3.5" pt="$2.5" pb="$1">
                <Input
                  flex={1}
                  value={localRangeMin}
                  onChangeText={handleRangeMinChange}
                  placeholder="0"
                  keyboardType="decimal-pad"
                  containerProps={{
                    flex: 1,
                    borderWidth: 0,
                  }}
                  bg="transparent"
                  fontSize={24}
                  fontWeight="600"
                  px="$0"
                />
              </XStack>
              <XStack
                alignItems="center"
                justifyContent="space-between"
                px="$3.5"
                pb="$2.5"
              >
                <NumberSizeableText
                  flex={1}
                  minWidth={0}
                  numberOfLines={1}
                  size="$bodySm"
                  color="$textSubdued"
                  formatter="value"
                  formatterOptions={{ currency: settings.currencyInfo.symbol }}
                >
                  {minFiatValue}
                </NumberSizeableText>
                <SizableText
                  size="$bodyMdMedium"
                  color="$textSubdued"
                  flexShrink={0}
                  ml="$1"
                >
                  {tokenInfo.symbol}
                </SizableText>
              </XStack>
            </Stack>

            {/* Divider */}
            <Stack w="$2" h="$0.5" bg="$borderStrong" flexShrink={0} />

            {/* Max Input */}
            <Stack
              flex={1}
              flexBasis={0}
              borderRadius="$3"
              borderWidth={sharedStyles.borderWidth}
              borderColor={sharedStyles.borderColor}
              bg="$bgApp"
              overflow="hidden"
            >
              <XStack alignItems="center" px="$3.5" pt="$2.5" pb="$1">
                <Input
                  flex={1}
                  value={localRangeMax}
                  onChangeText={handleRangeMaxChange}
                  placeholder="0"
                  keyboardType="decimal-pad"
                  containerProps={{
                    flex: 1,
                    borderWidth: 0,
                  }}
                  bg="transparent"
                  fontSize={24}
                  fontWeight="600"
                  px="$0"
                />
              </XStack>
              <XStack
                alignItems="center"
                justifyContent="space-between"
                px="$3.5"
                pb="$2.5"
              >
                <NumberSizeableText
                  flex={1}
                  minWidth={0}
                  numberOfLines={1}
                  size="$bodySm"
                  color="$textSubdued"
                  formatter="value"
                  formatterOptions={{ currency: settings.currencyInfo.symbol }}
                >
                  {maxFiatValue}
                </NumberSizeableText>
                <SizableText
                  size="$bodyMdMedium"
                  color="$textSubdued"
                  flexShrink={0}
                  ml="$1"
                >
                  {tokenInfo.symbol}
                </SizableText>
              </XStack>
            </Stack>
          </XStack>
        );

      case EAmountInputMode.Custom:
        return (
          <YStack alignItems="center" justifyContent="center" py="$4">
            <SizableText size="$bodyMd" color="$textSubdued" textAlign="center">
              {intl.formatMessage({
                id: ETranslations.wallet_bulk_send_custom_mode_hint,
              })}
            </SizableText>
          </YStack>
        );

      default:
        return null;
    }
  };

  return (
    <YStack
      flex={1}
      flexBasis={0}
      gap="$3"
      bg="$bgSubdued"
      borderRadius="$3"
      p="$5"
    >
      {/* Header: Title + Mode Select */}
      <XStack alignItems="center" justifyContent="space-between">
        <SizableText size="$bodyLgMedium">
          {intl.formatMessage({
            id: ETranslations.wallet_bulk_send_label_set_amount,
          })}
        </SizableText>
        <Select
          title=""
          value={amountInputMode}
          onChange={handleModeChange}
          items={modeOptions}
          placement="bottom-end"
          renderTrigger={({ label, onPress }) => (
            <Button
              variant="tertiary"
              size="small"
              iconAfter="ChevronDownSmallOutline"
              onPress={onPress}
            >
              {label}
            </Button>
          )}
        />
      </XStack>

      {/* Amount Input */}
      {renderAmountInput()}

      {/* Error message */}
      {amountInputMode === EAmountInputMode.Specified &&
      hasSpecifiedAmountError ? (
        <SizableText size="$bodySm" color="$textCritical">
          {amountInputErrors.specifiedAmount}
        </SizableText>
      ) : null}
      {amountInputMode === EAmountInputMode.Range &&
      amountInputErrors.rangeError ? (
        <SizableText size="$bodySm" color="$textCritical">
          {amountInputErrors.rangeError}
        </SizableText>
      ) : null}

      {/* Available + Max */}
      <XStack alignItems="center" justifyContent="space-between">
        {isOneToMany ? (
          <XStack gap="$1" alignItems="center">
            <SizableText size="$bodySm" color="$textSubdued">
              {intl.formatMessage({
                id: ETranslations.wallet_bulk_send_available,
              })}
            </SizableText>
            <NumberSizeableText
              size="$bodySm"
              color="$text"
              formatter="balance"
              formatterOptions={{ tokenSymbol: tokenInfo.symbol }}
            >
              {tokenDetails?.balanceParsed ?? '-'}
            </NumberSizeableText>
          </XStack>
        ) : (
          <Stack />
        )}
        {amountInputMode === EAmountInputMode.Specified ? (
          <SizableText
            size="$bodySmMedium"
            color={isMaxMode ? '$textSuccess' : '$textInteractive'}
            cursor="default"
            userSelect="none"
            onPress={handleMaxPress}
            hitSlop={8}
            hoverStyle={{ opacity: 0.75 }}
            pressStyle={{ opacity: 0.5 }}
          >
            {isMaxMode
              ? `${intl.formatMessage({ id: ETranslations.global_cancel })} ${intl.formatMessage({ id: ETranslations.global_max })}`
              : intl.formatMessage({ id: ETranslations.global_max })}
          </SizableText>
        ) : null}
      </XStack>
    </YStack>
  );
}

function TransferInfoListSection() {
  const intl = useIntl();
  const {
    transfersInfo,
    setTransfersInfo,
    amountInputMode,
    tokenInfo,
    transferInfoErrors,
    setTransferInfoErrors,
    minTransferAmount,
    isMaxMode,
    bulkSendMode,
    senderBalances,
    senderBalancesLoading,
    senderBalancesFailed,
  } = useBulkSendAmountsInputContext();

  const isOneToMany = bulkSendMode === EBulkSendMode.OneToMany;

  const { handleDeleteTransfer, handleAmountChange } = useTransferInfoActions({
    tokenInfo,
    transfersInfo,
    setTransfersInfo,
    transferInfoErrors,
    setTransferInfoErrors,
    minTransferAmount,
  });

  const isCustomMode = amountInputMode === EAmountInputMode.Custom;

  if (transfersInfo.length === 0) {
    return null;
  }

  return (
    <YStack
      borderWidth={1}
      borderColor="$borderSubdued"
      borderRadius="$3"
      py="$2"
    >
      {/* Header */}
      <XStack px="$5" py="$2" gap="$3">
        <SizableText
          size="$headingXs"
          color="$textSubdued"
          textTransform="uppercase"
          width={36}
          flexShrink={0}
        >
          #
        </SizableText>
        <XStack flex={1} flexBasis={0} minWidth={0}>
          <SizableText
            size="$headingXs"
            color="$textSubdued"
            textTransform="uppercase"
          >
            {intl.formatMessage({
              id: ETranslations.wallet_bulk_send_table_from,
            })}
          </SizableText>
        </XStack>
        <Stack flex={1} flexBasis={0} minWidth={0}>
          <SizableText
            size="$headingXs"
            color="$textSubdued"
            textTransform="uppercase"
          >
            {intl.formatMessage({
              id: ETranslations.wallet_bulk_send_table_to,
            })}
          </SizableText>
        </Stack>
        <Stack width={100}>
          <SizableText
            size="$headingXs"
            color="$textSubdued"
            textTransform="uppercase"
            textAlign="right"
          >
            {intl.formatMessage({
              id: ETranslations.wallet_bulk_send_table_amount,
            })}
          </SizableText>
        </Stack>
        <Stack width={64}>
          <SizableText
            size="$headingXs"
            color="$textSubdued"
            textTransform="uppercase"
            textAlign="right"
          >
            {intl.formatMessage({
              id: ETranslations.wallet_bulk_send_table_action,
            })}
          </SizableText>
        </Stack>
      </XStack>

      {/* List Items */}
      {transfersInfo.map((transfer, index) => {
        const errors = transferInfoErrors[index];
        const hasFromError = !!errors?.from;
        const hasToError = !!errors?.to;
        const hasAmountError = !!errors?.amount;
        const displayAmount =
          !isOneToMany && isMaxMode
            ? senderBalances[transfer.from]
            : transfer.amount;

        return (
          <XStack
            key={`${transfer.from}-${transfer.to}-${index}`}
            px="$5"
            py="$2"
            gap="$3"
            alignItems="flex-start"
            minHeight={48}
          >
            {/* INDEX */}
            <SizableText
              size="$bodyMdMedium"
              color="$textDisabled"
              width={36}
              flexShrink={0}
              style={{ whiteSpace: 'nowrap' } as any}
            >
              {index + 1}.
            </SizableText>

            {/* FROM */}
            <YStack flex={1} flexBasis={0} minWidth={0} gap="$1">
              <SizableText
                size="$bodyMdMedium"
                style={{ wordBreak: 'break-all' }}
                color={hasFromError ? '$textCritical' : undefined}
              >
                {transfer.from}
              </SizableText>
              {!isOneToMany ? (
                <XStack gap="$1" alignItems="center">
                  <SizableText size="$bodySm" color="$textSubdued">
                    {intl.formatMessage({
                      id: ETranslations.wallet_bulk_send_balance,
                    })}
                  </SizableText>
                  {(() => {
                    if (
                      senderBalancesLoading &&
                      !senderBalances[transfer.from]
                    ) {
                      return <Skeleton.BodySm width="$16" />;
                    }
                    if (senderBalancesFailed.has(transfer.from)) {
                      return (
                        <XStack gap="$1" alignItems="center">
                          <Icon
                            name="XCircleOutline"
                            size="$3.5"
                            color="$iconCaution"
                          />
                          <SizableText size="$bodySm" color="$textCaution">
                            -
                          </SizableText>
                        </XStack>
                      );
                    }
                    return (
                      <NumberSizeableText
                        size="$bodySm"
                        color={
                          senderBalances[transfer.from] &&
                          displayAmount &&
                          new BigNumber(displayAmount).gt(
                            senderBalances[transfer.from],
                          )
                            ? '$textCritical'
                            : '$textSubdued'
                        }
                        formatter="balance"
                        formatterOptions={{
                          tokenSymbol: tokenInfo?.symbol,
                        }}
                      >
                        {senderBalances[transfer.from] ?? '-'}
                      </NumberSizeableText>
                    );
                  })()}
                </XStack>
              ) : null}
              {hasFromError ? (
                <XStack gap="$1" alignItems="center">
                  <Icon
                    name="InfoCircleOutline"
                    size="$4"
                    color="$iconCritical"
                  />
                  <SizableText size="$bodySm" color="$textCritical">
                    {errors.from}
                  </SizableText>
                </XStack>
              ) : null}
            </YStack>

            {/* TO */}
            <YStack flex={1} flexBasis={0} minWidth={0} gap="$1">
              <SizableText
                size="$bodyMdMedium"
                style={{ wordBreak: 'break-all' }}
                color={hasToError ? '$textCritical' : undefined}
              >
                {transfer.to}
              </SizableText>
              {hasToError ? (
                <XStack gap="$1" alignItems="center">
                  <Icon
                    name="InfoCircleOutline"
                    size="$4"
                    color="$iconCritical"
                  />
                  <SizableText size="$bodySm" color="$textCritical">
                    {errors.to}
                  </SizableText>
                </XStack>
              ) : null}
            </YStack>

            {/* AMOUNT */}
            <Stack width={100} alignItems="flex-end" flexWrap="wrap">
              {(() => {
                if (isCustomMode) {
                  return (
                    <Input
                      value={transfer.amount}
                      onChangeText={(value) => handleAmountChange(index, value)}
                      placeholder="0"
                      keyboardType="decimal-pad"
                      textAlign="right"
                      size="small"
                      error={hasAmountError}
                      leftAddOnProps={
                        hasAmountError
                          ? {
                              iconName: 'ErrorOutline',
                              iconColor: '$iconCritical',
                              tooltipProps: {
                                placement: 'top',
                                renderContent: errors?.amount,
                              },
                            }
                          : undefined
                      }
                      containerProps={{
                        width: '100%',
                        backgroundColor: '$bgSubdued',
                      }}
                    />
                  );
                }
                return (
                  <NumberSizeableText
                    size="$bodyMdMedium"
                    width="100%"
                    flex={1}
                    textAlign="right"
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    formatter="balance"
                  >
                    {displayAmount || '-'}
                  </NumberSizeableText>
                );
              })()}
            </Stack>

            {/* ACTION */}
            <Stack width={64} alignItems="flex-end">
              <IconButton
                icon="DeleteOutline"
                variant="tertiary"
                size="small"
                disabled={transfersInfo.length === 1}
                onPress={() => handleDeleteTransfer(index)}
              />
            </Stack>
          </XStack>
        );
      })}
    </YStack>
  );
}

function TableLayout() {
  const { bulkSendMode } = useBulkSendAmountsInputContext();
  const isOneToMany = bulkSendMode === EBulkSendMode.OneToMany;

  return (
    <YStack gap="$8">
      <XStack gap="$4">
        <AmountCard />
        {isOneToMany ? null : <IntervalCard />}
      </XStack>
      <TransferInfoListSection />
    </YStack>
  );
}

export default TableLayout;

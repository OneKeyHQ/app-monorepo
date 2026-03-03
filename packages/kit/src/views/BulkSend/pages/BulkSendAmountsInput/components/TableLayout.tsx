import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';
import { useDebouncedCallback } from 'use-debounce';

import {
  Button,
  Icon,
  IconButton,
  Input,
  NumberSizeableText,
  Select,
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
  type ITransferInfoErrors,
} from '@onekeyhq/shared/types/bulkSend';

import { filterNumericInput, validateRangeInput } from '../../../utils';

import { useBulkSendAmountsInputContext } from './Context';
import { useAmountPreview } from './useAmountPreview';
import { useTransferInfoActions } from './useTransferInfoActions';

function IntervalCard() {
  const intl = useIntl();
  return (
    <YStack
      flex={1}
      flexBasis={0}
      gap="$3"
      bg="$bgSubdued"
      borderRadius="$3"
      p="$5"
    >
      {/* Header: Title + Disabled Select */}
      <XStack alignItems="center" justifyContent="space-between">
        <SizableText size="$bodyLgMedium">
          {intl.formatMessage({
            id: ETranslations.wallet_bulk_send_interval_title,
          })}
        </SizableText>
        <Button
          variant="tertiary"
          size="small"
          iconAfter="ChevronDownSmallOutline"
          disabled
        >
          {intl.formatMessage({
            id: ETranslations.wallet_bulk_send_interval_none,
          })}
        </Button>
      </XStack>

      {/* Content */}
      <YStack flex={1} justifyContent="center" alignItems="center">
        <SizableText size="$bodyMd" color="$textSubdued" textAlign="center">
          {intl.formatMessage({
            id: ETranslations.wallet_bulk_send_interval_desc,
          })}
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
  } = useBulkSendAmountsInputContext();

  const [settings] = useSettingsPersistAtom();
  const { network } = useAccountData({ networkId });

  const balance = tokenDetails?.balanceParsed ?? '0';

  const { updateTransfersInfoWithAmounts } = useAmountPreview({
    tokenInfo,
    transfersInfo,
    setTransfersInfo,
    previewState,
    setPreviewState,
    balance: tokenDetails?.balanceParsed,
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
      updateTransfersInfoWithAmounts(value, amountInputValues);
      if (value === EAmountInputMode.Custom) {
        const errors: ITransferInfoErrors = {};
        transfersInfo.forEach((transfer, index) => {
          const { isValid, error } = validateTokenAmount({
            token: tokenInfo,
            amount: transfer.amount,
            allowZero: false,
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
      updateTransfersInfoWithAmounts,
      amountInputValues,
      transfersInfo,
      tokenInfo,
      setTransferInfoErrors,
    ],
  );

  // Handle specified amount change
  const handleSpecifiedAmountChange = useCallback(
    (value: string) => {
      if (!tokenInfo) return;
      const newValues = { ...amountInputValues, specifiedAmount: value };
      setAmountInputValues(newValues);

      const { error } = validateTokenAmount({
        token: tokenInfo,
        amount: new BigNumber(value || '0')
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
      amountInputErrors,
      setAmountInputErrors,
      updateTransfersInfoWithAmounts,
      amountInputMode,
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
        balance,
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
    if (amountInputMode === EAmountInputMode.Specified) {
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
      setAmountInputErrors({
        ...amountInputErrors,
        specifiedAmount: undefined,
      });
      updateTransfersInfoWithAmounts(amountInputMode, newValues);
    }
  }, [
    amountInputMode,
    balance,
    transfersInfo.length,
    tokenInfo,
    amountInputValues,
    setAmountInputValues,
    amountInputErrors,
    setAmountInputErrors,
    updateTransfersInfoWithAmounts,
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
  const sharedStyles = getSharedInputStyles({ error: hasRangeError });

  const renderAmountInput = () => {
    switch (amountInputMode) {
      case EAmountInputMode.Specified:
        return (
          <BaseAmountInput
            bg="$bgApp"
            value={amountInputValues.specifiedAmount}
            onChange={handleSpecifiedAmountChange}
            hasError={!!amountInputErrors.specifiedAmount}
            inputProps={{
              placeholder: '0',
            }}
            valueProps={{
              value: specifiedFiatValue,
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
      amountInputErrors.specifiedAmount ? (
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
        {amountInputMode === EAmountInputMode.Specified ? (
          <SizableText
            size="$bodySmMedium"
            color="$textInteractive"
            cursor="default"
            userSelect="none"
            onPress={handleMaxPress}
            hitSlop={8}
            hoverStyle={{ opacity: 0.75 }}
            pressStyle={{ opacity: 0.5 }}
          >
            {intl.formatMessage({ id: ETranslations.global_max })}
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
  } = useBulkSendAmountsInputContext();

  const { handleDeleteTransfer, handleAmountChange } = useTransferInfoActions({
    tokenInfo,
    transfersInfo,
    setTransfersInfo,
    transferInfoErrors,
    setTransferInfoErrors,
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
              {isCustomMode ? (
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
              ) : (
                <SizableText
                  size="$bodyMdMedium"
                  width="100%"
                  flex={1}
                  textAlign="right"
                >
                  {transfer.amount || '-'}
                </SizableText>
              )}
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
  return (
    <YStack gap="$8">
      <XStack gap="$4">
        <AmountCard />
        <IntervalCard />
      </XStack>
      <TransferInfoListSection />
    </YStack>
  );
}

export default TableLayout;

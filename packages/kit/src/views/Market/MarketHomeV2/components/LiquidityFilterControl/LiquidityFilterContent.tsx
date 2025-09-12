import { useCallback, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import type { IStackProps } from '@onekeyhq/components';
import {
  Button,
  Input,
  SizableText,
  Stack,
  XStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';

import { parseValueToNumber, validateLiquidityInput } from '../../utils';

type ILiquidityFilterContentProps = {
  value?: { min?: string; max?: string };
  onApply?: (value: { min?: string; max?: string }) => void;
  onClose?: () => void;
} & Omit<IStackProps, 'onChange'>;

const presetValues = ['10K', '50K', '100K', '500K'];

function LiquidityFilterContent({
  value: valueProp,
  onApply,
  onClose,
  ...rest
}: ILiquidityFilterContentProps) {
  // Determine selected preset based on current min value and preset values
  const selectedPreset = presetValues.includes(valueProp?.min || '')
    ? valueProp?.min
    : undefined;
  const [minValue, setMinValue] = useState<string | undefined>(valueProp?.min);
  const [maxValue, setMaxValue] = useState<string | undefined>(valueProp?.max);

  // Validated input handlers
  const handleMinValueChange = useCallback((value: string) => {
    if (validateLiquidityInput(value)) {
      setMinValue(value);
    }
  }, []);

  const handleMaxValueChange = useCallback((value: string) => {
    if (validateLiquidityInput(value)) {
      setMaxValue(value);
    }
  }, []);
  const intl = useIntl();

  // Validation logic for min > max
  const validationError = useMemo(() => {
    if (!minValue?.trim() || !maxValue?.trim()) {
      return null; // No error if either field is empty
    }

    try {
      const minNum = parseValueToNumber(minValue.trim());
      const maxNum = parseValueToNumber(maxValue.trim());

      if (minNum > maxNum) {
        return intl.formatMessage(
          {
            id: ETranslations.form_must_greater_then_value,
          },
          { value: minValue.trim() },
        );
      }
    } catch {
      // If parsing fails, don't show validation error
      return null;
    }

    return null;
  }, [minValue, maxValue, intl]);

  useEffect(() => {
    setMinValue(valueProp?.min);
    setMaxValue(valueProp?.max);
  }, [valueProp]);

  const handlePresetPress = useCallback(
    (preset: string) => {
      // Apply preset values immediately without updating local state
      // to avoid state inconsistency during rapid closure
      // If preset value is greater than 1t, set to 1t (minimum value cannot exceed 1t)
      const presetNum = parseValueToNumber(preset);
      const maximumMinValue = 1_000_000_000_000; // 1 trillion

      let finalPreset = preset;
      if (presetNum > maximumMinValue) {
        finalPreset = String(
          numberFormat(String(maximumMinValue), { formatter: 'marketCap' }),
        );
      }

      onApply?.({ min: finalPreset, max: undefined });
      onClose?.();
    },
    [onApply, onClose],
  );

  const handleApply = useCallback(() => {
    // Don't apply if there's a validation error
    if (validationError) {
      return;
    }

    // Convert minValue and maxValue to k/m units if they are numeric
    let convertedMin = minValue;
    let convertedMax = maxValue;

    if (minValue?.trim()) {
      try {
        const minNum = parseValueToNumber(minValue.trim());
        // Enforce maximum minimum value of 1t (minimum value cannot exceed 1t)
        const finalMinNum = Math.min(minNum, 1_000_000_000_000);
        convertedMin = String(
          numberFormat(String(finalMinNum), { formatter: 'marketCap' }),
        );
      } catch (error) {
        // Keep original value if parsing fails
        convertedMin = minValue;
      }
    }

    if (maxValue?.trim()) {
      try {
        const maxNum = parseValueToNumber(maxValue.trim());
        // No restriction on maximum value
        convertedMax = String(
          numberFormat(String(maxNum), { formatter: 'marketCap' }),
        );
      } catch (error) {
        // Keep original value if parsing fails
        convertedMax = maxValue;
      }
    }

    onApply?.({ min: convertedMin, max: convertedMax });
    onClose?.();
  }, [minValue, maxValue, onApply, onClose, validationError]);

  const handleClear = useCallback(() => {
    // Clear values immediately without updating local state
    // to avoid state inconsistency during rapid closure
    onApply?.({ min: undefined, max: undefined });
    onClose?.();
  }, [onApply, onClose]);

  const renderPresetRow = (startIndex: number, endIndex: number) => (
    <XStack gap="$3">
      {presetValues.slice(startIndex, endIndex).map((preset) => (
        <Button
          flex={1}
          key={preset}
          variant="secondary"
          borderColor={
            selectedPreset === preset ? '$borderNeutralDefault' : '$transparent'
          }
          borderWidth={StyleSheet.hairlineWidth}
          onPress={() => handlePresetPress(preset)}
        >
          ≥ {preset}
        </Button>
      ))}
    </XStack>
  );

  return (
    <Stack gap="$4" p="$4" {...rest}>
      <Stack gap="$2">
        {renderPresetRow(0, 2)}
        {renderPresetRow(2, 4)}
        <XStack gap="$2">
          <Stack flex={1} gap="$2">
            <Input
              placeholder={intl.formatMessage({
                id: ETranslations.dexmarket_custom_filters_min,
              })}
              value={minValue}
              onChangeText={handleMinValueChange}
            />
          </Stack>
          <Stack flex={1} gap="$2">
            <Input
              placeholder={intl.formatMessage({
                id: ETranslations.dexmarket_custom_filters_max,
              })}
              value={maxValue}
              onChangeText={handleMaxValueChange}
            />
          </Stack>
        </XStack>
        {validationError ? (
          <SizableText size="$bodyMd" color="$textCritical">
            {validationError}
          </SizableText>
        ) : null}
      </Stack>

      <Stack gap="$6">
        <XStack gap="$2">
          <Button variant="secondary" flex={1} onPress={handleClear}>
            {intl.formatMessage({ id: ETranslations.global_clear })}
          </Button>
          <Button
            variant="primary"
            flex={1}
            onPress={handleApply}
            disabled={!!validationError}
          >
            {intl.formatMessage({
              id: ETranslations.dexmarket_custom_filters_apply,
            })}
          </Button>
        </XStack>
      </Stack>
    </Stack>
  );
}

export { LiquidityFilterContent };

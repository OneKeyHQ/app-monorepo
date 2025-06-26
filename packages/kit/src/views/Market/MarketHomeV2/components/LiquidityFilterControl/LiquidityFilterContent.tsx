import { useCallback, useEffect, useState } from 'react';

import { useIntl } from 'react-intl';

import type { IStackProps } from '@onekeyhq/components';
import { Button, Heading, Input, Stack, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

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
  const intl = useIntl();

  useEffect(() => {
    setMinValue(valueProp?.min);
    setMaxValue(valueProp?.max);
  }, [valueProp]);

  const handlePresetPress = useCallback(
    (preset: string) => {
      // Apply preset values immediately without updating local state
      // to avoid state inconsistency during rapid closure
      onApply?.({ min: preset, max: undefined });
      onClose?.();
    },
    [onApply, onClose],
  );

  const handleApply = useCallback(() => {
    onApply?.({ min: minValue, max: maxValue });
    onClose?.();
  }, [minValue, maxValue, onApply, onClose]);

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
          variant={selectedPreset === preset ? 'primary' : 'secondary'}
          onPress={() => handlePresetPress(preset)}
        >
          ≥ {preset}
        </Button>
      ))}
    </XStack>
  );

  return (
    <Stack gap="$4" p="$4" minWidth={280} {...rest}>
      <Stack gap="$3">
        {renderPresetRow(0, 2)}
        {renderPresetRow(2, 4)}
      </Stack>

      <Stack gap="$3">
        <XStack gap="$3">
          <Stack flex={1} gap="$2">
            <Heading size="$headingSm">
              {intl.formatMessage({
                id: ETranslations.dexmarket_custom_fliters_min,
              })}
            </Heading>
            <Input
              placeholder={intl.formatMessage({
                id: ETranslations.dexmarket_custom_fliters_min,
              })}
              value={minValue}
              onChangeText={setMinValue}
            />
          </Stack>
          <Stack flex={1} gap="$2">
            <Heading size="$headingSm">
              {intl.formatMessage({
                id: ETranslations.dexmarket_custom_fliters_max,
              })}
            </Heading>
            <Input
              placeholder={intl.formatMessage({
                id: ETranslations.dexmarket_custom_fliters_max,
              })}
              value={maxValue}
              onChangeText={setMaxValue}
            />
          </Stack>
        </XStack>

        <XStack gap="$3">
          <Button variant="secondary" flex={1} onPress={handleClear}>
            {intl.formatMessage({ id: ETranslations.global_clear })}
          </Button>
          <Button variant="primary" flex={1} onPress={handleApply}>
            {intl.formatMessage({
              id: ETranslations.dexmarket_custom_fliters_apply,
            })}
          </Button>
        </XStack>
      </Stack>
    </Stack>
  );
}

export { LiquidityFilterContent };

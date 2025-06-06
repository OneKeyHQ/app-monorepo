import { useEffect, useState } from 'react';

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
  const [selectedPreset, setSelectedPreset] = useState<string | undefined>(
    valueProp?.min,
  );
  const [minValue, setMinValue] = useState<string | undefined>(valueProp?.min);
  const [maxValue, setMaxValue] = useState<string | undefined>(valueProp?.max);
  const intl = useIntl();

  useEffect(() => {
    setSelectedPreset(valueProp?.min);
    setMinValue(valueProp?.min);
    setMaxValue(valueProp?.max);
  }, [valueProp]);

  const handlePresetPress = (preset: string) => {
    setSelectedPreset(preset);
    setMinValue(preset);
    setMaxValue(undefined);
    // Directly apply preset values and close popover
    onApply?.({ min: preset, max: undefined });
    onClose?.();
  };

  const handleApply = () => {
    onApply?.({ min: minValue, max: maxValue });
    onClose?.();
  };

  const handleClear = () => {
    setSelectedPreset(undefined);
    setMinValue(undefined);
    setMaxValue(undefined);
    // Directly apply reset and close popover
    onApply?.({ min: undefined, max: undefined });
    onClose?.();
  };

  const liquidityText = intl.formatMessage({
    id: ETranslations.global_liquidity,
  });

  return (
    <Stack gap="$4" p="$4" minWidth={280} {...rest}>
      <Stack gap="$3">
        <Heading size="$headingMd">{liquidityText} ($)</Heading>

        <XStack gap="$2" flexWrap="wrap">
          {presetValues.map((preset) => (
            <Button
              key={preset}
              variant={selectedPreset === preset ? 'primary' : 'secondary'}
              size="small"
              onPress={() => handlePresetPress(preset)}
            >
              ≥ {preset}
            </Button>
          ))}
        </XStack>
      </Stack>

      <Stack gap="$3">
        <XStack gap="$3">
          <Stack flex={1} gap="$2">
            <Heading size="$headingSm">Min</Heading>
            <Input
              placeholder="0"
              value={minValue}
              onChangeText={setMinValue}
            />
          </Stack>
          <Stack flex={1} gap="$2">
            <Heading size="$headingSm">Max</Heading>
            <Input
              placeholder="∞"
              value={maxValue}
              onChangeText={setMaxValue}
            />
          </Stack>
        </XStack>

        <XStack gap="$3">
          <Button variant="secondary" flex={1} onPress={handleClear}>
            Clear
          </Button>
          <Button variant="primary" flex={1} onPress={handleApply}>
            Apply
          </Button>
        </XStack>
      </Stack>
    </Stack>
  );
}

export { LiquidityFilterContent };

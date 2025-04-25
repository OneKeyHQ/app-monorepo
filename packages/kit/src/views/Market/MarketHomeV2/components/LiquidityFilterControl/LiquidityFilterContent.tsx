import { useState } from 'react';

import type { IStackProps } from '@onekeyhq/components';
import {
  Button,
  Heading,
  Input,
  Stack,
  XStack,
  useMedia,
} from '@onekeyhq/components';

type ILiquidityFilterContentProps = {
  value?: { min?: string; max?: string };
  onChange?: (value: { min?: string; max?: string }) => void;
  onApply?: (value: { min?: string; max?: string }) => void;
  onClose?: () => void; // Add onClose prop to close the popover
} & Omit<IStackProps, 'onChange'>; // Omit onChange from StackProps to avoid conflict

const presetValues = ['10K', '50K', '100K', '500K'];

function LiquidityFilterContent({
  value: valueProp,
  onChange,
  onApply,
  onClose,
  ...rest
}: ILiquidityFilterContentProps) {
  const { gtMd } = useMedia();
  const [minValue, setMinValue] = useState<string | undefined>(valueProp?.min);
  const [maxValue, setMaxValue] = useState<string | undefined>(valueProp?.max);
  const [selectedPreset, setSelectedPreset] = useState<string | undefined>(() =>
    presetValues.find((p) => minValue === p && maxValue === undefined),
  );

  const handlePresetPress = (preset: string) => {
    setSelectedPreset(preset);
    setMinValue(preset);
    setMaxValue(undefined);
    onChange?.({ min: preset, max: undefined });
  };

  const handleMinChange = (text: string) => {
    setSelectedPreset(undefined);
    setMinValue(text);
    onChange?.({ min: text, max: maxValue });
  };

  const handleMaxChange = (text: string) => {
    setSelectedPreset(undefined);
    setMaxValue(text);
    onChange?.({ min: minValue, max: text });
  };

  const handleApply = () => {
    onApply?.({ min: minValue, max: maxValue });
    onClose?.(); // Close popover on apply
  };

  const handleReset = () => {
    setSelectedPreset(undefined);
    setMinValue(undefined);
    setMaxValue(undefined);
    onChange?.({ min: undefined, max: undefined });
    // Optionally apply reset immediately or wait for Apply button
    // onApply?.({ min: undefined, max: undefined });
    // onClose?.();
  };

  return (
    <Stack width="$64" gap="$4" {...rest} padding="$4" borderRadius="$3">
      {/* Removed bgSurface, Popover will handle background */}
      <Heading size="$headingSm" color="$textSubdued">
        Liquidity ($)
      </Heading>
      <Stack gap="$2.5">
        <XStack gap="$2.5">
          {presetValues.slice(0, 2).map((preset) => (
            <Button
              key={preset}
              size="small"
              variant={selectedPreset === preset ? 'primary' : 'secondary'}
              onPress={() => handlePresetPress(preset)}
              flex={1}
            >
              ≥ {preset}
            </Button>
          ))}
        </XStack>
        <XStack gap="$2.5">
          {presetValues.slice(2, 4).map((preset) => (
            <Button
              key={preset}
              size="small"
              variant={selectedPreset === preset ? 'primary' : 'secondary'}
              onPress={() => handlePresetPress(preset)}
              flex={1}
            >
              ≥ {preset}
            </Button>
          ))}
        </XStack>
      </Stack>
      <XStack gap="$2.5">
        <Stack flex={1}>
          <Input
            // Clear input if a preset is selected for better UX
            value={minValue === selectedPreset ? '' : minValue ?? ''}
            placeholder="Min"
            onChangeText={handleMinChange}
            size="small"
          />
        </Stack>
        <Stack flex={1}>
          <Input
            value={maxValue ?? ''} // Ensure value is not undefined
            placeholder="Max"
            onChangeText={handleMaxChange}
            size="small"
          />
        </Stack>
      </XStack>
      <XStack gap="$2.5" alignItems="center">
        <Button
          size="small"
          icon="RepeatOutline"
          variant="tertiary"
          onPress={handleReset}
          $gtMd={{ display: 'none' }}
        />
        <Button
          iconAfter="RepeatOutline"
          variant="tertiary"
          onPress={handleReset}
          display="none"
          size="small"
          $gtMd={{ display: 'flex' }}
        >
          Reset
        </Button>
        <Button
          variant="primary"
          onPress={handleApply}
          size={gtMd ? 'medium' : 'small'}
          flex={1}
        >
          Apply
        </Button>
      </XStack>
    </Stack>
  );
}

export { LiquidityFilterContent };

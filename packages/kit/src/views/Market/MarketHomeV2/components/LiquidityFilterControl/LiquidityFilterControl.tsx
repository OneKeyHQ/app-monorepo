import { useState } from 'react';

import type { IStackProps } from '@onekeyhq/components';
import { Button, Heading, Input, Stack, useMedia } from '@onekeyhq/components';

type ILiquidityFilterControlProps = {
  value?: { min?: string; max?: string };
  onChange?: (value: { min?: string; max?: string }) => void;
  onApply?: (value: { min?: string; max?: string }) => void;
} & IStackProps;

const presetValues = ['10K', '50K', '100K', '500K'];

function LiquidityFilterControl({
  value: valueProp,
  onChange,
  onApply,
  ...rest
}: ILiquidityFilterControlProps) {
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
  };

  const handleReset = () => {
    setSelectedPreset(undefined);
    setMinValue(undefined);
    setMaxValue(undefined);
    onChange?.({ min: undefined, max: undefined });
  };

  return (
    <Stack gap="$4" {...rest} padding="$4" borderRadius="$3" bg="$bgSurface">
      <Heading size="$headingSm">Liquidity ($)</Heading>
      <Stack gap="$2.5">
        <Stack flexDirection="row" gap="$2.5">
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
        </Stack>
        <Stack flexDirection="row" gap="$2.5">
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
        </Stack>
      </Stack>
      <Stack flexDirection="row" gap="$2.5">
        <Input
          value={minValue === selectedPreset ? '' : minValue}
          placeholder="Min"
          onChangeText={handleMinChange}
          size="small"
          $gtMd={{ size: 'medium' }}
          flex={1}
        />
        <Input
          value={maxValue}
          placeholder="Max"
          onChangeText={handleMaxChange}
          size="small"
          $gtMd={{ size: 'medium' }}
          flex={1}
        />
      </Stack>
      <Stack flexDirection="row" gap="$2.5" alignItems="center">
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
      </Stack>
    </Stack>
  );
}

export { LiquidityFilterControl };

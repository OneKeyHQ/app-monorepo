import type { PropsWithChildren } from 'react';

import { Label, RadioGroup } from 'tamagui';

import { XStack } from '../Stack';

export type RadioProps = PropsWithChildren<{
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  options: { label: string; value: string }[];
}>;

export function Radio({ value, onChange, disabled, options }: RadioProps) {
  return (
    <RadioGroup
      value={value}
      onValueChange={onChange}
      disabled={disabled}
      space="$2"
    >
      {options.map(({ label, value: v }) => (
        <XStack width={300} alignItems="center" space="$4">
          <RadioGroup.Item value={v} id={v}>
            <RadioGroup.Indicator />
          </RadioGroup.Item>

          <Label htmlFor={v}>{label}</Label>
        </XStack>
      ))}
    </RadioGroup>
  );
}

import { RadioGroup } from 'tamagui';

import { Label, XStack } from '../../primitives';

import type { IFormFieldProps } from '../types';

export type IRadioProps = IFormFieldProps<
  string,
  {
    disabled?: boolean;
    options: { label: string; value: string }[];
  }
>;

export function Radio({ value, onChange, disabled, options }: IRadioProps) {
  return (
    <RadioGroup value={value} onValueChange={onChange} disabled={disabled}>
      {options.map(({ label, value: v }, index) => (
        <XStack alignItems="center" py="$2" key={index}>
          <RadioGroup.Item
            value={v}
            id={v}
            unstyled
            alignItems="center"
            justifyContent="center"
            my="$0.5"
            w="$5"
            h="$5"
            borderWidth="$0.5"
            borderColor={value === v ? '$transparent' : '$borderStrong'}
            backgroundColor={value === v ? '$bgPrimary' : '$transparent'}
            borderRadius="$full"
            focusStyle={{
              outlineOffset: 2,
              outlineColor: '$focusRing',
            }}
            $platform-native={{
              hitSlop: { top: 8, left: 8, right: 8, bottom: 8 },
            }}
          >
            <RadioGroup.Indicator
              unstyled
              w="$2.5"
              h="$2.5"
              bg="$iconInverse"
              borderRadius="$full"
            />
          </RadioGroup.Item>
          <Label htmlFor={v} variant="$bodyLgMedium" pl="$2" py="$2" my="$-2">
            {label}
          </Label>
        </XStack>
      ))}
    </RadioGroup>
  );
}

import { RadioGroup } from 'tamagui';

import { Label, SizableText, XStack, YStack } from '../../primitives';
import { NATIVE_HIT_SLOP } from '../../utils';

import type { IFormFieldProps } from '../types';

export type IRadioProps = IFormFieldProps<
  string,
  {
    disabled?: boolean;
    options: { label: string; description?: string; value: string }[];
  }
>;

export function Radio({ value, onChange, disabled, options }: IRadioProps) {
  return (
    <RadioGroup value={value} onValueChange={onChange} disabled={disabled}>
      {options.map(({ label, description, value: v }, index) => (
        <XStack py="$2" key={index}>
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
            focusVisibleStyle={{
              outlineOffset: 2,
              outlineColor: '$focusRing',
            }}
            hitSlop={NATIVE_HIT_SLOP}
          >
            <RadioGroup.Indicator
              unstyled
              w="$2.5"
              h="$2.5"
              bg="$iconInverse"
              borderRadius="$full"
            />
          </RadioGroup.Item>
          <YStack gap="$1" pl="$2" py="$2" my="$-2" flex={1}>
            <Label htmlFor={v} variant="$bodyLgMedium">
              {label}
            </Label>
            <SizableText size="$bodyMd" color="$textSubdued">
              {description}
            </SizableText>
          </YStack>
        </XStack>
      ))}
    </RadioGroup>
  );
}

import { useMemo } from 'react';

import { Checkbox as TMCheckbox } from 'tamagui';

import { Icon } from '../Icon';
import { Label } from '../Label';
import { XStack } from '../Stack';

import type { CheckedState, CheckboxProps as TMCheckboxProps } from 'tamagui';

export type CheckboxProps = Omit<
  TMCheckboxProps,
  'size' | 'onCheckedChange' | 'checked'
> & {
  label?: string;
  value?: CheckedState;
  onChange?: (checked: CheckedState) => void;
};

export function Checkbox({
  label,
  onChange,
  value,
  ...checkboxProps
}: CheckboxProps) {
  const id = useMemo(() => Math.random().toString(), []);

  const Indicator = useMemo(() => {
    if (value) {
      return (
        <Icon
          name={
            value === 'indeterminate'
              ? 'CheckboxIndeterminateCustom'
              : 'CheckboxCheckedCustom'
          }
          color="$iconInverse"
          size="$4"
        />
      );
    }
    return null;
  }, [value]);

  return (
    <XStack
      alignItems="center"
      py="$2"
      opacity={checkboxProps.disabled ? 0.5 : 1}
    >
      <TMCheckbox
        id={id}
        checked={value}
        onCheckedChange={onChange}
        unstyled
        p="$0"
        my="$0.5"
        bg={value ? '$bgPrimary' : 'transparent'}
        borderWidth="$0.5"
        borderColor={value ? '$transparent' : '$borderStrong'}
        borderRadius="$1"
        alignItems="center"
        justifyContent="center"
        focusStyle={{
          outlineColor: '$borderActive',
        }}
        $platform-native={{
          hitSlop: 8,
        }}
        {...checkboxProps}
      >
        {Indicator}
      </TMCheckbox>
      {label && (
        <Label htmlFor={id} variant="$bodyLgMedium" pl="$2" py="$2" my="$-1.5">
          {label}
        </Label>
      )}
    </XStack>
  );
}

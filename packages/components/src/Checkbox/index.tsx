import { useMemo } from 'react';

import { Label, Checkbox as TMCheckbox } from 'tamagui';

import { Icon } from '../Icon';
import { Stack, XStack } from '../Stack';

import type { CheckboxProps, CheckedState, SizeTokens } from 'tamagui';

function CheckboxWithLabel({
  size = '$6',
  label = 'Accept terms and conditions',
  style,
  onChange,
  value,
  ...checkboxProps
}: Omit<CheckboxProps, 'size' | 'onCheckedChange' | 'checked'> & {
  size?: SizeTokens;
  label?: string;
  value?: CheckedState;
  onChange?: (checked: CheckedState) => void;
}) {
  const id = useMemo(() => Math.random().toString(), []);
  return (
    <XStack width="$80" alignItems="center" space="$4" style={style}>
      <TMCheckbox
        {...checkboxProps}
        size={size}
        id={id}
        checked={value}
        onCheckedChange={onChange}
      >
        <Stack bg="$background">
          {value ? (
            <Icon name="CheckboxOutline" size={size} color="$borderActive" />
          ) : (
            <Stack
              bg="transparent"
              h="$4"
              w="$4"
              borderColor="$borderActive"
              bw={1}
            />
          )}
        </Stack>
      </TMCheckbox>
      <Label size={size} htmlFor={id} ml={-10}>
        {label}
      </Label>
    </XStack>
  );
}

export const Checkbox = CheckboxWithLabel;

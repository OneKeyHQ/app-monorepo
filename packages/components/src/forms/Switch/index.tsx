import { useState } from 'react';

import { Switch as TMSwitch, useTheme } from 'tamagui';

import type { IFormFieldProps } from '../types';
import type { GetProps } from 'tamagui';

export enum ESwitchSize {
  'small' = 'small',
  'large' = 'large',
}

export type ISwitchProps = IFormFieldProps<
  boolean,
  Omit<GetProps<typeof TMSwitch>, 'checked' | 'onCheckedChange' | 'value'> & {
    size?: 'small' | 'large';
  }
> & {
  isUncontrolled?: boolean;
};

export function Switch({
  value,
  defaultChecked,
  onChange,
  size = 'large',
  disabled,
  isUncontrolled,
  ...restProps
}: ISwitchProps) {
  const theme = useTheme();
  const [stateChecked, setStateChecked] = useState(defaultChecked);

  const checked = isUncontrolled ? stateChecked : value;

  return (
    <TMSwitch
      tag="span"
      unstyled
      checked={checked}
      defaultChecked={defaultChecked}
      onCheckedChange={(v) => {
        if (isUncontrolled) {
          setStateChecked(v);
        }
        onChange?.(v);
      }}
      native
      w={size === 'small' ? 38 : 54}
      h={size === 'small' ? '$6' : '$8'}
      minHeight={size === 'small' ? '$6' : '$8'}
      bg={checked ? '$bgPrimary' : '$neutral5'}
      p="$0"
      borderRadius="$full"
      borderWidth="$0.5"
      borderColor="$transparent"
      opacity={disabled ? 0.5 : 1}
      disabled={disabled}
      nativeProps={{
        disabled,
        ios_backgroundColor: theme.neutral5.val,
        trackColor: {
          false: theme.neutral5.val,
          true: theme.bgPrimary.val,
        },
        thumbColor: theme.bg.val,
      }}
      {...restProps}
    >
      <TMSwitch.Thumb
        unstyled
        w={size === 'small' ? '$5' : '$7'}
        h={size === 'small' ? '$5' : '$7'}
        borderRadius="$full"
        bg="$bg"
        animation="quick"
      />
    </TMSwitch>
  );
}

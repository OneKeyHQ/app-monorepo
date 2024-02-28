import { Switch as TMSwitch, useTheme } from 'tamagui';

import type { IFormFieldProps } from '../types';
import type { GetProps } from 'tamagui';

export type ISwitchProps = IFormFieldProps<
  boolean,
  Omit<GetProps<typeof TMSwitch>, 'checked' | 'onCheckedChange' | 'value'> & {
    size?: 'small' | 'large';
  }
>;

export function Switch({
  value,
  onChange,
  size = 'large',
  disabled,
  ...restProps
}: ISwitchProps) {
  const theme = useTheme();

  return (
    <TMSwitch
      unstyled
      checked={value}
      onCheckedChange={onChange}
      native
      w={size === 'small' ? 38 : 54}
      h={size === 'small' ? '$6' : '$8'}
      minHeight={size === 'small' ? '$6' : '$8'}
      bg={value ? '$bgPrimary' : '$neutral5'}
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
        bg="$bg"
        animation="quick"
      />
    </TMSwitch>
  );
}

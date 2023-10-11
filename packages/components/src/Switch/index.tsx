import { Stack, Switch as TMSwitch } from 'tamagui';

import type { GetProps } from 'tamagui';

export type SwitchProps = Omit<
  GetProps<typeof TMSwitch>,
  'checked' | 'onCheckedChange' | 'value'
> & {
  value?: boolean;
  onChange?: (checked: boolean) => void;
};

export function Switch({ value, onChange, ...restProps }: SwitchProps) {
  return (
    <TMSwitch
      borderColor="$bgInverse"
      checked={value}
      onCheckedChange={onChange}
      {...restProps}
      native
    >
      <TMSwitch.Thumb
        ml={-6}
        mt={-1}
        backgroundColor="$bgInverse"
        animation="bouncy"
      />
    </TMSwitch>
  );
}

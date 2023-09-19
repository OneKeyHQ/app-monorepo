import type { ComponentProps, FC } from 'react';

import Switch from '../Switch';

type FormSwitchProps = {
  onChange?: (isChecked?: boolean) => void;
};

export const FormSwitch: FC<
  Omit<ComponentProps<typeof Switch>, 'onChange'> & FormSwitchProps
> = ({ value, onChange, ...props }) => (
  <Switch
    {...props}
    isChecked={value}
    onToggle={() => {
      if (onChange) {
        onChange(!value);
      }
    }}
  />
);

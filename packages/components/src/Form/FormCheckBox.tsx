import type { ComponentProps, FC } from 'react';

import CheckBox from '../CheckBox';

type FormCheckBoxProps = {
  value?: boolean;
};

export const FormCheckBox: FC<
  Omit<ComponentProps<typeof CheckBox>, 'value'> & FormCheckBoxProps
> = ({ value, ...props }) => <CheckBox isChecked={value} {...props} />;

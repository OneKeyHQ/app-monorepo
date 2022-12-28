import type { ComponentProps, FC } from 'react';

import NumberInput from '../NumberInput';

type FormInputProps = ComponentProps<typeof NumberInput>;

export const FormNumberInput: FC<FormInputProps> = (props) => (
  <NumberInput w="full" {...props} />
);

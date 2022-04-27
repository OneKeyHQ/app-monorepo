import React, { ComponentProps, FC } from 'react';

import { NumberInput } from '../NumberInput';

type FormInputProps = {
  onChange?: (text: string) => void;
};

export const FormNumberInput: FC<
  FormInputProps & ComponentProps<typeof NumberInput>
> = ({ onChange, ...props }) => (
  <NumberInput w="full" {...props} onChangeText={onChange} />
);

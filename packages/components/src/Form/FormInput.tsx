import type { ComponentProps, FC } from 'react';

import Input from '../Input';

type FormInputProps = {
  onChange?: (text: string) => void;
};

export const FormInput: FC<FormInputProps & ComponentProps<typeof Input>> = ({
  onChange,
  ...props
}) => <Input w="full" {...props} onChangeText={onChange} />;

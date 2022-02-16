import React, { ComponentProps, FC, useState } from 'react';

import Input from '../Input';

type FormInputProps = {
  onChange?: (text: string) => void;
};

export const FormPasswordInput: FC<
  FormInputProps & ComponentProps<typeof Input>
> = ({ onChange, ...props }) => {
  const [show, setShow] = useState(false);
  const rightIconName = show ? 'EyeOutline' : 'EyeOffOutline';
  return (
    <Input
      w="full"
      type={show ? 'text' : 'password'}
      rightIconName={rightIconName}
      onPressRightIcon={() => setShow((prev) => !prev)}
      onChangeText={onChange}
      {...props}
    />
  );
};

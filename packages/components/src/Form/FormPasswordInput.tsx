import React, { ComponentProps, FC, useState } from 'react';

import IconButton from '../IconButton';
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
      onChangeText={onChange}
      size="xl"
      rightCustomElement={
        <IconButton
          onPress={() => setShow((prev) => !prev)}
          name={rightIconName}
          size="xl"
          type="plain"
        />
      }
      {...props}
    />
  );
};

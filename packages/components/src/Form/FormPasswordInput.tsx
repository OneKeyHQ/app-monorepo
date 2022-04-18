import React, { ComponentProps, FC, useState } from 'react';

import { Platform } from 'react-native';

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
      keyboardType={Platform.OS === 'ios' ? 'ascii-capable' : undefined}
      size="xl"
      rightCustomElement={
        <IconButton
          onPress={() => setShow((prev) => !prev)}
          name={rightIconName}
          size="xl"
          type="plain"
          focusable={false}
        />
      }
      {...props}
    />
  );
};

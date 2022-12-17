import type { ComponentProps } from 'react';
import { forwardRef, useState } from 'react';

import { Platform } from 'react-native';

import IconButton from '../IconButton';
import Input from '../Input';

type FormInputProps = {
  onChange?: (text: string) => void;
};

const FormPasswordInput = forwardRef<
  typeof Input,
  FormInputProps & ComponentProps<typeof Input>
>(({ onChange, ...props }, ref) => {
  const [show, setShow] = useState(false);
  const rightIconName = show ? 'EyeOutline' : 'EyeSlashOutline';
  return (
    <Input
      w="full"
      // @ts-expect-error
      ref={ref}
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
});

FormPasswordInput.displayName = 'FormPasswordInput';

export { FormPasswordInput };

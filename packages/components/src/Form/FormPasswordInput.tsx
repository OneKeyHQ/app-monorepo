import React, { ComponentProps, FC, useState } from 'react';

import Input from '../Input';

export const FormPasswordInput: FC<ComponentProps<typeof Input>> = (props) => {
  const [show, setShow] = useState(false);
  const rightIconName = show ? 'EyeOutline' : 'EyeOffOutline';
  return (
    <Input
      w="full"
      type={show ? 'text' : 'password'}
      rightIconName={rightIconName}
      onPressRightIcon={() => setShow((prev) => !prev)}
      {...props}
    />
  );
};

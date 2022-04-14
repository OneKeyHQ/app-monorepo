/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import React, { ComponentProps, FC } from 'react';

import BigNumber from 'bignumber.js';

import Input from '../Input';

type NumberInputProps = {
  decimal?: number;
  onChange?: (text: string) => void;
};

export const NumberInput: FC<
  NumberInputProps & ComponentProps<typeof Input>
> = ({ decimal, onChange, ...props }) => {
  const { value, onBlur } = props;

  const handleChange = (e: any) => {
    const text = e.target.value as string;
    let result = text;
    result = text.replace(/^\D*(\d*(?:\.\d*)?).*$/g, '$1');

    // limit max decimal
    if (decimal && decimal > 0) {
      const position = text.indexOf('.');
      if (position !== -1 && text.length - 1 - position > decimal) {
        result = text.substring(0, position + decimal + 1);
      }
    }
    if (onChange) {
      onChange(result);
    }
  };

  const handleBlur = (e: any) => {
    const text: string = e.target.value;
    if (text.startsWith('.') || text.endsWith('.')) {
      const b = new BigNumber(e.target.value);

      if (onChange) {
        onChange(b.toString());
      }
      e.target.value = b.toString();
    }

    if (onBlur) {
      onBlur(e);
    }
  };
  return (
    <Input
      w="full"
      value={value}
      {...props}
      onChange={handleChange}
      onBlur={handleBlur}
    />
  );
};

export default NumberInput;

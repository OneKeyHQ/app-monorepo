/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import React, { ComponentProps, FC, useState } from 'react';

import BigNumber from 'bignumber.js';

import Input from '../Input';

type NumberInputProps = {
  decimal?: number;
  onChange?: (text: string) => void;
  onChangeText?: (text: string) => void;
};

export const NumberInput: FC<
  NumberInputProps & ComponentProps<typeof Input>
> = ({ decimal, onChange, ...props }) => {
  const { onBlur, onChangeText } = props;

  const [v, setV] = useState('');

  const handleChange = (text: string) => {
    let result = text;

    if (text) {
      result = text.replace(/^\D*(\d*(?:\.\d*)?).*$/g, '$1');

      // limit max decimal
      if (decimal && decimal > 0) {
        const position = text.indexOf('.');
        if (position !== -1 && text.length - 1 - position > decimal) {
          result = text.substring(0, position + decimal + 1);
        }
      }
    }
    if (onChange) {
      onChange(result);
    }
    if (onChangeText) {
      onChangeText(result);
    }
    setV(result);
  };

  const handleBlur = (e: any) => {
    const text = v;

    if (text) {
      if (text.startsWith('.') || text.endsWith('.')) {
        const b = new BigNumber(text);

        if (onChange) {
          onChange(b.toString());
        }
        setV(b.toString());
      }
    }

    if (onBlur) {
      onBlur(e);
    }
  };
  return (
    <Input
      w="full"
      {...props}
      onChangeText={handleChange}
      onBlur={handleBlur}
    />
  );
};

export default NumberInput;

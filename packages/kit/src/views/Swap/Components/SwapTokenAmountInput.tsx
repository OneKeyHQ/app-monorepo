import { memo } from 'react';

import { Input } from '@onekeyhq/components';

import { validateInput } from '../utils/utils';

interface ISwapTokenAmountInputProps {
  onInputChange?: (text: string) => void;
  inputValue?: string;
  disabled?: boolean;
}

const SwapTokenAmountInput = ({
  onInputChange,
  inputValue,
  disabled,
}: ISwapTokenAmountInputProps) => {
  console.log('SwapInput');
  return (
    <Input
      value={inputValue}
      disabled={disabled}
      onChangeText={(text) => {
        if (validateInput(text)) {
          onInputChange?.(text);
        }
      }}
    />
  );
};

export default memo(SwapTokenAmountInput);

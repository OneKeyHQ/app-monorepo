import { memo } from 'react';

import { Input, Skeleton } from '@onekeyhq/components';

import { validateInput } from '../utils/utils';

interface ISwapTokenAmountInputProps {
  onInputChange?: (text: string) => void;
  inputValue?: string;
  disabled?: boolean;
  loading?: boolean;
}

const SwapTokenAmountInput = ({
  onInputChange,
  inputValue,
  disabled,
  loading,
}: ISwapTokenAmountInputProps) => {
  console.log('SwapInput');
  return loading ? (
    <Skeleton w="$50" h="$10" />
  ) : (
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

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
}: ISwapTokenAmountInputProps) =>
  loading ? (
    <Skeleton w="$20" h="$10" />
  ) : (
    <Input
      value={inputValue}
      disabled={disabled}
      placeholder="0.0"
      onChangeText={(text) => {
        if (validateInput(text)) {
          onInputChange?.(text);
        }
      }}
    />
  );

export default memo(SwapTokenAmountInput);

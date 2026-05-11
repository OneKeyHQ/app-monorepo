import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { BigNumber } from 'bignumber.js';

import type { IInputProps } from '@onekeyhq/components';
import { Input } from '@onekeyhq/components';
import { validateAmountInput } from '@onekeyhq/kit/src/utils/validateAmountInput';
import { swapSlippageDecimal } from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import type { ISwapSlippageSegmentItem } from '@onekeyhq/shared/types/swap/types';
import { ESwapSlippageSegmentKey } from '@onekeyhq/shared/types/swap/types';

type ISlippageInputSegmentItem = Omit<ISwapSlippageSegmentItem, 'value'> & {
  value?: number;
};

export function formatSlippageInputDisplayValue(value?: number) {
  if (value === undefined) {
    return '';
  }

  const valueBN = new BigNumber(value);
  if (!valueBN.isFinite()) {
    return '';
  }

  return valueBN
    .decimalPlaces(swapSlippageDecimal, BigNumber.ROUND_DOWN)
    .toFixed();
}

const BaseSlippageInput = ({
  swapSlippage,
  onChangeText,
  props,
}: {
  swapSlippage: ISlippageInputSegmentItem;
  onChangeText: (text: string) => void;
  props?: IInputProps;
}) => {
  const [inputValue, setInputValue] = useState('');
  const isOriginalNumberDot = useRef(false);
  const handleTextChange = useCallback(
    (text: string) => {
      if (validateAmountInput(text, swapSlippageDecimal)) {
        isOriginalNumberDot.current = /^\d+\.$/.test(text);
        setInputValue(text);
        onChangeText(text);
      }
    },
    [onChangeText],
  );

  const displaySlippage = useMemo(
    () => formatSlippageInputDisplayValue(swapSlippage.value),
    [swapSlippage.value],
  );

  useEffect(() => {
    if (!isOriginalNumberDot.current) {
      setInputValue(displaySlippage);
    }
  }, [displaySlippage]);

  return (
    <Input
      size="medium"
      containerProps={{ flex: 1 }}
      value={inputValue}
      autoFocus={swapSlippage.key === ESwapSlippageSegmentKey.CUSTOM}
      addOns={[{ label: '%' }]}
      textAlign="left"
      disabled={swapSlippage.key === ESwapSlippageSegmentKey.AUTO}
      placeholder={displaySlippage}
      onChangeText={handleTextChange}
      {...props}
    />
  );
};

export const SlippageInput = memo(BaseSlippageInput);

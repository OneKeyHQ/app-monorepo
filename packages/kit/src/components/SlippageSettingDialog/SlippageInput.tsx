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

export function shouldSyncSlippageInputDisplayValue({
  inputValue,
  displaySlippage,
  isEditingTrailingDot,
  previousDisplayValue,
  hasSyncedDisplayValue,
  localInputDisplayValue,
}: {
  inputValue: string;
  displaySlippage: string;
  isEditingTrailingDot: boolean;
  previousDisplayValue: string;
  hasSyncedDisplayValue: boolean;
  localInputDisplayValue?: string;
}) {
  if (!hasSyncedDisplayValue) {
    return true;
  }

  if (localInputDisplayValue !== undefined) {
    return displaySlippage !== localInputDisplayValue;
  }

  if (isEditingTrailingDot) {
    return (
      formatSlippageInputDisplayValue(Number(inputValue)) !== displaySlippage
    );
  }

  return inputValue === previousDisplayValue;
}

function formatLocalInputDisplayValue(text: string) {
  if (!text) {
    return '';
  }

  return formatSlippageInputDisplayValue(Number(text));
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
  const isEditingTrailingDotRef = useRef(false);
  const localInputDisplayValueRef = useRef<string | undefined>(undefined);
  const handleTextChange = useCallback(
    (text: string) => {
      if (validateAmountInput(text, swapSlippageDecimal)) {
        isEditingTrailingDotRef.current = /^\d+\.$/.test(text);
        localInputDisplayValueRef.current = formatLocalInputDisplayValue(text);
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
  const inputValueRef = useRef(inputValue);
  const previousDisplayValueRef = useRef(displaySlippage);
  const hasSyncedDisplayValueRef = useRef(false);
  inputValueRef.current = inputValue;

  useEffect(() => {
    const currentInputValue = inputValueRef.current;
    const previousDisplayValue = previousDisplayValueRef.current;

    if (
      currentInputValue !== displaySlippage &&
      shouldSyncSlippageInputDisplayValue({
        inputValue: currentInputValue,
        displaySlippage,
        hasSyncedDisplayValue: hasSyncedDisplayValueRef.current,
        isEditingTrailingDot: isEditingTrailingDotRef.current,
        previousDisplayValue,
        localInputDisplayValue: localInputDisplayValueRef.current,
      })
    ) {
      setInputValue(displaySlippage);
      inputValueRef.current = displaySlippage;
      isEditingTrailingDotRef.current = false;
      localInputDisplayValueRef.current = undefined;
    }
    previousDisplayValueRef.current = displaySlippage;
    hasSyncedDisplayValueRef.current = true;
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

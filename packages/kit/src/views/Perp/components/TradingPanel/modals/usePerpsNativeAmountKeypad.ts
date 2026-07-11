import type { Dispatch, SetStateAction } from 'react';
import { useCallback } from 'react';

import { validateAmountInput } from '@onekeyhq/kit/src/utils/validateAmountInput';

const DIGIT_KEY_PATTERN = /^\d$/;

export function resolvePerpsNativeAmountKeypadValue({
  currentValue,
  key,
  decimals,
}: {
  currentValue: string;
  key: string;
  decimals?: number;
}) {
  if (key === 'backspace') {
    return currentValue.slice(0, -1);
  }

  if (key !== '.' && !DIGIT_KEY_PATTERN.test(key)) {
    return currentValue;
  }

  if (key === '.' && currentValue.includes('.')) {
    return currentValue;
  }

  let nextValue: string;
  if (key === '.') {
    nextValue = currentValue ? `${currentValue}.` : '0.';
  } else {
    nextValue = currentValue === '0' ? key : `${currentValue}${key}`;
  }

  return validateAmountInput(nextValue, decimals) ? nextValue : currentValue;
}

export function usePerpsNativeAmountKeypad({
  decimals,
  disabled,
  setAmount,
}: {
  decimals?: number;
  disabled: boolean;
  setAmount: Dispatch<SetStateAction<string>>;
}) {
  const onKeyPress = useCallback(
    (key: string) => {
      if (disabled) {
        return;
      }
      setAmount((currentValue) =>
        resolvePerpsNativeAmountKeypadValue({
          currentValue,
          key,
          decimals,
        }),
      );
    },
    [decimals, disabled, setAmount],
  );

  const onBackspaceLongPress = useCallback(() => {
    if (!disabled) {
      setAmount('');
    }
  }, [disabled, setAmount]);

  return {
    onBackspaceLongPress,
    onKeyPress,
  };
}

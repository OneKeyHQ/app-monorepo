/**
 * @jest-environment jsdom
 */
import { useState } from 'react';

import { act, renderHook } from '@testing-library/react';

import {
  resolvePerpsNativeAmountKeypadValue,
  usePerpsNativeAmountKeypad,
} from './usePerpsNativeAmountKeypad';

function applyKeySequence(keys: string[], decimals?: number) {
  return keys.reduce(
    (currentValue, key) =>
      resolvePerpsNativeAmountKeypadValue({
        currentValue,
        key,
        decimals,
      }),
    '',
  );
}

describe('resolvePerpsNativeAmountKeypadValue', () => {
  it('applies digits, decimal points, and backspaces in order', () => {
    expect(applyKeySequence(['1', '2', '.', '3'])).toBe('12.3');
    expect(applyKeySequence(['.', '5'])).toBe('0.5');
    expect(applyKeySequence(['0', '5'])).toBe('5');
    expect(applyKeySequence(['1', '2', 'backspace', '3'])).toBe('13');
  });

  it('ignores letters and other unsupported keys', () => {
    ['a', 'A', 'e', ' ', '+', '-', ',', '00'].forEach((key) => {
      expect(
        resolvePerpsNativeAmountKeypadValue({
          currentValue: '12',
          key,
          decimals: 2,
        }),
      ).toBe('12');
    });
    expect(applyKeySequence(['1', 'a', '2'])).toBe('12');
  });

  it('ignores repeated decimal points and digits beyond token precision', () => {
    expect(applyKeySequence(['1', '.', '2', '.', '3'], 2)).toBe('1.23');
    expect(applyKeySequence(['1', '.', '2', '3', '4'], 2)).toBe('1.23');
  });
});

describe('usePerpsNativeAmountKeypad', () => {
  function useKeypadHarness({
    decimals = 6,
    disabled = false,
    initialAmount = '',
  }: {
    decimals?: number;
    disabled?: boolean;
    initialAmount?: string;
  }) {
    const [amount, setAmount] = useState(initialAmount);
    const keypad = usePerpsNativeAmountKeypad({
      decimals,
      disabled,
      setAmount,
    });
    return { amount, ...keypad };
  }

  it('preserves rapid key presses queued before React rerenders', () => {
    const { result } = renderHook(() => useKeypadHarness({}));
    const onKeyPress = result.current.onKeyPress;

    act(() => {
      onKeyPress('1');
      onKeyPress('2');
      onKeyPress('3');
    });

    expect(result.current.amount).toBe('123');
  });

  it('keeps valid rapid input when unsupported keys are interleaved', () => {
    const { result } = renderHook(() => useKeypadHarness({}));
    const onKeyPress = result.current.onKeyPress;

    act(() => {
      onKeyPress('1');
      onKeyPress('a');
      onKeyPress('2');
    });

    expect(result.current.amount).toBe('12');
  });

  it('honors disabled state and clears on a long backspace press', () => {
    const { result, rerender } = renderHook<
      ReturnType<typeof useKeypadHarness>,
      { disabled: boolean }
    >(({ disabled }) => useKeypadHarness({ disabled, initialAmount: '123' }), {
      initialProps: { disabled: true },
    });

    act(() => {
      result.current.onKeyPress('4');
      result.current.onBackspaceLongPress();
    });
    expect(result.current.amount).toBe('123');

    rerender({ disabled: false });
    act(() => {
      result.current.onBackspaceLongPress();
    });
    expect(result.current.amount).toBe('');
  });
});

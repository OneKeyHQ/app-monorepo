/** @jest-environment jsdom */

import { useLayoutEffect } from 'react';
import type { FocusEvent, ReactNode, RefObject } from 'react';

import { act, fireEvent, render } from '@testing-library/react';

import { useAmountInputFocus } from '@onekeyhq/kit/src/components/PercentageStageOnKeyboard/useAmountInputFocus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { StakingAmountInput } from './StakingAmountInput';

const mockFocus = jest.fn();
const mockCurrentlyFocusedInput = jest.fn<unknown, []>(() => null);

function MockAmountInput({
  inputProps,
}: {
  inputProps: {
    loading?: boolean;
    ref?: RefObject<{ focus: () => void; blur: () => void } | null>;
    onFocus?: () => void;
    onBlur?: (event: FocusEvent<HTMLInputElement>) => void;
  };
}) {
  const { loading, ref } = inputProps;
  useLayoutEffect(() => {
    if (!ref || loading) return;
    ref.current = { focus: mockFocus, blur: jest.fn() };
    return () => {
      ref.current = null;
    };
  }, [loading, ref]);
  return (
    <input
      data-testid="amount-input"
      onFocus={inputProps.onFocus}
      onBlur={inputProps.onBlur}
    />
  );
}

jest.mock('react-native', () => ({
  InputAccessoryView: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
  TextInput: {
    State: { currentlyFocusedInput: () => mockCurrentlyFocusedInput() },
  },
}));

jest.mock('@onekeyhq/components', () => {
  function Container({ children }: { children?: ReactNode }) {
    return <div>{children}</div>;
  }
  return {
    AnimatePresence: Container,
    SizableText: Container,
    XStack: Container,
    YStack: Container,
  };
});

jest.mock('@onekeyhq/kit/src/components/AmountInput', () => ({
  AmountInput: MockAmountInput,
}));
jest.mock(
  '@onekeyhq/kit/src/views/Swap/components/PercentageStageOnKeyboard',
  () => ({
    PercentageStageOnKeyboard: ({
      onSelectPercentageStage: select,
    }: {
      onSelectPercentageStage?: (stage: number) => void;
    }) => (
      <button type="button" onClick={() => select?.(50)}>
        Select 50%
      </button>
    ),
  }),
);
jest.mock(
  '@onekeyhq/kit/src/views/Swap/components/SwapPercentageStageBadge',
  () => ({ __esModule: true, default: () => null }),
);
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isNative: true,
    isNativeIOS: true,
    isNativeIOSPhone: true,
    isNativeAndroid: false,
  },
}));

const onSelectPercentageStage = jest.fn();

describe('StakingAmountInput iOS keyboard accessory', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockFocus.mockReset();
    mockCurrentlyFocusedInput.mockReset().mockReturnValue(null);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('focuses on the next frame when auto-focus is requested', () => {
    render(
      <StakingAmountInput
        title="Amount"
        value=""
        inputProps={{ autoFocus: true }}
        usePercentageKeyboardAccessory
        onSelectPercentageStage={onSelectPercentageStage}
      />,
    );
    expect(mockFocus).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(16));
    expect(mockFocus).toHaveBeenCalledTimes(1);
  });

  it('does not take focus if the user focused another input before the frame', () => {
    render(
      <StakingAmountInput
        title="Amount"
        value=""
        inputProps={{ autoFocus: true }}
        usePercentageKeyboardAccessory
        onSelectPercentageStage={onSelectPercentageStage}
      />,
    );
    mockCurrentlyFocusedInput.mockReturnValue({});
    act(() => jest.advanceTimersByTime(16));
    expect(mockFocus).not.toHaveBeenCalled();
  });

  it('cancels a scheduled focus when the input unmounts', () => {
    const view = render(
      <StakingAmountInput
        title="Amount"
        value=""
        inputProps={{ autoFocus: true }}
        usePercentageKeyboardAccessory
        onSelectPercentageStage={onSelectPercentageStage}
      />,
    );
    view.unmount();
    act(() => jest.advanceTimersByTime(16));
    expect(mockFocus).not.toHaveBeenCalled();
  });

  it('waits until the input has loaded before requesting focus', () => {
    const view = render(
      <StakingAmountInput
        title="Amount"
        value=""
        inputProps={{ autoFocus: true, loading: true }}
        usePercentageKeyboardAccessory
        onSelectPercentageStage={onSelectPercentageStage}
      />,
    );
    act(() => jest.advanceTimersByTime(16));
    expect(mockFocus).not.toHaveBeenCalled();
    view.rerender(
      <StakingAmountInput
        title="Amount"
        value=""
        inputProps={{ autoFocus: true, loading: false }}
        usePercentageKeyboardAccessory
        onSelectPercentageStage={onSelectPercentageStage}
      />,
    );
    act(() => jest.advanceTimersByTime(16));
    expect(mockFocus).toHaveBeenCalledTimes(1);
  });

  it('ignores accessory percentage selections while the input is disabled', () => {
    const selectPercentage = jest.fn();
    const amountInput = (disabled: boolean) => (
      <StakingAmountInput
        title="Amount"
        value=""
        disabled={disabled}
        usePercentageKeyboardAccessory
        onSelectPercentageStage={selectPercentage}
      />
    );
    const view = render(amountInput(false));
    fireEvent.click(view.getByText('Select 50%'));
    expect(selectPercentage).toHaveBeenCalledWith(50);

    view.rerender(amountInput(true));
    fireEvent.click(view.getByText('Select 50%'));
    expect(selectPercentage).toHaveBeenCalledTimes(1);

    view.rerender(amountInput(false));
    fireEvent.click(view.getByText('Select 50%'));
    expect(selectPercentage).toHaveBeenCalledTimes(2);
  });
});

describe('StakingAmountInput Android focus ownership', () => {
  beforeEach(() => {
    Object.assign(platformEnv, {
      isNativeIOS: false,
      isNativeIOSPhone: false,
      isNativeAndroid: true,
    });
  });

  afterEach(() => {
    Object.assign(platformEnv, {
      isNativeIOS: true,
      isNativeIOSPhone: true,
      isNativeAndroid: false,
    });
  });

  it('reports focus and blur immediately without waiting for the desktop blur delay', () => {
    jest.useFakeTimers();
    const onAmountFocusChange = jest.fn();
    const view = render(
      <StakingAmountInput
        title="Amount"
        value=""
        onSelectPercentageStage={onSelectPercentageStage}
        onAmountFocusChange={onAmountFocusChange}
      />,
    );
    const input = view.getByTestId('amount-input');

    fireEvent.focus(input);
    expect(onAmountFocusChange).toHaveBeenLastCalledWith(
      expect.any(String),
      true,
    );
    const inputId = onAmountFocusChange.mock.lastCall?.[0];
    fireEvent.blur(input);
    expect(onAmountFocusChange).toHaveBeenLastCalledWith(inputId, false);
    expect(jest.getTimerCount()).toBeGreaterThan(0);
    view.unmount();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('clears a focused disabled input and restores ownership when re-enabled', () => {
    const onAmountFocusChange = jest.fn();
    const amountInput = (disabled: boolean) => (
      <StakingAmountInput
        title="Amount"
        value=""
        disabled={disabled}
        onSelectPercentageStage={onSelectPercentageStage}
        onAmountFocusChange={onAmountFocusChange}
      />
    );
    const view = render(amountInput(false));
    fireEvent.focus(view.getByTestId('amount-input'));
    const inputId = onAmountFocusChange.mock.lastCall?.[0];

    view.rerender(amountInput(true));
    expect(onAmountFocusChange).toHaveBeenLastCalledWith(inputId, false);
    view.rerender(amountInput(false));
    expect(onAmountFocusChange).toHaveBeenLastCalledWith(inputId, true);
    fireEvent.blur(view.getByTestId('amount-input'));
    expect(onAmountFocusChange).toHaveBeenLastCalledWith(inputId, false);
  });

  it('does not restore ownership after the disabled input actually blurs', () => {
    const onAmountFocusChange = jest.fn();
    const amountInput = (disabled: boolean) => (
      <StakingAmountInput
        title="Amount"
        value=""
        disabled={disabled}
        onSelectPercentageStage={onSelectPercentageStage}
        onAmountFocusChange={onAmountFocusChange}
      />
    );
    const view = render(amountInput(false));
    fireEvent.focus(view.getByTestId('amount-input'));
    view.rerender(amountInput(true));
    fireEvent.blur(view.getByTestId('amount-input'));
    onAmountFocusChange.mockClear();
    view.rerender(amountInput(false));
    expect(onAmountFocusChange).not.toHaveBeenCalledWith(
      expect.any(String),
      true,
    );
  });

  it('keeps the new input focused when the previously focused input unmounts', () => {
    function Form({ showFirst }: { showFirst: boolean }) {
      const { isAmountFocused, onAmountFocusChange } = useAmountInputFocus();
      return (
        <>
          <span data-testid="focus-state">{String(isAmountFocused)}</span>
          {showFirst ? (
            <StakingAmountInput
              title="First"
              value=""
              onSelectPercentageStage={onSelectPercentageStage}
              onAmountFocusChange={onAmountFocusChange}
            />
          ) : null}
          <StakingAmountInput
            title="Second"
            value=""
            onSelectPercentageStage={onSelectPercentageStage}
            onAmountFocusChange={onAmountFocusChange}
          />
        </>
      );
    }
    const view = render(<Form showFirst />);
    const [first, second] = view.getAllByTestId('amount-input');
    fireEvent.focus(first);
    fireEvent.focus(second);
    expect(view.getByTestId('focus-state').textContent).toBe('true');
    view.rerender(<Form showFirst={false} />);
    expect(view.getByTestId('focus-state').textContent).toBe('true');
    fireEvent.blur(view.getByTestId('amount-input'));
    expect(view.getByTestId('focus-state').textContent).toBe('false');
  });
});

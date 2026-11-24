/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';
import BigNumber from 'bignumber.js';

import { getSwapBalancePercentageDisplayAmount } from '@onekeyhq/kit/src/views/Swap/utils/swapAmountUtils';

import { PercentageStageRow } from './PercentageStageRow';

const mockDismissKeyboard = jest.fn();

jest.mock('react-native', () => ({
  Keyboard: {
    dismiss: () => {
      mockDismissKeyboard();
    },
  },
}));

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

jest.mock('@onekeyhq/components', () => {
  function Badge({
    children,
    onPress,
    'aria-disabled': ariaDisabled,
  }: {
    children: ReactNode;
    onPress: () => void;
    'aria-disabled'?: boolean;
  }) {
    return (
      <button
        aria-label="percentage"
        aria-disabled={ariaDisabled}
        onClick={onPress}
      >
        {children}
      </button>
    );
  }
  Badge.Text = ({ children }: { children: ReactNode }) => (
    <span>{children}</span>
  );

  return {
    Badge,
    Button: ({ onPress, testID }: { onPress: () => void; testID: string }) => (
      <button
        aria-label="dismiss keyboard"
        data-testid={testID}
        onClick={onPress}
      />
    ),
    XStack: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  };
});

describe('PercentageStageRow', () => {
  beforeEach(() => mockDismissKeyboard.mockClear());

  it('selects the supplied percentages and dismisses the keyboard separately', () => {
    const onSelect = jest.fn();
    render(
      <PercentageStageRow
        stageList={[10, 35, 100]}
        onSelectPercentageStage={onSelect}
      />,
    );

    for (const stage of [10, 35, 100]) {
      fireEvent.click(screen.getByText(`${stage}%`));
    }
    expect(onSelect.mock.calls).toEqual([[10], [35], [100]]);
    expect(mockDismissKeyboard).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('swap-stage-list-to-show-btn'));
    expect(mockDismissKeyboard).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledTimes(3);
  });

  it('applies the selected percentage only after the token multiplier is ready', () => {
    const amountForStage = (percentage: number, ready: boolean) =>
      getSwapBalancePercentageDisplayAmount({
        balance: new BigNumber(100),
        percentage,
        token: { decimals: 6, balanceMultiplier: ready ? '1' : '2' },
        multiplierReady: ready,
      });
    const onSelect = jest.fn((stage: number) => amountForStage(stage, true));
    const props = { stageList: [25], onSelectPercentageStage: onSelect };
    const { rerender } = render(<PercentageStageRow {...props} disabled />);
    const shortcut = screen.getByRole('button', { name: 'percentage' });
    expect(shortcut.getAttribute('aria-disabled')).toBe('true');
    expect(amountForStage(25, false)).toBeUndefined();
    fireEvent.click(shortcut);
    expect(onSelect).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('swap-stage-list-to-show-btn'));
    expect(mockDismissKeyboard).toHaveBeenCalledTimes(1);

    rerender(<PercentageStageRow {...props} />);
    expect(shortcut.hasAttribute('aria-disabled')).toBe(false);
    fireEvent.click(shortcut);
    expect(onSelect).toHaveReturnedWith('25');
  });
});

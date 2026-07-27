/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import { ESwapDirection } from '../../hooks/useTradeType';

import { QuickAmountSelector } from './QuickAmountSelector';

jest.mock('@onekeyhq/components', () => ({
  Button: ({
    children,
    disabled,
    onPress,
  }: {
    children?: ReactNode;
    disabled?: boolean;
    onPress?: () => void;
  }) => (
    <button disabled={disabled} onClick={onPress} type="button">
      {children}
    </button>
  ),
  SizableText: ({ children }: { children?: ReactNode }) => (
    <span>{children}</span>
  ),
  Stack: () => null,
  XStack: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

const defaultProps = {
  buyAmounts: [{ label: '100', value: 100 }],
  onSelect: jest.fn(),
  tradeType: ESwapDirection.SELL,
  swapNativeTokenReserveGas: [],
};

describe('QuickAmountSelector', () => {
  beforeEach(() => {
    defaultProps.onSelect.mockReset();
  });

  it('does not treat a sell percentage as an absolute amount while balance is unknown', () => {
    render(<QuickAmountSelector {...defaultProps} balance={undefined} />);

    const percentageButton = screen.getByRole('button', { name: '25%' });

    expect((percentageButton as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(percentageButton);
    expect(defaultProps.onSelect).not.toHaveBeenCalled();
  });

  it('keeps buy presets available while balance is unknown', () => {
    render(
      <QuickAmountSelector
        {...defaultProps}
        balance={undefined}
        tradeType={ESwapDirection.BUY}
      />,
    );

    const presetButton = screen.getByRole('button', { name: '100' });

    expect((presetButton as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(presetButton);
    expect(defaultProps.onSelect).toHaveBeenCalledWith('100');
  });
});

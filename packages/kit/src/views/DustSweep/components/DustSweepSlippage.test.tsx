/** @jest-environment jsdom */
import type { PropsWithChildren, ReactNode } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import { ETranslations } from '@onekeyhq/shared/src/locale';

import { DustSweepSlippage } from './DustSweepSlippage';

const mockSetSlippage = jest.fn();
jest.mock('../DustSweepProvider', () => ({
  useDustSweep: () => ({ slippage: 5, setSlippage: mockSetSlippage }),
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: false },
}));
jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: (
      { id }: { id: string },
      values?: Record<string, string | number>,
    ) => (values ? `${id}:${Object.values(values).join(':')}` : id),
  }),
}));
jest.mock('@onekeyhq/components', () => {
  function Box({ children, testID }: PropsWithChildren<{ testID?: string }>) {
    return <div data-testid={testID}>{children}</div>;
  }
  return {
    Button: ({
      children,
      testID,
      disabled,
      onPress,
    }: PropsWithChildren<{
      testID?: string;
      disabled?: boolean;
      onPress?: () => void;
    }>) => (
      <button
        type="button"
        data-testid={testID}
        disabled={disabled}
        onClick={onPress}
      >
        {children}
      </button>
    ),
    Dialog: { show: jest.fn() },
    Divider: () => null,
    Icon: () => null,
    IconButton: Box,
    Popover: ({
      renderContent,
    }: {
      renderContent: (props: { closePopover: () => void }) => ReactNode;
    }) => renderContent({ closePopover: jest.fn() }),
    SizableText: Box,
    Stack: Box,
    XStack: Box,
    YStack: Box,
    useMedia: () => ({ md: false }),
  };
});
jest.mock('@onekeyhq/kit/src/components/SlippageSettingDialog', () => ({
  SlippageInput: ({
    swapSlippage,
    onChangeText,
    testID,
  }: {
    swapSlippage: { value?: number };
    onChangeText: (value: string) => void;
    testID: string;
  }) => (
    <input
      data-testid={testID}
      value={swapSlippage.value ?? ''}
      onChange={(event) => onChangeText(event.target.value)}
    />
  ),
}));

beforeEach(() => jest.clearAllMocks());

it.each([
  ['0', false],
  ['0.1', false],
  ['4.99', false],
  ['5', true],
  ['10', true],
  ['50', true],
  ['50.01', false],
  ['', false],
])('allows confirming slippage %s only in the 5–50%% range', (value, valid) => {
  render(<DustSweepSlippage />);
  fireEvent.change(screen.getByTestId('dust-sweep-slippage-input'), {
    target: { value },
  });
  const confirm = screen.getByTestId('dust-sweep-slippage-confirm');
  expect(confirm.hasAttribute('disabled')).toBe(!valid);
  fireEvent.click(confirm);
  if (valid) expect(mockSetSlippage).toHaveBeenCalledWith(Number(value));
  else expect(mockSetSlippage).not.toHaveBeenCalled();
});

it('explains the 5% minimum when a smaller slippage is entered', () => {
  render(<DustSweepSlippage />);
  fireEvent.change(screen.getByTestId('dust-sweep-slippage-input'), {
    target: { value: '4.99' },
  });
  expect(screen.getByTestId('dust-sweep-slippage-message').textContent).toBe(
    `${ETranslations.slippage_tolerance_warning_message_2}:5`,
  );
});

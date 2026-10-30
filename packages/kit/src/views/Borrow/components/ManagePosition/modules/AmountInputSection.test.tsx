/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import { ManagePositionContext } from '../ManagePositionContext';

import { AmountInputSection } from './AmountInputSection';

import type { IManagePositionContextValue } from '../types';

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

jest.mock('@onekeyhq/components', () => {
  function Container({ children }: { children?: ReactNode }) {
    return <div>{children}</div>;
  }
  return { Alert: Container, Stack: Container, YStack: Container };
});

jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({}),
}));

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/discovery', () => ({
  useBrowserAction: () => ({ current: { handleOpenWebSite: jest.fn() } }),
}));

jest.mock(
  '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/EarnText',
  () => ({
    EarnText: () => null,
  }),
);

jest.mock(
  '@onekeyhq/kit/src/views/Staking/components/StakingAmountInput',
  () => ({
    StakingAmountInput: ({
      onSelectPercentageStage,
      onAmountFocusChange,
      usePercentageKeyboardAccessory,
    }: {
      onSelectPercentageStage: (percentage: number) => void;
      onAmountFocusChange: (inputId: string, focused: boolean) => void;
      usePercentageKeyboardAccessory?: boolean;
    }) => (
      <div data-accessory={String(usePercentageKeyboardAccessory)}>
        <input
          aria-label="Amount"
          onFocus={() => onAmountFocusChange('amount-input', true)}
          onBlur={() => onAmountFocusChange('amount-input', false)}
        />
        {[50, 100].map((stage) => (
          <button
            type="button"
            key={stage}
            onClick={() => onSelectPercentageStage(stage)}
          >
            {stage}%
          </button>
        ))}
      </div>
    ),
  }),
);

describe('Borrow percentage input', () => {
  it('rejects percentage selections while approval locks the form and restores them afterward', () => {
    let amount = 0;
    const onAmountFocusChange = jest.fn();
    const onSelectPercentageStage = jest.fn((stage: number) => {
      amount = stage;
    });
    const context = (isFormInteractionLocked: boolean) =>
      ({
        state: {
          action: 'supply',
          amountValue: '',
          balance: '100',
          isDisabled: false,
          isInModalContext: true,
        },
        actions: {
          onChangeAmountValue: jest.fn(),
          onMax: jest.fn(),
          onSelectPercentageStage,
          onBlurAmountValue: jest.fn(),
        },
        actionResult: { checkAmountAlerts: [] },
        approval: { isFormInteractionLocked },
      }) as unknown as IManagePositionContextValue;

    const unlockedContext = context(false);
    const lockedContext = context(true);
    const view = render(
      <ManagePositionContext.Provider value={unlockedContext}>
        <AmountInputSection onAmountFocusChange={onAmountFocusChange} />
      </ManagePositionContext.Provider>,
    );
    const percentage = screen.getByRole('button', { name: '50%' });
    expect(percentage.parentElement?.getAttribute('data-accessory')).toBe(
      'true',
    );
    fireEvent.focus(screen.getByRole('textbox', { name: 'Amount' }));
    expect(onAmountFocusChange).toHaveBeenLastCalledWith('amount-input', true);
    fireEvent.blur(screen.getByRole('textbox', { name: 'Amount' }));
    expect(onAmountFocusChange).toHaveBeenLastCalledWith('amount-input', false);
    fireEvent.click(percentage);
    expect(onSelectPercentageStage).toHaveBeenCalledTimes(1);
    expect(onSelectPercentageStage).toHaveBeenLastCalledWith(50);
    expect(amount).toBe(50);

    view.rerender(
      <ManagePositionContext.Provider value={lockedContext}>
        <AmountInputSection onAmountFocusChange={onAmountFocusChange} />
      </ManagePositionContext.Provider>,
    );
    fireEvent.click(screen.getByRole('button', { name: '100%' }));
    expect(onSelectPercentageStage).toHaveBeenCalledTimes(1);
    expect(amount).toBe(50);

    view.rerender(
      <ManagePositionContext.Provider value={unlockedContext}>
        <AmountInputSection onAmountFocusChange={onAmountFocusChange} />
      </ManagePositionContext.Provider>,
    );
    fireEvent.click(screen.getByRole('button', { name: '100%' }));
    expect(onSelectPercentageStage).toHaveBeenCalledTimes(2);
    expect(onSelectPercentageStage).toHaveBeenLastCalledWith(100);
    expect(amount).toBe(100);
  });
});

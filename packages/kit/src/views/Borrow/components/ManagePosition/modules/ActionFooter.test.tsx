/** @jest-environment jsdom */

import { fireEvent, render, waitFor } from '@testing-library/react';

import { ActionFooter } from './ActionFooter';

const mockSubmit = jest.fn();
const mockState = {
  accountId: 'account-a',
  networkId: 'evm--1',
  providerName: 'aave',
  borrowMarketAddress: 'market',
  borrowReserveAddress: 'reserve',
  action: 'supply',
  amountValue: '1',
  isEarnForm: true,
  isWithdrawAll: false,
  isRepayAll: false,
  submitting: false,
  isDisabled: false,
  isAmountInvalid: false,
  isInsufficientBalance: false,
};
const mockResult = {
  checkAmountLoading: true,
  checkAmountResult: undefined as boolean | undefined,
  isCheckAmountMessageError: false,
  transactionConfirmationLoading: false,
};

jest.mock('../ManagePositionContext', () => ({
  useManagePositionContext: () => ({
    state: mockState,
    actionResult: mockResult,
    actions: { onSubmit: mockSubmit, setSubmitting: jest.fn() },
    approval: { ensureReadyToSubmit: async () => true },
  }),
}));
jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: () => 'Supply' }),
}));
jest.mock('react-native', () => ({ Keyboard: { dismiss: jest.fn() } }));
jest.mock(
  '@onekeyhq/kit/src/views/Earn/components/desktopHome/earnDesktopHomeCopy',
  () => ({
    useEarnDesktopHomeCopy: () => ({ approveAnd: (label: string) => label }),
  }),
);
jest.mock('@onekeyhq/kit/src/views/Staking/components/EarnFormFooter', () => ({
  EarnFormFooter: ({
    confirmButtonProps,
  }: {
    confirmButtonProps: { onPress: () => void; disabled?: boolean };
  }) => (
    <button
      type="button"
      disabled={confirmButtonProps.disabled}
      onClick={confirmButtonProps.onPress}
    >
      Supply
    </button>
  ),
}));
jest.mock('@onekeyhq/kit/src/components/PercentageStageOnKeyboard', () => ({
  PercentageStageOnKeyboard: () => null,
}));
jest.mock('@onekeyhq/kit/src/views/Staking/components/StakeProgress', () => ({
  EStakeProgressStep: { approve: 0, deposit: 1 },
  StakeProgress: () => null,
}));
jest.mock(
  '@onekeyhq/kit/src/views/Staking/components/UniversalStake/EarnFormSummary',
  () => {
    const React = jest.requireActual<typeof import('react')>('react');
    return {
      EarnFormCompactContext: React.createContext(false),
      EarnFormSwitchingContext: React.createContext(false),
    };
  },
);

beforeEach(() => {
  mockSubmit.mockReset();
  mockSubmit.mockResolvedValue(undefined);
  mockState.amountValue = '1';
  mockState.accountId = 'account-a';
  mockResult.checkAmountLoading = true;
  mockResult.checkAmountResult = undefined;
});

it('continues a press only after its original amount passes validation', async () => {
  const view = render(<ActionFooter isAmountFocused={false} />);
  fireEvent.click(view.getByRole('button'));
  mockResult.checkAmountLoading = false;
  mockResult.checkAmountResult = true;
  view.rerender(<ActionFooter isAmountFocused={false} />);
  await waitFor(() => expect(mockSubmit).toHaveBeenCalledTimes(1));
});

it.each(['amount', 'account', 'change-back'])(
  'cancels a waiting press when its %s changes',
  async (change) => {
    const view = render(<ActionFooter isAmountFocused={false} />);
    fireEvent.click(view.getByRole('button'));
    if (change === 'account') mockState.accountId = 'account-b';
    else mockState.amountValue = '10';
    view.rerender(<ActionFooter isAmountFocused={false} />);
    if (change === 'change-back') {
      mockState.amountValue = '1';
      view.rerender(<ActionFooter isAmountFocused={false} />);
    }
    mockResult.checkAmountLoading = false;
    mockResult.checkAmountResult = true;
    view.rerender(<ActionFooter isAmountFocused={false} />);
    expect(mockSubmit).not.toHaveBeenCalled();
    fireEvent.click(view.getByRole('button'));
    await waitFor(() => expect(mockSubmit).toHaveBeenCalledTimes(1));
  },
);

it('does not continue without a positive validation result', () => {
  const view = render(<ActionFooter isAmountFocused={false} />);
  fireEvent.click(view.getByRole('button'));
  mockResult.checkAmountLoading = false;
  view.rerender(<ActionFooter isAmountFocused={false} />);
  expect(mockSubmit).not.toHaveBeenCalled();
});

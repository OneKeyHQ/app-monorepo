/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { act, fireEvent, render, screen } from '@testing-library/react';

import { WalletActionApprovals } from './WalletActionApprovals';

const mockNavigateToApprovalList = jest.fn();

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

jest.mock('@onekeyhq/components', () => ({
  ActionList: {
    Item: ({
      label,
      onPress,
      extra,
    }: {
      label: string;
      onPress: () => void;
      extra?: ReactNode;
    }) => (
      <button type="button" onClick={onPress}>
        {label}
        {extra}
      </button>
    ),
  },
  Stack: ({ testID }: { testID?: string }) => <span data-testid={testID} />,
}));

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/accountSelector', () => ({
  useActiveAccount: () => ({
    activeAccount: {
      account: { id: 'account-1', indexedAccountId: 'indexed-1' },
      network: { id: 'evm--1' },
      wallet: { id: 'wallet-1', type: 'hd' },
    },
  }),
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    wallet: { walletActions: { actionApprovals: jest.fn() } },
  },
}));

jest.mock('@onekeyhq/shared/src/utils/timerUtils', () => ({
  __esModule: true,
  default: { wait: async () => undefined },
}));

jest.mock('../../hooks/useNavigateToApprovalList', () => ({
  useNavigateToApprovalList: () => mockNavigateToApprovalList,
}));

const DOT_TEST_ID = 'wallet-action-approvals-risk-dot';

async function pressApprovals() {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'global.approvals' }));
  });
}

describe('WalletActionApprovals risk dot', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('marks risk approvals reviewed when opened from the dotted item', async () => {
    const onClose = jest.fn();
    const onRiskSeen = jest.fn();
    render(
      <WalletActionApprovals
        onClose={onClose}
        showRiskDot
        onRiskSeen={onRiskSeen}
      />,
    );
    expect(screen.getByTestId(DOT_TEST_ID)).toBeTruthy();

    await pressApprovals();

    expect(onRiskSeen).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mockNavigateToApprovalList).toHaveBeenCalledWith({
      networkId: 'evm--1',
      accountId: 'account-1',
      walletId: 'wallet-1',
      indexedAccountId: 'indexed-1',
    });
  });

  it('leaves the review state alone without a dot', async () => {
    const onRiskSeen = jest.fn();
    render(
      <WalletActionApprovals onClose={jest.fn()} onRiskSeen={onRiskSeen} />,
    );
    expect(screen.queryByTestId(DOT_TEST_ID)).toBeNull();

    await pressApprovals();

    expect(onRiskSeen).not.toHaveBeenCalled();
    expect(mockNavigateToApprovalList).toHaveBeenCalledTimes(1);
  });
});

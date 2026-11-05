/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import { HeaderRight } from './HeaderRight';

jest.mock('@onekeyhq/components', () => ({
  XStack: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  IconButton: ({ onPress }: { onPress?: () => void }) => (
    <button type="button" onClick={onPress}>
      Slippage
    </button>
  ),
  Button: () => null,
}));
jest.mock('@onekeyhq/kit/src/views/Earn/hooks/useStakingPendingTxs', () => ({
  useStakingPendingTxs: () => ({ pendingCount: 0, refreshPending: jest.fn() }),
}));
jest.mock(
  '@onekeyhq/kit/src/views/Staking/components/RefreshCooldownButton',
  () => ({
    RefreshCooldownButton: ({ onPress }: { onPress: () => void }) => (
      <button type="button" onClick={onPress}>
        Refresh
      </button>
    ),
  }),
);
jest.mock(
  '@onekeyhq/kit/src/views/Staking/components/StakingActivityIndicator',
  () => ({
    PendingIndicator: () => null,
  }),
);

describe('manage header controls', () => {
  it('shows only the configured control and invokes its handler', () => {
    const onOpenSlippage = jest.fn();
    const onRefreshQuote = jest.fn();
    const { rerender } = render(
      <HeaderRight
        networkId="evm--1"
        showSlippageControl
        onOpenSlippage={onOpenSlippage}
        onRefreshQuote={onRefreshQuote}
      />,
    );

    fireEvent.click(screen.getByText('Slippage'));
    expect(onOpenSlippage).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Refresh')).toBeNull();

    rerender(
      <HeaderRight
        networkId="evm--1"
        showQuoteRefresh
        onOpenSlippage={onOpenSlippage}
        onRefreshQuote={onRefreshQuote}
      />,
    );
    expect(screen.queryByText('Slippage')).toBeNull();
    fireEvent.click(screen.getByText('Refresh'));
    expect(onRefreshQuote).toHaveBeenCalledTimes(1);

    rerender(
      <HeaderRight
        networkId="evm--1"
        showSlippageControl
        showQuoteRefresh
        onOpenSlippage={onOpenSlippage}
        onRefreshQuote={onRefreshQuote}
      />,
    );
    expect(
      screen.getAllByRole('button').map((button) => button.textContent),
    ).toEqual(['Slippage', 'Refresh']);
  });
});

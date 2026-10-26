/** @jest-environment jsdom */

import { render } from '@testing-library/react';

import type { IBorrowRewards } from '@onekeyhq/shared/types/staking';

import { BorrowRewardsMetric } from './BorrowRewardsMetric';

const context = {
  market: {
    provider: 'aave',
    networkId: 'evm--1',
    marketAddress: '0xMarket',
  },
  earnAccount: { data: { account: { id: 'account-1' } } },
  pendingTxs: [],
};
const rewards = { button: { disabled: true } } as IBorrowRewards;

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/components', () => ({
  Button: ({ children }: { children: React.ReactNode }) => (
    <button type="button" data-testid="claim-button">
      {children}
    </button>
  ),
}));
jest.mock('@onekeyhq/shared/src/utils/earnUtils', () => ({
  __esModule: true,
  default: {
    normalizeBorrowAddress: ({ address }: { address: string }) => address,
    getEarnProviderName: () => 'Aave',
  },
}));
jest.mock('../../Staking/components/ProtocolDetails/EarnText', () => ({
  EarnText: ({ text }: { text: { text: string } }) => <span>{text.text}</span>,
}));
jest.mock('../../Staking/utils/utils', () => ({
  buildBorrowTag: () => '',
}));
jest.mock('../BorrowProvider', () => ({
  useBorrowContext: () => context,
}));
jest.mock('../hooks/useBorrowPlaceholderAmountText', () => ({
  useBorrowPlaceholderAmountText: () => ({ text: '$0.00' }),
}));
jest.mock('../hooks/useUniversalBorrowHooks', () => ({
  useUniversalBorrowClaim: () => jest.fn(),
}));
jest.mock('./BorrowClaimRewardsDialog', () => ({
  showBorrowClaimRewardsDialog: jest.fn(),
}));
jest.mock('./BorrowRewardsMetric.utils', () => ({
  getPendingBorrowClaimIds: () => [],
}));
jest.mock('./OverviewMetric', () => ({
  OverviewMetric: ({
    action,
    isLoading,
    text,
  }: {
    action?: React.ReactNode;
    isLoading: boolean;
    text?: { text: string };
  }) => (
    <div
      data-testid="rewards"
      data-loading={isLoading ? 'true' : 'false'}
      data-text={text?.text}
    >
      {action}
    </div>
  ),
}));

describe('BorrowRewardsMetric loading', () => {
  it('keeps rewards through polling but resets for another market or account', () => {
    const originalMarket = context.market;
    const originalEarnAccount = context.earnAccount;
    const onClaimed = jest.fn();
    const { getByTestId, rerender } = render(
      <BorrowRewardsMetric borrowRewards={rewards} onClaimed={onClaimed} />,
    );
    const loading = () => getByTestId('rewards').getAttribute('data-loading');

    try {
      expect(loading()).toBe('false');
      rerender(<BorrowRewardsMetric isLoading onClaimed={onClaimed} />);
      expect(loading()).toBe('false');

      context.market = { ...originalMarket, marketAddress: '0xOtherMarket' };
      rerender(<BorrowRewardsMetric isLoading onClaimed={onClaimed} />);
      expect(loading()).toBe('true');

      rerender(
        <BorrowRewardsMetric
          borrowRewards={rewards}
          isLoading
          onClaimed={onClaimed}
        />,
      );
      expect(loading()).toBe('false');
      context.earnAccount = { data: { account: { id: 'account-2' } } };
      rerender(<BorrowRewardsMetric isLoading onClaimed={onClaimed} />);
      expect(loading()).toBe('true');
    } finally {
      context.market = originalMarket;
      context.earnAccount = originalEarnAccount;
    }
  });

  it('shows an error placeholder and hides Claim when a refresh fails after success', () => {
    const claimableRewards = {
      description: { text: '$1.23' },
      button: { disabled: false, text: { text: 'Claim' } },
    } as IBorrowRewards;
    const onClaimed = jest.fn();
    const { getByTestId, queryByTestId, rerender } = render(
      <BorrowRewardsMetric
        borrowRewards={claimableRewards}
        onClaimed={onClaimed}
      />,
    );

    expect(getByTestId('rewards').getAttribute('data-text')).toBe('$1.23');
    expect(queryByTestId('claim-button')).not.toBeNull();

    rerender(
      <BorrowRewardsMetric
        borrowRewards={claimableRewards}
        isLoading
        onClaimed={onClaimed}
      />,
    );
    expect(getByTestId('rewards').getAttribute('data-loading')).toBe('false');
    expect(getByTestId('rewards').getAttribute('data-text')).toBe('$1.23');
    expect(queryByTestId('claim-button')).not.toBeNull();

    rerender(
      <BorrowRewardsMetric
        borrowRewards={claimableRewards}
        isError
        onClaimed={onClaimed}
      />,
    );
    expect(getByTestId('rewards').getAttribute('data-loading')).toBe('false');
    expect(getByTestId('rewards').getAttribute('data-text')).toBe('-');
    expect(queryByTestId('claim-button')).toBeNull();
  });
});

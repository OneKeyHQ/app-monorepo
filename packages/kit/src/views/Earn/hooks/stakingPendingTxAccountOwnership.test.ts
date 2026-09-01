import { resolveStakingPendingTxAccountOwnership } from './stakingPendingTxAccountOwnership';

describe('resolveStakingPendingTxAccountOwnership', () => {
  const activeOwnership = {
    activeAccountId: 'active-account',
    activeIndexedAccountId: 'active-indexed-account',
    activeNetworkId: 'evm--1',
  };

  it('preserves the active-account defaults without explicit ownership', () => {
    expect(
      resolveStakingPendingTxAccountOwnership({
        ...activeOwnership,
        networkIds: ['evm--1'],
      }),
    ).toEqual({
      accountId: 'active-account',
      indexedAccountId: 'active-indexed-account',
      currentNetworkId: 'evm--1',
      hasExplicitOwnership: false,
    });
  });

  it('uses the explicit account for a single monitored network', () => {
    expect(
      resolveStakingPendingTxAccountOwnership({
        ...activeOwnership,
        accountId: 'route-account',
        indexedAccountId: 'route-indexed-account',
        networkIds: ['evm--8453'],
      }),
    ).toEqual({
      accountId: 'route-account',
      indexedAccountId: 'route-indexed-account',
      currentNetworkId: 'evm--8453',
      hasExplicitOwnership: true,
    });
  });

  it('does not mix an explicit indexed account with the active account', () => {
    expect(
      resolveStakingPendingTxAccountOwnership({
        ...activeOwnership,
        indexedAccountId: 'route-indexed-account',
        networkIds: ['evm--1'],
      }),
    ).toEqual({
      accountId: undefined,
      indexedAccountId: 'route-indexed-account',
      currentNetworkId: undefined,
      hasExplicitOwnership: true,
    });
  });

  it('does not guess which network owns an explicit account in a multi-network query', () => {
    expect(
      resolveStakingPendingTxAccountOwnership({
        ...activeOwnership,
        accountId: 'route-account',
        indexedAccountId: 'route-indexed-account',
        networkIds: ['evm--1', 'evm--8453'],
      }),
    ).toEqual({
      accountId: 'route-account',
      indexedAccountId: 'route-indexed-account',
      currentNetworkId: undefined,
      hasExplicitOwnership: true,
    });
  });
});

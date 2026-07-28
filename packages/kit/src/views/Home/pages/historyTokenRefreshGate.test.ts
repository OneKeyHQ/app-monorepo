import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';

import { buildTokenRefreshPlanAfterHistory } from './historyTokenRefreshGate';

describe('buildTokenRefreshPlanAfterHistory', () => {
  const account = { accountId: 'account-1', networkId: 'btc--0' };
  const otherNetworkAccount = { accountId: 'account-1', networkId: 'evm--1' };

  it('refreshes all changed accounts now when there is no active token refresh', () => {
    expect(
      buildTokenRefreshPlanAfterHistory({
        accounts: [account],
        lastTokensTabState: undefined,
      }),
    ).toEqual({
      accountsToRefreshNow: [account],
      accountsToRefreshAfterTokensDone: [],
    });
  });

  it('does not skip a completed token refresh from the same cycle', () => {
    expect(
      buildTokenRefreshPlanAfterHistory({
        accounts: [account, otherNetworkAccount],
        lastTokensTabState: {
          ...account,
          isRefreshing: false,
          at: 10_000,
        },
      }),
    ).toEqual({
      accountsToRefreshNow: [account, otherNetworkAccount],
      accountsToRefreshAfterTokensDone: [],
    });
  });

  it('defers the same account and network while the token refresh is still in flight', () => {
    expect(
      buildTokenRefreshPlanAfterHistory({
        accounts: [account, otherNetworkAccount],
        lastTokensTabState: {
          ...account,
          isRefreshing: true,
          at: 1000,
        },
      }),
    ).toEqual({
      accountsToRefreshNow: [otherNetworkAccount],
      accountsToRefreshAfterTokensDone: [account],
      tokensDoneScope: account,
    });
  });

  it('defers all changed merge-derive accounts in the same network while the indexed account is refreshing tokens', () => {
    const indexedAccount = {
      accountId: 'indexed-account-1',
      networkId: 'btc--0',
    };
    const nativeAccount = {
      accountId: 'native-account-1',
      networkId: 'btc--0',
    };
    const nestedAccount = {
      accountId: 'nested-account-1',
      networkId: 'btc--0',
    };

    expect(
      buildTokenRefreshPlanAfterHistory({
        accounts: [nativeAccount, nestedAccount, otherNetworkAccount],
        lastTokensTabState: {
          ...indexedAccount,
          isRefreshing: true,
          at: 10_000,
        },
        tokenRefreshScope: {
          ...indexedAccount,
          includesAllAccountsInNetwork: true,
        },
      }),
    ).toEqual({
      accountsToRefreshNow: [otherNetworkAccount],
      accountsToRefreshAfterTokensDone: [nativeAccount, nestedAccount],
      tokensDoneScope: indexedAccount,
    });
  });

  it('defers all changed accounts while an all-network token refresh is in flight for the same account', () => {
    const tokensDoneScope = {
      accountId: account.accountId,
      networkId: getNetworkIdsMap().onekeyall,
    };

    expect(
      buildTokenRefreshPlanAfterHistory({
        accounts: [account, otherNetworkAccount],
        lastTokensTabState: {
          ...tokensDoneScope,
          isRefreshing: true,
          at: 10_000,
        },
        tokenRefreshScope: {
          ...tokensDoneScope,
        },
      }),
    ).toEqual({
      accountsToRefreshNow: [],
      accountsToRefreshAfterTokensDone: [account, otherNetworkAccount],
      tokensDoneScope,
    });
  });

  it('keeps the all-network tokens done scope when history has switched to a single network', () => {
    const tokensDoneScope = {
      accountId: account.accountId,
      networkId: getNetworkIdsMap().onekeyall,
    };

    expect(
      buildTokenRefreshPlanAfterHistory({
        accounts: [account, otherNetworkAccount],
        lastTokensTabState: {
          ...tokensDoneScope,
          isRefreshing: true,
          at: 10_000,
        },
        tokenRefreshScope: account,
      }),
    ).toEqual({
      accountsToRefreshNow: [],
      accountsToRefreshAfterTokensDone: [account, otherNetworkAccount],
      tokensDoneScope,
    });
  });

  it('does not defer accounts for an all-network token refresh from another account', () => {
    expect(
      buildTokenRefreshPlanAfterHistory({
        accounts: [account],
        lastTokensTabState: {
          accountId: 'another-account',
          networkId: getNetworkIdsMap().onekeyall,
          isRefreshing: true,
          at: 10_000,
        },
        tokenRefreshScope: {
          accountId: account.accountId,
          networkId: getNetworkIdsMap().onekeyall,
        },
      }),
    ).toEqual({
      accountsToRefreshNow: [account],
      accountsToRefreshAfterTokensDone: [],
    });
  });

  it('does not use a merge-derive scope when it does not match the recent token refresh state', () => {
    const indexedAccount = {
      accountId: 'indexed-account-1',
      networkId: 'btc--0',
    };
    const nativeAccount = {
      accountId: 'native-account-1',
      networkId: 'btc--0',
    };

    expect(
      buildTokenRefreshPlanAfterHistory({
        accounts: [nativeAccount],
        lastTokensTabState: {
          accountId: 'another-indexed-account',
          networkId: 'btc--0',
          isRefreshing: true,
          at: 10_000,
        },
        tokenRefreshScope: {
          ...indexedAccount,
          includesAllAccountsInNetwork: true,
        },
      }),
    ).toEqual({
      accountsToRefreshNow: [nativeAccount],
      accountsToRefreshAfterTokensDone: [],
    });
  });

  it('refreshes now after a recent completed token refresh from a previous history cycle', () => {
    expect(
      buildTokenRefreshPlanAfterHistory({
        accounts: [account],
        lastTokensTabState: {
          ...account,
          isRefreshing: false,
          at: 10_000,
        },
      }),
    ).toEqual({
      accountsToRefreshNow: [account],
      accountsToRefreshAfterTokensDone: [],
    });
  });

  it('refreshes now when a completed token refresh started just before the history run', () => {
    expect(
      buildTokenRefreshPlanAfterHistory({
        accounts: [account],
        lastTokensTabState: {
          ...account,
          isRefreshing: false,
          at: 10_000,
        },
      }),
    ).toEqual({
      accountsToRefreshNow: [account],
      accountsToRefreshAfterTokensDone: [],
    });
  });

  it('refreshes now after the former cooldown window expires', () => {
    expect(
      buildTokenRefreshPlanAfterHistory({
        accounts: [account],
        lastTokensTabState: {
          ...account,
          isRefreshing: false,
          at: 1000,
        },
      }),
    ).toEqual({
      accountsToRefreshNow: [account],
      accountsToRefreshAfterTokensDone: [],
    });
  });

  it('refreshes now at the former cooldown boundary', () => {
    expect(
      buildTokenRefreshPlanAfterHistory({
        accounts: [account],
        lastTokensTabState: {
          ...account,
          isRefreshing: false,
          at: 5000,
        },
      }),
    ).toEqual({
      accountsToRefreshNow: [account],
      accountsToRefreshAfterTokensDone: [],
    });
  });
});

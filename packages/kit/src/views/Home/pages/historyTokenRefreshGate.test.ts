import { filterAccountsNeedingTokenRefreshAfterHistory } from './historyTokenRefreshGate';

describe('filterAccountsNeedingTokenRefreshAfterHistory', () => {
  const account = { accountId: 'account-1', networkId: 'btc--0' };
  const otherNetworkAccount = { accountId: 'account-1', networkId: 'evm--1' };

  it('keeps all changed accounts when there is no recent token refresh', () => {
    expect(
      filterAccountsNeedingTokenRefreshAfterHistory({
        accounts: [account],
        lastTokensTabState: undefined,
        now: 20_000,
        minIntervalMs: 15_000,
      }),
    ).toEqual([account]);
  });

  it('skips the same account and network during the token refresh cooldown', () => {
    expect(
      filterAccountsNeedingTokenRefreshAfterHistory({
        accounts: [account, otherNetworkAccount],
        lastTokensTabState: {
          ...account,
          isRefreshing: false,
          at: 10_000,
        },
        now: 20_000,
        minIntervalMs: 15_000,
      }),
    ).toEqual([otherNetworkAccount]);
  });

  it('also treats an in-flight token refresh as a recent token activity', () => {
    expect(
      filterAccountsNeedingTokenRefreshAfterHistory({
        accounts: [account],
        lastTokensTabState: {
          ...account,
          isRefreshing: true,
          at: 18_000,
        },
        now: 20_000,
        minIntervalMs: 15_000,
      }),
    ).toEqual([]);
  });

  it('skips all changed merge-derive accounts in the same network when the indexed account refreshed tokens recently', () => {
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
      filterAccountsNeedingTokenRefreshAfterHistory({
        accounts: [nativeAccount, nestedAccount, otherNetworkAccount],
        lastTokensTabState: {
          ...indexedAccount,
          isRefreshing: false,
          at: 10_000,
        },
        tokenRefreshScope: {
          ...indexedAccount,
          includesAllAccountsInNetwork: true,
        },
        now: 20_000,
        minIntervalMs: 15_000,
      }),
    ).toEqual([otherNetworkAccount]);
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
      filterAccountsNeedingTokenRefreshAfterHistory({
        accounts: [nativeAccount],
        lastTokensTabState: {
          accountId: 'another-indexed-account',
          networkId: 'btc--0',
          isRefreshing: false,
          at: 10_000,
        },
        tokenRefreshScope: {
          ...indexedAccount,
          includesAllAccountsInNetwork: true,
        },
        now: 20_000,
        minIntervalMs: 15_000,
      }),
    ).toEqual([nativeAccount]);
  });

  it('keeps the same account and network after the cooldown expires', () => {
    expect(
      filterAccountsNeedingTokenRefreshAfterHistory({
        accounts: [account],
        lastTokensTabState: {
          ...account,
          isRefreshing: false,
          at: 1000,
        },
        now: 20_000,
        minIntervalMs: 15_000,
      }),
    ).toEqual([account]);
  });

  it('keeps the same account and network at the cooldown boundary', () => {
    expect(
      filterAccountsNeedingTokenRefreshAfterHistory({
        accounts: [account],
        lastTokensTabState: {
          ...account,
          isRefreshing: false,
          at: 5000,
        },
        now: 20_000,
        minIntervalMs: 15_000,
      }),
    ).toEqual([account]);
  });
});

import {
  evaluateWalletAssetStatus,
  getWalletAssetStatusCurrency,
  getWalletAssetStatusFromTotalBalanceUsd,
  isWalletAssetStatusAggregationComplete,
  shouldReportWalletAssetStatusChange,
  shouldReportWalletAssetStatusSnapshot,
} from './assetStatusAnalytics';

describe('TokenListBlock asset status analytics', () => {
  it('classifies total USD balance into low and funded status', () => {
    expect(getWalletAssetStatusFromTotalBalanceUsd('0')).toBe('low');
    expect(getWalletAssetStatusFromTotalBalanceUsd('0.99')).toBe('low');
    expect(getWalletAssetStatusFromTotalBalanceUsd('1')).toBe('funded');
    expect(getWalletAssetStatusFromTotalBalanceUsd('1.01')).toBe('funded');
  });

  it('ignores unavailable or invalid total balances', () => {
    expect(getWalletAssetStatusFromTotalBalanceUsd('')).toBeUndefined();
    expect(
      getWalletAssetStatusFromTotalBalanceUsd('not-a-number'),
    ).toBeUndefined();
    expect(getWalletAssetStatusFromTotalBalanceUsd('-1')).toBeUndefined();
  });

  it('reports status snapshots at most once within 24 hours', () => {
    const now = Date.UTC(2026, 5, 3, 10, 30, 0);

    expect(
      shouldReportWalletAssetStatusSnapshot({
        lastReportedAt: undefined,
        now,
      }),
    ).toBe(true);

    expect(
      shouldReportWalletAssetStatusSnapshot({
        lastReportedAt: now - 23 * 60 * 60 * 1000,
        now,
      }),
    ).toBe(false);

    expect(
      shouldReportWalletAssetStatusSnapshot({
        lastReportedAt: now - 24 * 60 * 60 * 1000,
        now,
      }),
    ).toBe(true);
  });

  it('reports status changes for low entry and later status flips', () => {
    expect(
      shouldReportWalletAssetStatusChange({
        previousStatus: undefined,
        currentStatus: 'low',
      }),
    ).toBe(true);

    expect(
      shouldReportWalletAssetStatusChange({
        previousStatus: undefined,
        currentStatus: 'funded',
      }),
    ).toBe(false);

    expect(
      shouldReportWalletAssetStatusChange({
        previousStatus: 'low',
        currentStatus: 'funded',
      }),
    ).toBe(true);

    expect(
      shouldReportWalletAssetStatusChange({
        previousStatus: 'funded',
        currentStatus: 'funded',
      }),
    ).toBe(false);
  });

  it('treats aggregation as complete only when all expected account-network pairs returned', () => {
    const expectedAccounts = [
      { accountId: 'account-1', networkId: 'evm--1' },
      { accountId: 'account-1', networkId: 'btc--0' },
    ];

    expect(
      isWalletAssetStatusAggregationComplete({
        expectedAccounts,
        result: expectedAccounts,
      }),
    ).toBe(true);

    expect(
      isWalletAssetStatusAggregationComplete({
        expectedAccounts,
        result: [{ accountId: 'account-1', networkId: 'evm--1' }],
      }),
    ).toBe(false);
  });

  it('returns a currency only when every all-network result has the same currency tag', () => {
    expect(
      getWalletAssetStatusCurrency([
        {
          tokens: { currency: 'usd' },
          smallBalanceTokens: { currency: 'usd' },
        },
        {
          tokens: { currency: 'usd' },
          smallBalanceTokens: { currency: 'usd' },
        },
      ]),
    ).toBe('usd');

    expect(
      getWalletAssetStatusCurrency([
        {
          tokens: { currency: 'usd' },
          smallBalanceTokens: { currency: 'eur' },
        },
      ]),
    ).toBeUndefined();

    expect(
      getWalletAssetStatusCurrency([
        {
          tokens: {},
          smallBalanceTokens: { currency: 'usd' },
        },
      ]),
    ).toBeUndefined();
  });

  it('evaluates the instance as low only when all eligible account values are known and total is below 1 USD', () => {
    expect(
      evaluateWalletAssetStatus({
        eligibleWalletCount: 2,
        accountValues: [
          {
            accountId: 'hd-1--0',
            currency: 'usd',
            value: {
              'hd-1--0000/0_evm--1': '0.3',
            },
          },
          {
            accountId: 'hw-1--0',
            currency: 'usd',
            value: {
              'hw-1--0000/0_btc--0': '0.4',
            },
          },
        ],
      }),
    ).toEqual({
      assetStatus: 'low',
      balanceBucket: 'lt_1_usd',
      changeReason: 'below_threshold',
      eligibleAccountCount: 2,
      eligibleWalletCount: 2,
      knownAccountCount: 2,
      totalBalanceUsd: '0.7',
      unknownAccountCount: 0,
    });
  });

  it('evaluates the instance as funded when any eligible account pushes total to at least 1 USD', () => {
    expect(
      evaluateWalletAssetStatus({
        eligibleWalletCount: 2,
        accountValues: [
          {
            accountId: 'hd-1--0',
            currency: 'usd',
            value: {
              'hd-1--0000/0_evm--1': '0',
            },
          },
          {
            accountId: 'hw-1--0',
            currency: 'usd',
            value: {
              'hw-1--0000/0_btc--0': '10',
            },
          },
        ],
      }),
    ).toMatchObject({
      assetStatus: 'funded',
      balanceBucket: 'gte_1_usd',
      changeReason: 'above_threshold',
      knownAccountCount: 2,
      totalBalanceUsd: '10',
      unknownAccountCount: 0,
    });
  });

  it('does not classify the instance when any eligible account value is unknown', () => {
    expect(
      evaluateWalletAssetStatus({
        eligibleWalletCount: 2,
        accountValues: [
          {
            accountId: 'hd-1--0',
            currency: 'usd',
            value: {
              'hd-1--0000/0_evm--1': '0',
            },
          },
          {
            accountId: 'hw-1--0',
            currency: undefined,
            value: undefined,
          },
        ],
      }),
    ).toEqual({
      eligibleAccountCount: 2,
      eligibleWalletCount: 2,
      knownAccountCount: 1,
      unknownAccountCount: 1,
    });
  });

  it('uses current all-network result as an override for the active eligible account', () => {
    expect(
      evaluateWalletAssetStatus({
        eligibleWalletCount: 1,
        accountValues: [
          {
            accountId: 'hd-1--0',
            currency: 'usd',
            value: {
              'hd-1--0000/0_evm--1': '0',
            },
          },
        ],
        currentAccountValue: {
          accountId: 'hd-1--0',
          currency: 'usd',
          value: {
            'hd-1--0000/0_evm--1': '2',
          },
        },
      }),
    ).toMatchObject({
      assetStatus: 'funded',
      totalBalanceUsd: '2',
    });
  });
});

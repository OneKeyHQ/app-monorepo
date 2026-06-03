import {
  getWalletAllNetworkLowBalanceCurrency,
  getWalletAllNetworkLowBalanceWalletType,
  isWalletAllNetworkLowBalance,
  isWalletAllNetworkLowBalanceAggregationComplete,
  shouldReportWalletAllNetworkLowBalance,
} from './allNetworkLowBalanceAnalytics';

describe('TokenListBlock all-network low-balance analytics', () => {
  it('treats balances below 1 USD as low balance only', () => {
    expect(isWalletAllNetworkLowBalance('0')).toBe(true);
    expect(isWalletAllNetworkLowBalance('0.99')).toBe(true);
    expect(isWalletAllNetworkLowBalance('1')).toBe(false);
    expect(isWalletAllNetworkLowBalance('1.01')).toBe(false);
  });

  it('ignores unavailable or invalid balances', () => {
    expect(isWalletAllNetworkLowBalance('')).toBe(false);
    expect(isWalletAllNetworkLowBalance('not-a-number')).toBe(false);
  });

  it('reports at most once within 24 hours when the all-network balance is below 1 USD', () => {
    const now = Date.UTC(2026, 5, 3, 10, 30, 0);

    expect(
      shouldReportWalletAllNetworkLowBalance({
        totalBalanceUsd: '0.5',
        currency: 'usd',
        aggregationComplete: true,
        lastReportedAt: undefined,
        now,
      }),
    ).toBe(true);

    expect(
      shouldReportWalletAllNetworkLowBalance({
        totalBalanceUsd: '0.5',
        currency: 'usd',
        aggregationComplete: true,
        lastReportedAt: now - 23 * 60 * 60 * 1000,
        now,
      }),
    ).toBe(false);

    expect(
      shouldReportWalletAllNetworkLowBalance({
        totalBalanceUsd: '0.5',
        currency: 'usd',
        aggregationComplete: true,
        lastReportedAt: now - 24 * 60 * 60 * 1000,
        now,
      }),
    ).toBe(true);
  });

  it('does not report when the balance is at least 1 USD', () => {
    expect(
      shouldReportWalletAllNetworkLowBalance({
        totalBalanceUsd: '1',
        currency: 'usd',
        aggregationComplete: true,
        lastReportedAt: undefined,
        now: Date.UTC(2026, 5, 3),
      }),
    ).toBe(false);
  });

  it('does not report when the all-network aggregation is incomplete', () => {
    expect(
      shouldReportWalletAllNetworkLowBalance({
        totalBalanceUsd: '0.5',
        currency: 'usd',
        aggregationComplete: false,
        lastReportedAt: undefined,
        now: Date.UTC(2026, 5, 3),
      }),
    ).toBe(false);
  });

  it('does not report when the balance is not USD based', () => {
    expect(
      shouldReportWalletAllNetworkLowBalance({
        totalBalanceUsd: '0.5',
        currency: 'eur',
        aggregationComplete: true,
        lastReportedAt: undefined,
        now: Date.UTC(2026, 5, 3),
      }),
    ).toBe(false);
  });

  it('only supports HD, hardware, and QR wallet types', () => {
    expect(getWalletAllNetworkLowBalanceWalletType('hd')).toBe('hd');
    expect(getWalletAllNetworkLowBalanceWalletType('hw')).toBe('hw');
    expect(getWalletAllNetworkLowBalanceWalletType('qr')).toBe('qr');
    expect(getWalletAllNetworkLowBalanceWalletType('watching')).toBeUndefined();
    expect(getWalletAllNetworkLowBalanceWalletType('imported')).toBeUndefined();
    expect(getWalletAllNetworkLowBalanceWalletType('external')).toBeUndefined();
    expect(getWalletAllNetworkLowBalanceWalletType(undefined)).toBeUndefined();
  });

  it('treats aggregation as complete only when all expected account-network pairs returned', () => {
    const expectedAccounts = [
      { accountId: 'account-1', networkId: 'evm--1' },
      { accountId: 'account-1', networkId: 'btc--0' },
    ];

    expect(
      isWalletAllNetworkLowBalanceAggregationComplete({
        expectedAccounts,
        result: expectedAccounts,
      }),
    ).toBe(true);

    expect(
      isWalletAllNetworkLowBalanceAggregationComplete({
        expectedAccounts,
        result: [{ accountId: 'account-1', networkId: 'evm--1' }],
      }),
    ).toBe(false);
  });

  it('returns a currency only when every all-network result has the same currency tag', () => {
    expect(
      getWalletAllNetworkLowBalanceCurrency([
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
      getWalletAllNetworkLowBalanceCurrency([
        {
          tokens: { currency: 'usd' },
          smallBalanceTokens: { currency: 'eur' },
        },
      ]),
    ).toBeUndefined();

    expect(
      getWalletAllNetworkLowBalanceCurrency([
        {
          tokens: {},
          smallBalanceTokens: { currency: 'usd' },
        },
      ]),
    ).toBeUndefined();
  });
});

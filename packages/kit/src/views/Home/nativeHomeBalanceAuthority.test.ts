import fs from 'fs';
import path from 'path';

import {
  type INativeHomeBalanceAuthority,
  getNativeHomeLastConfirmedBalance,
  hasNativeHomeNonZeroWorth,
  hasNativeHomePortfolioHoldings,
  resolveNativeHomeBalanceState,
  resolveNativeHomeFundedHoldings,
  resolveNativeHomeHeaderActionPresentation,
  resolveNativeHomeWalletScopedBalanceState,
} from './nativeHomeBalanceAuthority';

const currentScopeKey = 'wallet-b__account-b__network-b';

const success = (scopeKey = currentScopeKey): INativeHomeBalanceAuthority => ({
  generation: 1,
  scopeKey,
  status: 'success',
});

const resolve = ({
  hasCurrentPositiveBalance = false,
  hasHoldings = false,
  hasWallet = true,
  lastConfirmedBalanceIsPositive,
  portfolioAuthority = success(),
}: {
  hasCurrentPositiveBalance?: boolean;
  hasHoldings?: boolean;
  hasWallet?: boolean;
  lastConfirmedBalanceIsPositive?: boolean;
  portfolioAuthority?: INativeHomeBalanceAuthority;
} = {}) =>
  resolveNativeHomeBalanceState({
    currentScopeKey,
    hasCurrentPositiveBalance,
    hasHoldings,
    hasWallet,
    lastConfirmedBalanceIsPositive,
    portfolioAuthority,
  });

describe('resolveNativeHomeBalanceState', () => {
  it('matches Legacy zero behavior when DeFi partially fails after current token success', () => {
    expect(resolve()).toBe('zero');
    expect(resolveNativeHomeHeaderActionPresentation(resolve())).toEqual({
      actionLayout: 'zeroBalance',
      rowHeight: 82,
      slotKind: 'zero',
    });
  });

  it('keeps exact-owner cached positive above an otherwise empty current snapshot', () => {
    expect(resolve({ lastConfirmedBalanceIsPositive: true })).toBe('positive');
  });

  it('treats a negative exact-owner cache as non-zero positive state', () => {
    expect(
      resolve({
        lastConfirmedBalanceIsPositive: hasNativeHomeNonZeroWorth(['-1']),
      }),
    ).toBe('positive');
  });

  it('allows an exact-owner cached zero while current sources reload', () => {
    expect(
      resolve({
        lastConfirmedBalanceIsPositive: false,
        portfolioAuthority: {
          generation: 2,
          scopeKey: currentScopeKey,
          status: 'loading',
        },
      }),
    ).toBe('zero');
  });

  it('promotes any current known-positive signal before authority errors', () => {
    expect(
      resolve({
        hasCurrentPositiveBalance: true,
        portfolioAuthority: {
          generation: 2,
          scopeKey: currentScopeKey,
          status: 'error',
        },
      }),
    ).toBe('positive');
  });

  it('treats a current scoped negative DeFi total as non-zero positive state', () => {
    expect(
      resolve({
        hasCurrentPositiveBalance: hasNativeHomeNonZeroWorth([-1]),
      }),
    ).toBe('positive');
  });

  it('keeps an old-scope or failed portfolio unknown without a cache', () => {
    expect(
      resolve({
        portfolioAuthority: success('wallet-a__account-a__network-a'),
      }),
    ).toBe('unknown');
    expect(
      resolve({
        portfolioAuthority: {
          generation: 2,
          scopeKey: currentScopeKey,
          status: 'error',
        },
      }),
    ).toBe('unknown');
    expect(resolveNativeHomeHeaderActionPresentation('unknown')).toEqual({
      actionLayout: 'standard',
      rowHeight: 62,
      slotKind: 'positive',
    });
  });

  it('keeps a missing wallet unknown even if stale positive values exist', () => {
    expect(
      resolve({
        hasCurrentPositiveBalance: true,
        hasWallet: false,
        lastConfirmedBalanceIsPositive: true,
      }),
    ).toBe('unknown');
  });
});

describe('Native Home balance source ownership', () => {
  it('does not read accountWorth without an exact network owner', () => {
    const source = fs.readFileSync(
      path.join(__dirname, 'NativeHomePage.native.tsx'),
      'utf8',
    );

    expect(source).not.toContain('useAccountWorthAtom');
    expect(source).not.toContain('liveOverviewBalanceIsPositive');
  });
});

describe('Native Home exact-owner cache', () => {
  it('does not use wallet, indexed-account, or latest-owner values', () => {
    const byOwner = {
      'wallet-b__network-b': '10',
      'indexed-b__network-b': '20',
      'account-a__network-b': '30',
    };
    expect(
      getNativeHomeLastConfirmedBalance({
        accountId: 'account-b',
        byOwner,
        networkId: 'network-b',
      }),
    ).toBeUndefined();
    expect(
      getNativeHomeLastConfirmedBalance({
        accountId: 'account-a',
        byOwner,
        networkId: 'network-b',
      }),
    ).toBe('30');
  });
});

describe('Native Home funded holdings', () => {
  it('treats a small-balance-only token as funded', () => {
    expect(
      hasNativeHomePortfolioHoldings({
        map: {},
        smallBalanceMap: {
          small: { balanceParsed: '0.1' },
        },
      }),
    ).toBe(true);
  });

  it('does not include a risk-only token in the funded signal', () => {
    expect(
      hasNativeHomePortfolioHoldings({
        map: {},
        riskMap: { risk: { balanceParsed: '10' } },
        smallBalanceMap: {},
      }),
    ).toBe(false);
    expect(resolve({ hasHoldings: false })).toBe('zero');
  });

  it('latches an unpriced funded owner across a progressive refresh', () => {
    const owner = {
      accountId: 'account-unpriced-refresh',
      networkId: 'network-unpriced-refresh',
    };
    expect(
      resolveNativeHomeFundedHoldings({ ...owner, hasHoldingsNow: true }),
    ).toBe(true);
    expect(
      resolveNativeHomeFundedHoldings({ ...owner, hasHoldingsNow: false }),
    ).toBe(true);
  });
});

describe('Native Home wallet-scoped sticky state', () => {
  it('bridges unknown owners inside one wallet', () => {
    const positive = resolveNativeHomeWalletScopedBalanceState({
      computed: 'positive',
      previous: { state: 'unknown', walletId: undefined },
      walletId: 'wallet-a',
    });
    expect(
      resolveNativeHomeWalletScopedBalanceState({
        computed: 'unknown',
        previous: positive.sticky,
        walletId: 'wallet-a',
      }).state,
    ).toBe('positive');
  });

  it('does not leak a sticky positive state across wallets', () => {
    expect(
      resolveNativeHomeWalletScopedBalanceState({
        computed: 'unknown',
        previous: { state: 'positive', walletId: 'wallet-a' },
        walletId: 'wallet-b',
      }),
    ).toEqual({
      state: 'unknown',
      sticky: { state: 'unknown', walletId: 'wallet-b' },
    });
  });
});

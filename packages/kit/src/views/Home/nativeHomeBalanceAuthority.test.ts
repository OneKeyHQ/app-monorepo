import fs from 'fs';
import path from 'path';

import {
  type INativeHomeBalanceAuthority,
  NATIVE_HOME_BALANCE_SCOPE_CACHE_LIMIT,
  getNativeHomeLastConfirmedBalance,
  hasNativeHomeNonZeroWorth,
  hasNativeHomePortfolioHoldings,
  resolveNativeHomeBalanceState,
  resolveNativeHomeConfirmedBalanceIsPositive,
  resolveNativeHomeFundedHoldings,
  resolveNativeHomeHeaderActionPresentation,
  resolveNativeHomeScopeCachedBalanceState,
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

  it('keeps invalid exact-owner cache unknown while preserving valid zero', () => {
    const loadingAuthority: INativeHomeBalanceAuthority = {
      generation: 2,
      scopeKey: currentScopeKey,
      status: 'loading',
    };
    expect(resolveNativeHomeConfirmedBalanceIsPositive('--')).toBeUndefined();
    expect(
      resolve({
        lastConfirmedBalanceIsPositive:
          resolveNativeHomeConfirmedBalanceIsPositive('--'),
        portfolioAuthority: loadingAuthority,
      }),
    ).toBe('unknown');
    expect(resolveNativeHomeConfirmedBalanceIsPositive('0')).toBe(false);
    expect(
      resolve({
        lastConfirmedBalanceIsPositive:
          resolveNativeHomeConfirmedBalanceIsPositive('0'),
        portfolioAuthority: loadingAuthority,
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
      actionLayout: 'loading',
      rowHeight: 82,
      slotKind: 'loading',
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

  it('renders loading balance and action slots as neutral non-interactive content', () => {
    const source = fs.readFileSync(
      path.join(__dirname, 'NativeHomePage.native.tsx'),
      'utf8',
    );
    const balanceLoadingBlock = source.slice(
      source.indexOf(
        "if (headerBalanceAmountPresentation.status === 'loading')",
      ),
      source.indexOf(
        "interaction: 'tap' as const",
        source.indexOf('const balanceSlot'),
      ),
    );
    const actionSlotStart = source.indexOf(
      "if (headerActionPresentation.slotKind === 'loading')",
      source.indexOf('const headerActionRowSlot'),
    );
    const actionLoadingBlock = source.slice(
      actionSlotStart,
      source.indexOf(
        "if (headerActionPresentation.slotKind === 'zero')",
        actionSlotStart,
      ),
    );
    expect(balanceLoadingBlock).toContain("interaction: 'none' as const");
    expect(balanceLoadingBlock).toContain('<Skeleton.Heading5Xl');
    expect(balanceLoadingBlock).not.toContain('onPress=');
    expect(actionLoadingBlock).toContain("interaction: 'none' as const");
    expect(actionLoadingBlock).toContain('<Skeleton');
    expect(actionLoadingBlock).not.toContain('onPress=');
    expect(actionLoadingBlock).not.toContain('testID=');
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

describe('Native Home exact-scope balance cache', () => {
  it('reuses known state only for the exact home balance scope', () => {
    const positive = resolveNativeHomeScopeCachedBalanceState({
      computed: 'positive',
      previous: { entries: [] },
      scopeKey: 'wallet-a__account-a__network-a',
    });
    expect(
      resolveNativeHomeScopeCachedBalanceState({
        computed: 'unknown',
        previous: positive.cache,
        scopeKey: 'wallet-a__account-a__network-a',
      }).state,
    ).toBe('positive');
    expect(
      resolveNativeHomeScopeCachedBalanceState({
        computed: 'unknown',
        previous: positive.cache,
        scopeKey: 'wallet-a__account-b__network-a',
      }).state,
    ).toBe('unknown');
  });

  it('keeps error or retry unknown when the exact scope has no cache', () => {
    expect(
      resolveNativeHomeScopeCachedBalanceState({
        computed: 'unknown',
        previous: {
          entries: [
            {
              scopeKey: 'wallet-a__account-a__network-a',
              state: 'positive',
            },
          ],
        },
        scopeKey: 'wallet-a__account-b__network-a',
      }).state,
    ).toBe('unknown');
  });

  it('bounds the per-view cache while retaining the newest exact scopes', () => {
    let cache: Parameters<
      typeof resolveNativeHomeScopeCachedBalanceState
    >[0]['previous'] = { entries: [] };
    for (
      let index = 0;
      index <= NATIVE_HOME_BALANCE_SCOPE_CACHE_LIMIT;
      index += 1
    ) {
      cache = resolveNativeHomeScopeCachedBalanceState({
        computed: index % 2 === 0 ? 'positive' : 'zero',
        previous: cache,
        scopeKey: `wallet__account-${index}__network`,
      }).cache;
    }
    expect(cache.entries).toHaveLength(NATIVE_HOME_BALANCE_SCOPE_CACHE_LIMIT);
    expect(cache.entries[0]?.scopeKey).toBe('wallet__account-1__network');
    expect(cache.entries.at(-1)?.scopeKey).toBe(
      `wallet__account-${NATIVE_HOME_BALANCE_SCOPE_CACHE_LIMIT}__network`,
    );
  });
});

import {
  resolveHomeOverviewBalanceHold,
  resolveHomePortfolioSnapshot,
  shouldIncludeKnownDeFiWorth,
} from './homeOverviewBalanceHold';

/*
yarn jest packages/kit/src/views/Home/pages/homeOverviewBalanceHold.test.ts
*/

const base = {
  isAllNetworks: true,
  hasConfirmedBalance: true,
  isTokenWorthReady: true,
  isTokenSnapshotCommitted: true,
  isDeFiReady: false,
  isDeFiRefreshing: false,
  deFiGraceExpired: false,
};

describe('resolveHomeOverviewBalanceHold', () => {
  it('never holds outside All Networks', () => {
    expect(
      resolveHomeOverviewBalanceHold({ ...base, isAllNetworks: false }),
    ).toEqual({ shouldHold: false, shouldArmDeFiGrace: false });
  });

  it('has nothing to hold without a confirmed balance', () => {
    expect(
      resolveHomeOverviewBalanceHold({ ...base, hasConfirmedBalance: false }),
    ).toEqual({ shouldHold: false, shouldArmDeFiGrace: true });
  });

  it('holds while the token fan-out is still progressive', () => {
    expect(
      resolveHomeOverviewBalanceHold({
        ...base,
        isTokenSnapshotCommitted: false,
      }),
    ).toEqual({ shouldHold: true, shouldArmDeFiGrace: false });
  });

  it('releases as soon as both token and DeFi are ready', () => {
    expect(
      resolveHomeOverviewBalanceHold({ ...base, isDeFiReady: true }),
    ).toEqual({ shouldHold: false, shouldArmDeFiGrace: false });
  });

  it('keeps holding during the DeFi grace window after the token commit', () => {
    expect(resolveHomeOverviewBalanceHold(base)).toEqual({
      shouldHold: true,
      shouldArmDeFiGrace: true,
    });
  });

  it('releases the live total when DeFi never reports within the grace window', () => {
    // Regression for the iOS log where the cache-only DeFi hook never ran:
    // the header stayed on a persisted total for the whole session while the
    // token list already showed live values.
    expect(
      resolveHomeOverviewBalanceHold({ ...base, deFiGraceExpired: true }),
    ).toEqual({ shouldHold: false, shouldArmDeFiGrace: true });
  });

  it('does not let an expired grace release a still-progressive token side', () => {
    expect(
      resolveHomeOverviewBalanceHold({
        ...base,
        isTokenSnapshotCommitted: false,
        deFiGraceExpired: true,
      }),
    ).toEqual({ shouldHold: true, shouldArmDeFiGrace: false });
  });

  it('does not start the grace from a stale token commit while DeFi is refreshing', () => {
    // A warm refresh never resets `updateAll`, so the token side still looks
    // committed while the DeFi run has reset its readiness. The run will
    // write readiness back when it finishes; the header must keep holding
    // instead of dropping DeFi after the window.
    expect(
      resolveHomeOverviewBalanceHold({ ...base, isDeFiRefreshing: true }),
    ).toEqual({ shouldHold: true, shouldArmDeFiGrace: false });
  });

  it('keeps the released live total while DeFi refreshes after the grace expired', () => {
    // DeFi never reported for this owner and the grace already released the
    // header; a later DeFi run must not pin it back on the stale confirmed
    // total for the length of the run.
    expect(
      resolveHomeOverviewBalanceHold({
        ...base,
        isDeFiRefreshing: true,
        deFiGraceExpired: true,
      }),
    ).toEqual({ shouldHold: false, shouldArmDeFiGrace: false });
  });
});

describe('shouldIncludeKnownDeFiWorth', () => {
  const worthBase = {
    isAllNetworks: true,
    isDeFiReady: false,
    deFiGraceExpired: false,
    isDeFiOverviewOwnerMatched: true,
  };

  it('always includes DeFi outside All Networks', () => {
    expect(
      shouldIncludeKnownDeFiWorth({ ...worthBase, isAllNetworks: false }),
    ).toBe(true);
  });

  it('includes DeFi once it reported for this owner', () => {
    expect(
      shouldIncludeKnownDeFiWorth({ ...worthBase, isDeFiReady: true }),
    ).toBe(true);
  });

  it('excludes DeFi while the hold is still waiting for it', () => {
    expect(shouldIncludeKnownDeFiWorth(worthBase)).toBe(false);
  });

  it('keeps the last same-owner DeFi value after the grace released the hold', () => {
    // A warm refresh never clears the overview atom; zeroing it here would
    // drop the header by the whole DeFi position until DeFi reports again.
    expect(
      shouldIncludeKnownDeFiWorth({ ...worthBase, deFiGraceExpired: true }),
    ).toBe(true);
  });

  it("never borrows another owner's DeFi value after the grace released", () => {
    expect(
      shouldIncludeKnownDeFiWorth({
        ...worthBase,
        deFiGraceExpired: true,
        isDeFiOverviewOwnerMatched: false,
      }),
    ).toBe(false);
  });
});

describe('Home portfolio snapshot shared with hardware sync', () => {
  const previous = {
    ownerKey: 'account-1__all',
    totalFiatUsd: '160',
    tokenFiatUsd: '100',
    defiFiatUsd: '40',
    perpsFiatUsd: '20',
    isLive: true,
  };
  const candidate = {
    ...previous,
    totalFiatUsd: '190',
    tokenFiatUsd: '110',
    defiFiatUsd: '50',
    perpsFiatUsd: '30',
  };

  it('keeps held categories with the unchanged rendered total during refresh or failure', () => {
    const pending = resolveHomePortfolioSnapshot({
      previous,
      candidate: { ...candidate, totalFiatUsd: '160' },
      isReady: false,
    });
    expect(pending).toEqual({ ...previous, isLive: false });
    expect(
      resolveHomePortfolioSnapshot({
        previous: pending,
        candidate: {
          ownerKey: previous.ownerKey,
          totalFiatUsd: '160',
          isLive: false,
        },
        isReady: false,
      }),
    ).toEqual(pending);
  });

  it('publishes the completed total and all categories together', () => {
    expect(
      resolveHomePortfolioSnapshot({ previous, candidate, isReady: true }),
    ).toEqual(candidate);
  });

  it('makes a cached displayed total available immediately without waiting for categories', () => {
    expect(
      resolveHomePortfolioSnapshot({
        previous: { ownerKey: '', isLive: false },
        candidate: {
          ownerKey: previous.ownerKey,
          totalFiatUsd: '160',
          isLive: false,
        },
        isReady: false,
      }),
    ).toEqual({
      ownerKey: previous.ownerKey,
      totalFiatUsd: '160',
      isLive: false,
    });
  });

  it('never carries old categories over to a different displayed total', () => {
    expect(
      resolveHomePortfolioSnapshot({ previous, candidate, isReady: false }),
    ).toEqual({
      ownerKey: previous.ownerKey,
      totalFiatUsd: '190',
      isLive: false,
    });
  });

  it.each(['tokenFiatUsd', 'defiFiatUsd', 'perpsFiatUsd'] as const)(
    'does not replace an unavailable %s with a stale value or zero',
    (field) => {
      expect(
        resolveHomePortfolioSnapshot({
          previous,
          candidate: { ...candidate, [field]: undefined },
          isReady: true,
        }),
      ).toEqual({ ...candidate, [field]: undefined });
    },
  );

  it('does not carry another account categories into the next owner', () => {
    expect(
      resolveHomePortfolioSnapshot({
        previous,
        candidate: { ...candidate, ownerKey: 'account-2__all' },
        isReady: false,
      }),
    ).toEqual({
      ownerKey: 'account-2__all',
      totalFiatUsd: '190',
      isLive: false,
    });
  });

  it('does not reuse any total when the current owner has no rendered balance', () => {
    expect(
      resolveHomePortfolioSnapshot({
        previous,
        candidate: { ownerKey: previous.ownerKey, isLive: false },
        isReady: false,
      }),
    ).toEqual({ ownerKey: previous.ownerKey, isLive: false });
  });

  it('accepts a completed zero balance', () => {
    const zero = {
      ...candidate,
      totalFiatUsd: '0',
      tokenFiatUsd: '0',
      defiFiatUsd: '0',
      perpsFiatUsd: '0',
    };
    expect(
      resolveHomePortfolioSnapshot({
        previous,
        candidate: zero,
        isReady: true,
      }),
    ).toEqual(zero);
  });
});

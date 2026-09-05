import {
  resolveHomeOverviewBalanceHold,
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

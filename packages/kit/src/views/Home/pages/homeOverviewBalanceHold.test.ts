import { resolveHomeOverviewBalanceHold } from './homeOverviewBalanceHold';

/*
yarn jest packages/kit/src/views/Home/pages/homeOverviewBalanceHold.test.ts
*/

const base = {
  isAllNetworks: true,
  hasConfirmedBalance: true,
  isTokenWorthReady: true,
  isTokenSnapshotCommitted: true,
  isDeFiReady: false,
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
});

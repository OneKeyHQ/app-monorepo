/**
 * TokenList cells — cell-seam GATE tests (PR-S blocker #1 regression).
 *
 * `resolveUseCellSeam` decides whether a `<TokenListView>` mount binds its
 * leaves to the per-key cells (HOME projection path). The home mount passes
 * `scopedActiveAccountTokenListMap={}` (from `useState({})`), which is NOT
 * `undefined`. The OLD truthiness gate (`!props.scopedActiveAccountTokenListMap`)
 * was always `false` for `{}` → the seam was DEAD on home.
 *
 * The first case below (home config: enableCellSeam, scoped map = {}, not
 * selector, not active-account) MUST be `true`. It FAILS on the old gate and
 * PASSES after the fix.
 *
 * Pure / node — no React / jotai / native.
 */
import type { ITokenFiat } from '@onekeyhq/shared/types/token';

import { hasActiveScopedOverride, resolveUseCellSeam } from '../cells/seamGate';

function makeFiat(): ITokenFiat {
  return { balance: '1', balanceParsed: '1', fiatValue: '1', price: 1 };
}

describe('resolveUseCellSeam — home seam activation (blocker #1)', () => {
  it('home config (enableCellSeam, scoped map = {}, not selector, not active-account) → true', () => {
    // This is the EXACT shape the home <TokenListView> mounts with. It FAILS on
    // the old `!props.scopedActiveAccountTokenListMap` gate (`!{}` === false).
    expect(
      resolveUseCellSeam({
        enableCellSeam: true,
        isTokenSelector: false,
        showActiveAccountTokenList: false,
        scopedActiveAccountTokenListMap: {},
      }),
    ).toBe(true);
  });

  it('home config with scoped map undefined → true', () => {
    expect(
      resolveUseCellSeam({
        enableCellSeam: true,
        isTokenSelector: false,
        showActiveAccountTokenList: false,
        scopedActiveAccountTokenListMap: undefined,
      }),
    ).toBe(true);
  });

  it('populated scoped LP map → false (seam OFF in LP-dapp mode)', () => {
    expect(
      resolveUseCellSeam({
        enableCellSeam: true,
        isTokenSelector: false,
        showActiveAccountTokenList: false,
        scopedActiveAccountTokenListMap: { 'eth__0xabc': makeFiat() },
      }),
    ).toBe(false);
  });

  it('isTokenSelector → false', () => {
    expect(
      resolveUseCellSeam({
        enableCellSeam: true,
        isTokenSelector: true,
        showActiveAccountTokenList: false,
        scopedActiveAccountTokenListMap: {},
      }),
    ).toBe(false);
  });

  it('showActiveAccountTokenList → false', () => {
    expect(
      resolveUseCellSeam({
        enableCellSeam: true,
        isTokenSelector: false,
        showActiveAccountTokenList: true,
        scopedActiveAccountTokenListMap: {},
      }),
    ).toBe(false);
  });

  it('enableCellSeam off → false', () => {
    expect(
      resolveUseCellSeam({
        enableCellSeam: false,
        isTokenSelector: false,
        showActiveAccountTokenList: false,
        scopedActiveAccountTokenListMap: {},
      }),
    ).toBe(false);
  });
});

describe('hasActiveScopedOverride', () => {
  it('undefined → false', () => {
    expect(hasActiveScopedOverride(undefined)).toBe(false);
  });
  it('empty object → false', () => {
    expect(hasActiveScopedOverride({})).toBe(false);
  });
  it('populated → true', () => {
    expect(hasActiveScopedOverride({ 'eth__0xabc': makeFiat() })).toBe(true);
  });
});

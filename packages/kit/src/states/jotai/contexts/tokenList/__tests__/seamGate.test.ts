/**
 * TokenList cells — cell-seam GATE tests (PR-S blocker #1 regression).
 *
 * `resolveUseCellSeam` decides whether a `<TokenListView>` mount binds its
 * leaves to the per-key cells (HOME projection path). Two regressions anchor
 * this suite:
 *
 * 1. (blocker #1) The home mount passes `scopedActiveAccountTokenListMap={}`
 *    (from `useState({})`), which is NOT `undefined`. The OLD truthiness gate
 *    (`!props.scopedActiveAccountTokenListMap`) was always `false` for `{}` →
 *    the seam was DEAD on home.
 * 2. (DeFi-switch residue) The gate later keyed on the scoped map's CONTENT
 *    (`hasActiveScopedOverride`). Turning the home DeFi-token switch OFF left
 *    the last populated scoped LP map in component state, which kept the seam
 *    OFF while `showActiveAccountTokenList` was already false — and the legacy
 *    path has NO data source on home (hostTokenList is undefined), so the home
 *    list rendered empty until a remount. The gate therefore takes NO map
 *    input at all: display-mode flags are the only authority, data residue can
 *    never flip the render path.
 *
 * Pure / node — no React / jotai / native.
 */
import type { ITokenFiat } from '@onekeyhq/shared/types/token';

import { hasActiveScopedOverride, resolveUseCellSeam } from '../cells/seamGate';

function makeFiat(): ITokenFiat {
  return { balance: '1', balanceParsed: '1', fiatValue: '1', price: 1 };
}

describe('resolveUseCellSeam — home seam activation', () => {
  it('home config (enableCellSeam, not selector, not active-account) → true', () => {
    // The EXACT shape the home <TokenListView> mounts with — including after
    // the DeFi-token switch turns OFF while a residual scoped LP map is still
    // held in TokenListBlock state (the map is not a gate input).
    expect(
      resolveUseCellSeam({
        enableCellSeam: true,
        isTokenSelector: false,
        showActiveAccountTokenList: false,
      }),
    ).toBe(true);
  });

  it('LP-dapp mode (showActiveAccountTokenList) → false', () => {
    expect(
      resolveUseCellSeam({
        enableCellSeam: true,
        isTokenSelector: false,
        showActiveAccountTokenList: true,
      }),
    ).toBe(false);
  });

  it('isTokenSelector → false', () => {
    expect(
      resolveUseCellSeam({
        enableCellSeam: true,
        isTokenSelector: true,
        showActiveAccountTokenList: false,
      }),
    ).toBe(false);
  });

  it('enableCellSeam off → false', () => {
    expect(
      resolveUseCellSeam({
        enableCellSeam: false,
        isTokenSelector: false,
        showActiveAccountTokenList: false,
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

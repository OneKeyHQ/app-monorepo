import type { ISizableTextProps } from '@onekeyhq/components';

// Hero balances (home total, token detail) render at 48px on one line. A
// formatted value that outgrows the row — e.g. a multi-billion watch-only
// wallet — used to run past the screen edge on phones (OK-65121). Shrink the
// font to fit instead; the floor keeps a trillion-dollar value readable on
// the narrowest supported phone width.
export const HERO_BALANCE_FIT_PROPS: Pick<
  ISizableTextProps,
  'numberOfLines' | 'adjustsFontSizeToFit' | 'minimumFontScale'
> = {
  numberOfLines: 1,
  adjustsFontSizeToFit: true,
  minimumFontScale: 0.5,
};

// The total never shares a row with the actions here, and the props above
// already shrink it to fit.
export function useHeroBalanceRowFit(_inBalanceRow: boolean) {
  return { ref: undefined, fontSize: 48 };
}

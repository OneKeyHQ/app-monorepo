import type { ISizableTextProps } from '@onekeyhq/components';

// Hero balances (home total, token detail) render at 48px on one line. On
// web the value keeps its natural size: `adjustsFontSizeToFit` is a native
// Text feature and `numberOfLines` alone would only ellipsize here. The
// native variant (`heroBalanceFit.native.ts`) shrinks the font instead
// (OK-65121).
export const HERO_BALANCE_FIT_PROPS: Pick<
  ISizableTextProps,
  'numberOfLines' | 'adjustsFontSizeToFit' | 'minimumFontScale'
> = {};

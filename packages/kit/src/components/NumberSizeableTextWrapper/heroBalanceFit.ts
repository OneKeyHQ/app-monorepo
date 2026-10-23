import platformEnv from '@onekeyhq/shared/src/platformEnv';

// Hero balances (home total, token detail) render at 48px on one line. A
// formatted value that outgrows the row — e.g. a multi-billion watch-only
// wallet — used to run past the screen edge on phones (OK-65121). Native
// shrinks the font to fit instead; web keeps its natural size because
// `adjustsFontSizeToFit` is native-only and `numberOfLines` would merely
// ellipsize there. The floor keeps a trillion-dollar value readable on the
// narrowest supported phone width.
export const HERO_BALANCE_FIT_PROPS = platformEnv.isNative
  ? ({
      numberOfLines: 1,
      adjustsFontSizeToFit: true,
      minimumFontScale: 0.5,
    } as const)
  : ({} as const);

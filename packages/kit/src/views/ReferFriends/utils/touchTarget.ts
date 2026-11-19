import platformEnv from '@onekeyhq/shared/src/platformEnv';

// NATIVE_HIT_SLOP's vertical half, for segments that sit edge to edge: their
// touch areas grow to 44px tall without overlapping each other sideways.
export const NATIVE_VERTICAL_HIT_SLOP = platformEnv.isNative
  ? { top: 8, bottom: 8 }
  : undefined;

// Medium icon buttons are 36px; this brings them to 44px.
export const NATIVE_MEDIUM_ICON_HIT_SLOP = platformEnv.isNative
  ? { top: 4, bottom: 4, left: 4, right: 4 }
  : undefined;

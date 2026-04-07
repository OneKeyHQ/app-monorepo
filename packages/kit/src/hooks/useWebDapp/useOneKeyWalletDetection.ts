import {
  initMipdGlue,
  useOneKeyWalletDetection,
} from './useOneKeyWalletDetectionCore';

// ---------------------------------------------------------------------------
// React-Native stub: no mipd store (browser APIs unavailable on RN).
// The full browser implementation lives in the `.web-only.ts` variant.
// ---------------------------------------------------------------------------
initMipdGlue(undefined);

export { useOneKeyWalletDetection };

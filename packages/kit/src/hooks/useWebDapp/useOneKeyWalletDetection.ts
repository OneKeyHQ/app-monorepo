import { createStore } from 'mipd';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import {
  initMipdGlue,
  useOneKeyWalletDetection,
} from './useOneKeyWalletDetectionCore';

// ---------------------------------------------------------------------------
// Default (React Native / non-browser): only create the mipd store in
// extension/web environments where browser APIs are available.
// ---------------------------------------------------------------------------
const sharedMipdStore =
  typeof globalThis !== 'undefined' &&
  (platformEnv.isExtension || platformEnv.isWeb)
    ? createStore()
    : undefined;

initMipdGlue(sharedMipdStore);

export { useOneKeyWalletDetection };

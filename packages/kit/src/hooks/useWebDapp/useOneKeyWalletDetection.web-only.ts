import { createStore } from 'mipd';

import {
  initMipdGlue,
  useOneKeyWalletDetection,
} from './useOneKeyWalletDetectionCore';

// ---------------------------------------------------------------------------
// Web-only: mipd store is always available in browser environments.
// ---------------------------------------------------------------------------
initMipdGlue(createStore());

export { useOneKeyWalletDetection };

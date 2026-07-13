import appGlobals from '@onekeyhq/shared/src/appGlobals';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ensureRunOnBackground } from '@onekeyhq/shared/src/utils/assertUtils';

import { SimpleDb } from './base/SimpleDb';

// eslint-disable-next-line import/no-mutable-exports
let simpleDb: SimpleDb;

// simpleDb must have a single writer: the background runtime. UI runtimes
// must go through backgroundApiProxy.simpleDb (SimpleDbProxy) instead:
// - Extension UI: also hard-blocked at module load by ensureRunOnBackground()
//   below.
// - Native UI/main runtime with the split background thread enabled: blocked
//   lazily on first property access (mirrors
//   ensureLocalDbNotOnNativeMainThread for localDb), so that accidentally
//   pulling this module into the main bundle graph does not crash startup
//   unless simpleDb is actually used. The single-runtime native fallback
//   (no split bg thread) legitimately uses simpleDb on its only runtime.
const isForbiddenUiRuntime =
  platformEnv.isExtensionUi ||
  (!platformEnv.isJest &&
    platformEnv.enableNativeBackgroundThread &&
    platformEnv.isNativeMainThread);

if (isForbiddenUiRuntime) {
  simpleDb = new Proxy(
    {},
    {
      get() {
        throw new OneKeyLocalError(
          '[simpleDb] is NOT allowed in UI process currently, use backgroundApiProxy.simpleDb instead.',
        );
      },
    },
  ) as SimpleDb;
} else {
  simpleDb = new SimpleDb();
}

if (process.env.NODE_ENV !== 'production') {
  appGlobals.$$simpleDb = simpleDb;
}

ensureRunOnBackground();

export default simpleDb;

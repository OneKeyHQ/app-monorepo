import BackgroundApiProxy from '@onekeyhq/kit-bg/src/apis/BackgroundApiProxy';
import appGlobals from '@onekeyhq/shared/src/appGlobals';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiInit from './backgroundApiInit';

import type { IBackgroundApi } from '@onekeyhq/kit-bg/src/apis/IBackgroundApi';

let backgroundApi = null;

const shouldDeferLocalBackgroundApi =
  platformEnv.isNativeMainThread && platformEnv.enableNativeBackgroundThread;

if (!platformEnv.isExtensionUi && !shouldDeferLocalBackgroundApi) {
  // Ext use mock backgroundApi in UI
  backgroundApi = backgroundApiInit();
}

// Async lazy fallback: dynamically loads the real BackgroundApi implementation
// only if the native background thread transport fails at runtime.
// IMPORTANT: We must prevent Metro from statically tracing BackgroundApi and its
// entire dependency graph into the main bundle. We use the Metro resolver to
// redirect this import to a stub at build time, and only load the real
// implementation at runtime via an opaque require when the fallback is needed.
async function loadRealBackgroundApi(): Promise<IBackgroundApi> {
  globalThis.$onekeyIsInBackground =
    platformEnv.isExtensionBackground || platformEnv.isNativeBackgroundThread;
  // Use indirect require via Function constructor to prevent Metro's static
  // dependency collector from tracing BackgroundApi into the main bundle.
  // This is the standard RN pattern for truly lazy runtime-only requires.
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const dynamicRequire = new Function(
    'modulePath',
    'return require(modulePath)',
  ) as (modulePath: string) => { default: new () => IBackgroundApi };
  const BackgroundApi = dynamicRequire(
    '@onekeyhq/kit-bg/src/apis/BackgroundApi',
  ).default;
  return new BackgroundApi();
}

const backgroundApiProxy = new BackgroundApiProxy({
  backgroundApi,
  getBackgroundApi: backgroundApiInit,
  getBackgroundApiAsync: shouldDeferLocalBackgroundApi
    ? loadRealBackgroundApi
    : undefined,
});

appGlobals.$backgroundApiProxy = backgroundApiProxy;

export default backgroundApiProxy;

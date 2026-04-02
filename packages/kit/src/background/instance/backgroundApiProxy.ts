import BackgroundApiProxy from '@onekeyhq/kit-bg/src/apis/BackgroundApiProxy';
import type { IBackgroundApi } from '@onekeyhq/kit-bg/src/apis/IBackgroundApi';
import appGlobals from '@onekeyhq/shared/src/appGlobals';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiInit from './backgroundApiInit';


let backgroundApi = null;

const shouldDeferLocalBackgroundApi =
  platformEnv.isNativeMainThread && platformEnv.enableNativeBackgroundThread;

if (!platformEnv.isExtensionUi && !shouldDeferLocalBackgroundApi) {
  // Ext use mock backgroundApi in UI
  backgroundApi = backgroundApiInit();
}

// Async lazy fallback: dynamically loads the real BackgroundApi implementation
// only if the native background thread transport fails at runtime.
// Uses async import() so Metro's segment serializer can place BackgroundApi
// in a separate segment loaded on demand via __loadBundleAsync.
async function loadRealBackgroundApi(): Promise<IBackgroundApi> {
  console.log('[BG_FALLBACK] loadRealBackgroundApi starting...');
  try {
    globalThis.$onekeyIsInBackground =
      platformEnv.isExtensionBackground || platformEnv.isNativeBackgroundThread;
    const { default: BackgroundApi } =
      await import('@onekeyhq/kit-bg/src/apis/BackgroundApi');
    console.log('[BG_FALLBACK] BackgroundApi imported, creating instance...');
    const api = new BackgroundApi();
    console.log('[BG_FALLBACK] BackgroundApi instance created');
    return api;
  } catch (err) {
    console.error('[BG_FALLBACK] loadRealBackgroundApi FAILED', err);
    throw err;
  }
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

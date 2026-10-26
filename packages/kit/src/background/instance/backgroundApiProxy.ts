import BackgroundApiProxy from '@onekeyhq/kit-bg/src/apis/BackgroundApiProxy';
import appGlobals from '@onekeyhq/shared/src/appGlobals';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiInit from './backgroundApiInit';

let backgroundApi = null;

const isDesktopTrayRenderer =
  platformEnv.isDesktop &&
  typeof globalThis.location !== 'undefined' &&
  new URLSearchParams(globalThis.location.search ?? '').get('render') ===
    'tray';

const shouldDeferLocalBackgroundApi =
  (platformEnv.isNativeMainThread &&
    platformEnv.enableNativeBackgroundThread) ||
  isDesktopTrayRenderer;

if (!platformEnv.isExtensionUi && !shouldDeferLocalBackgroundApi) {
  // Ext use mock backgroundApi in UI
  backgroundApi = backgroundApiInit();
}

const backgroundApiProxy = new BackgroundApiProxy({
  backgroundApi,
  getBackgroundApi: backgroundApiInit,
});

appGlobals.$backgroundApiProxy = backgroundApiProxy;

export default backgroundApiProxy;

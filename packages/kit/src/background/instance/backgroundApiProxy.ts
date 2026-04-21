import BackgroundApiProxy from '@onekeyhq/kit-bg/src/apis/BackgroundApiProxy';
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

const backgroundApiProxy = new BackgroundApiProxy({
  backgroundApi,
  getBackgroundApi: backgroundApiInit,
});

appGlobals.$backgroundApiProxy = backgroundApiProxy;

export default backgroundApiProxy;

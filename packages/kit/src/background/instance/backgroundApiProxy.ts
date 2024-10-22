import BackgroundApiProxy from '@onekeyhq/kit-bg/src/apis/BackgroundApiProxy';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiInit from './backgroundApiInit';

let backgroundApi = null;

if (!platformEnv.isExtensionUi) {
  // Ext use mock backgroundApi in UI
  backgroundApi = backgroundApiInit();
}
const backgroundApiProxy = new BackgroundApiProxy({
  backgroundApi,
});

globalThis.$backgroundApiProxy = backgroundApiProxy;

export default backgroundApiProxy;

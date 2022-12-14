import BackgroundApiProxy from '@onekeyhq/kit-bg/src/BackgroundApiProxy';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiInit from './backgroundApiInit';

let backgroundApi = null;

if (!platformEnv.isExtensionUi) {
  backgroundApi = backgroundApiInit();
}
const backgroundApiProxy = new BackgroundApiProxy({
  backgroundApi,
});

export default backgroundApiProxy;

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import BackgroundApiProxy from '../BackgroundApiProxy';

import backgroundApiInit from './backgroundApiInit';

let backgroundApi = null;

if (!platformEnv.isExtensionUi) {
  backgroundApi = backgroundApiInit();
}
const backgroundApiProxy = new BackgroundApiProxy({
  backgroundApi,
});

global.$backgroundApiProxy = backgroundApiProxy;

export default backgroundApiProxy;

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import BackgroundApiProxy from '../BackgroundApiProxy';

const backgroundApiProxy = new BackgroundApiProxy({
  getBackgroundApiAsync: platformEnv.isExtension
    ? undefined
    : async () => (await import('./backgroundApi')).default,
});

export default backgroundApiProxy;

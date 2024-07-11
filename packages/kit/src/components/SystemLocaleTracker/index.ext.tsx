import { useEffect } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

let done = false;

export const SystemLocaleTracker = () => {
  useEffect(() => {
    if (platformEnv.isExtension && !done) {
      done = true;
      void backgroundApiProxy.serviceSetting.initSystemLocale();
    }
  }, []);
  return null;
};

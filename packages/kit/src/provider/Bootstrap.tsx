import { useEffect } from 'react';

import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';

export function Bootstrap() {
  useEffect(() => {
    void backgroundApiProxy.serviceSetting.fetchCurrencyList();
    if (platformEnv.isDesktop) {
      window.desktopApi.on('update/checkForUpdates', () => {
        defaultLogger.update.app.log('checkForUpdates');
      });
    }
  }, []);
  return null;
}

import { useCallback } from 'react';

import { InteractionManager } from 'react-native';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';
import { AppStatusActiveListener } from '../components/AppStatusActiveListener';

export const WhenAppActive = () => {
  const onActive = useCallback(() => {
    backgroundApiProxy.serviceSwap.getSwapConfig();
    backgroundApiProxy.serviceSetting.updateRemoteSetting();
    setTimeout(() => {
      InteractionManager.runAfterInteractions(() => {
        backgroundApiProxy.serviceDataCleanup.cleanupStaleData();
      });
    }, 10000);
  }, []);
  return <AppStatusActiveListener onActive={onActive} />;
};

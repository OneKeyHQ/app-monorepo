import { useCallback } from 'react';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';
import { AppStatusActiveListener } from '../components/AppStatusActiveListener';

export const WhenAppActive = () => {
  const onActive = useCallback(() => {
    backgroundApiProxy.serviceSwap.getSwapConfig();
    backgroundApiProxy.serviceSetting.updateRemoteSetting();
    backgroundApiProxy.serviceTranslation.getTranslations();
  }, []);
  return <AppStatusActiveListener onActive={onActive} />;
};

import { useCallback } from 'react';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';
import { AppStatusActiveListener } from '../components/AppStatusActiveListener';

export const WhenAppActive = () => {
  const onActive = useCallback(() => {
    backgroundApiProxy.serviceSwap.getSwapTokens();
    backgroundApiProxy.serviceDiscover.fetchData();
    backgroundApiProxy.serviceSetting.updateRemoteSetting();
  }, []);
  return <AppStatusActiveListener onActive={onActive} />;
};

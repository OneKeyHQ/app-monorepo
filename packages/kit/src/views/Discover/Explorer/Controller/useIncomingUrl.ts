import { useCallback } from 'react';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { useAppSelector } from '../../../../hooks/useAppSelector';
import { setIncomingUrl } from '../../../../store/reducers/webTabs';

import { gotoSite } from './gotoSite';

const clearIncomingUrl = () => backgroundApiProxy.dispatch(setIncomingUrl(''));

export const useIncomingUrl = () => {
  const incomingUrl = useAppSelector((s) => s.webTabs.incomingUrl);
  const handleIncomingUrl = useCallback(() => {
    if (incomingUrl) {
      gotoSite({ url: incomingUrl, isNewWindow: true, userTriggered: true });
      clearIncomingUrl();
    }
  }, [incomingUrl]);

  return { incomingUrl, clearIncomingUrl, handleIncomingUrl };
};

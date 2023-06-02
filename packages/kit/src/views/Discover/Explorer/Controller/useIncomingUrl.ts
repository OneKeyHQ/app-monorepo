import { useCallback } from 'react';

import { gotoSite } from './gotoSite';
import { incomingUrlObs, webTabsActions } from '../../../../store/observable/webTabs';
import { useSelector } from '@legendapp/state/react';

const clearIncomingUrl = () => webTabsActions.setIncomingUrl('');

export const useIncomingUrl = () => {
  const incomingUrl = useSelector(incomingUrlObs);
  const handleIncomingUrl = useCallback(() => {
    if (incomingUrl) {
      gotoSite({ url: incomingUrl, isNewWindow: true, userTriggered: true });
      clearIncomingUrl();
    }
  }, [incomingUrl]);

  return { incomingUrl, clearIncomingUrl, handleIncomingUrl };
};

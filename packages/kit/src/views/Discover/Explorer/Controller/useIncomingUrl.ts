import { useCallback } from 'react';

import { useSelector } from '@legendapp/state/react';

import {
  incomingUrlObs,
  webTabsActions,
} from '../../../../store/observable/webTabs';

import { gotoSite } from './gotoSite';

const clearIncomingUrl = () => webTabsActions.setIncomingUrl('');

export const useIncomingUrl = () => {
  const incomingUrl = useSelector(() => incomingUrlObs.get());
  const handleIncomingUrl = useCallback(() => {
    if (incomingUrl) {
      gotoSite({ url: incomingUrl, isNewWindow: true, userTriggered: true });
      clearIncomingUrl();
    }
  }, [incomingUrl]);

  return { incomingUrl, clearIncomingUrl, handleIncomingUrl };
};

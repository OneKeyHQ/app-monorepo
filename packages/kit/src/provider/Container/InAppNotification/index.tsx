import { useEffect } from 'react';

import { useInAppNotificationAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

const InAppNotification = () => {
  const [{ swapHistoryPendingList }] = useInAppNotificationAtom();

  useEffect(() => {
    void backgroundApiProxy.serviceSwap.swapHistoryStatusFetchLoop();
    return () => {
      void backgroundApiProxy.serviceSwap.cleanHistoryStateIntervals();
    };
  }, [swapHistoryPendingList]);
  return null;
};

export default InAppNotification;

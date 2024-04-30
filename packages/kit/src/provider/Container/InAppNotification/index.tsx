import { useEffect } from 'react';

import { useInAppNotificationAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

const InAppNotification = () => {
  const [{ swapHistoryPendingList }] = useInAppNotificationAtom();

  useEffect(() => {
    void backgroundApiProxy.serviceSwap.syncSwapHistoryPendingList();
  }, []);

  useEffect(() => {
    void backgroundApiProxy.serviceSwap.swapHistoryStatusFetchLoop();
  }, [swapHistoryPendingList]);
  return null;
};

export default InAppNotification;

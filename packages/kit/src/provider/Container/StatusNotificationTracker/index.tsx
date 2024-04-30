import { useEffect } from 'react';

import { useStatusNotificationAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

const StatusNotificationTracker = () => {
  const [{ swapHistoryPendingList }] = useStatusNotificationAtom();

  useEffect(() => {
    void backgroundApiProxy.serviceSwap.syncSwapHistoryPendingList();
  }, []);

  useEffect(() => {
    void backgroundApiProxy.serviceSwap.swapHistoryStatusFetchLoop();
  }, [swapHistoryPendingList]);
  return null;
};

export default StatusNotificationTracker;

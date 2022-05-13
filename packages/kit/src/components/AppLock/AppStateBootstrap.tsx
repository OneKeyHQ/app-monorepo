import React, { useEffect } from 'react';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useData, useSettings, useStatus } from '../../hooks/redux';
import { lock } from '../../store/reducers/status';

export const AppStateBootstrap = () => {
  const { enableAppLock, appLockDuration } = useSettings();
  const { lastActivity } = useStatus();
  const { isPasswordSet } = useData();
  const prerequisites = isPasswordSet && enableAppLock;
  useEffect(() => {
    if (!prerequisites) {
      return;
    }
    const idleDuration = Math.floor((Date.now() - lastActivity) / (1000 * 60));
    const isStale = idleDuration >= appLockDuration;
    if (isStale) {
      backgroundApiProxy.dispatch(lock());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <></>;
};

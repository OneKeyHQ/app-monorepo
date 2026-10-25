import { useCallback, useEffect, useRef } from 'react';

import { useNetInfo } from '@onekeyhq/components';
import { useAppIsLockedAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import errorUtils from '@onekeyhq/shared/src/errors/utils/errorUtils';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useHandleAppStateActive } from '../../../hooks/useHandleAppStateActive';

// Main runtime supplies wake-ups; background owns persistence, backoff and keys.
export function CloudSyncReconciliationEffect() {
  const [locked] = useAppIsLockedAtom();
  const { isInternetReachable } = useNetInfo();
  const started = useRef(false);
  const previousNetwork = useRef(isInternetReachable);
  const resume = useCallback(
    (reason: 'startup' | 'unlock' | 'network' | 'foreground') => {
      if (locked || isInternetReachable !== true) return;
      void backgroundApiProxy.servicePrimeCloudSync
        .resumeCloudSyncReconciliation({ reason })
        .catch((error) => errorUtils.autoPrintErrorIgnore(error));
    },
    [locked, isInternetReachable],
  );

  useEffect(() => {
    let reason: 'startup' | 'network' | 'unlock' = 'unlock';
    if (!started.current) reason = 'startup';
    else if (previousNetwork.current !== true) reason = 'network';
    previousNetwork.current = isInternetReachable;
    if (!locked && isInternetReachable === true) {
      started.current = true;
      resume(reason);
    }
  }, [locked, isInternetReachable, resume]);
  useHandleAppStateActive(useCallback(() => resume('foreground'), [resume]));
  return null;
}

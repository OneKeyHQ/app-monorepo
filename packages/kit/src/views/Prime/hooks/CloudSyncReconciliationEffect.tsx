import { useCallback, useEffect, useRef } from 'react';

import { useNetInfo } from '@onekeyhq/components';
import { supportsIndexedCloudAccountArchive } from '@onekeyhq/kit-bg/src/dbs/local/consts';
import { useAppIsLockedAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import errorUtils from '@onekeyhq/shared/src/errors/utils/errorUtils';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useHandleAppStateActive } from '../../../hooks/useHandleAppStateActive';

// Main runtime supplies wake-ups; background owns persistence, backoff and keys.
export function CloudSyncReconciliationEffect() {
  const [locked] = useAppIsLockedAtom();
  const { isInternetReachable } = useNetInfo();
  const started = useRef(false);
  const localWakeForUnlock = useRef(false);
  const locallyStarted = useRef(false);
  const previousNetwork = useRef(isInternetReachable);
  useEffect(() => {
    void backgroundApiProxy.servicePrimeCloudSync
      .setCloudSyncNetworkReachable(isInternetReachable)
      .catch((error) => errorUtils.autoPrintErrorIgnore(error));
  }, [isInternetReachable]);
  const resume = useCallback(
    (reason: 'startup' | 'unlock' | 'network' | 'foreground') => {
      if (locked || isInternetReachable !== true) return;
      void backgroundApiProxy.servicePrimeCloudSync
        .setCloudSyncNetworkReachable(isInternetReachable)
        .then(() =>
          backgroundApiProxy.servicePrimeCloudSync.resumeCloudSyncReconciliation(
            { reason },
          ),
        )
        .catch((error) => errorUtils.autoPrintErrorIgnore(error));
    },
    [locked, isInternetReachable],
  );

  useEffect(() => {
    let reason: 'startup' | 'network' | 'unlock' = 'unlock';
    if (!started.current) reason = 'startup';
    else if (previousNetwork.current !== true) reason = 'network';
    previousNetwork.current = isInternetReachable;
    if (locked) {
      localWakeForUnlock.current = false;
      return;
    }
    if (isInternetReachable === true) {
      started.current = true;
      localWakeForUnlock.current = true;
      resume(reason);
    } else if (
      isInternetReachable === false &&
      !localWakeForUnlock.current &&
      supportsIndexedCloudAccountArchive()
    ) {
      localWakeForUnlock.current = true;
      const localReason =
        started.current || locallyStarted.current ? 'unlock' : 'startup';
      locallyStarted.current = true;
      void backgroundApiProxy.servicePrimeCloudSync
        .resumeCloudSyncReconciliation({
          reason: localReason,
          localOnly: true,
        })
        .catch((error) => errorUtils.autoPrintErrorIgnore(error));
    }
  }, [locked, isInternetReachable, resume]);
  useHandleAppStateActive(useCallback(() => resume('foreground'), [resume]));
  return null;
}

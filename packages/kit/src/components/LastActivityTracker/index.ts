import { useCallback, useEffect } from 'react';

import { AppState } from 'react-native';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useInterval } from '@onekeyhq/kit/src/hooks/useInterval';
import {
  usePasswordAtom,
  usePasswordPersistAtom,
  useSystemIdleLockSupport,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

const LastActivityTracker = () => {
  const [{ enableSystemIdleLock, appLockDuration }] = usePasswordPersistAtom();
  const [{ unLock }] = usePasswordAtom();
  const [supportSystemIdle] = useSystemIdleLockSupport();
  const refresh = useCallback(() => {
    if (AppState.currentState === 'active') {
      backgroundApiProxy.serviceSetting
        .refreshLastActivity()
        .catch(console.error);
    }
  }, []);
  const extHandleSystemIdle = useCallback((state: any) => {
    if (state === 'idle' || state === 'locked') {
      void backgroundApiProxy.servicePassword.lockApp();
    }
  }, []);
  useInterval(refresh, 5 * 1000);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(refresh, []);
  useEffect(() => {
    if (supportSystemIdle && enableSystemIdleLock && unLock) {
      if (platformEnv.isExtension) {
        chrome.idle.setDetectionInterval(appLockDuration * 60);
        chrome.idle.onStateChanged.addListener(extHandleSystemIdle);
      }

      if (platformEnv.isDesktop) {
        window?.desktopApi?.setSystemIdleTime(appLockDuration * 60, () => {
          void backgroundApiProxy.servicePassword.lockApp();
        });
      }
    } else {
      if (platformEnv.isExtension) {
        chrome.idle.onStateChanged.removeListener(extHandleSystemIdle);
      }
      if (platformEnv.isDesktop) {
        window?.desktopApi?.setSystemIdleTime(0, () => {});
      }
    }
  }, [
    appLockDuration,
    enableSystemIdleLock,
    extHandleSystemIdle,
    supportSystemIdle,
    unLock,
  ]);
  return null;
};

export default LastActivityTracker;

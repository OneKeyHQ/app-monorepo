import { useCallback, useEffect, useRef } from 'react';

import { AppState } from 'react-native';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useInterval } from '@onekeyhq/kit/src/hooks/useInterval';
import {
  usePasswordAtom,
  usePasswordPersistAtom,
  useSystemIdleLockSupport,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { trackEvent } from '@onekeyhq/shared/src/modules3rdParty/mixpanel';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

const LastActivityTracker = () => {
  const [{ enableSystemIdleLock, appLockDuration }] = usePasswordPersistAtom();
  const prevAppStateRef = useRef(AppState.currentState);
  const [{ unLock }] = usePasswordAtom();
  const [supportSystemIdle] = useSystemIdleLockSupport();
  const refresh = useCallback(() => {
    const { currentState } = AppState;
    if (currentState === 'active') {
      backgroundApiProxy.serviceSetting
        .refreshLastActivity()
        .catch(console.error);
      trackEvent('AppStart', {
        resume_from_background: prevAppStateRef.current !== 'active',
      });
    } else if (prevAppStateRef.current === 'active') {
      trackEvent('AppEnd');
    }

    prevAppStateRef.current = currentState;
  }, []);
  const extHandleSystemIdle = useCallback(
    (state: 'idle' | 'locked' | 'active') => {
      if (state === 'idle' || state === 'locked') {
        void backgroundApiProxy.servicePassword.lockApp();
      }
    },
    [],
  );
  useInterval(refresh, 5 * 1000);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(refresh, []);

  // idle event trigger
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
        window?.desktopApi?.setSystemIdleTime(0); // set 0 to disable
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

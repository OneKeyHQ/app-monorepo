import { useCallback, useEffect, useRef } from 'react';

import { AppState } from 'react-native';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useInterval } from '@onekeyhq/kit/src/hooks/useInterval';
import {
  useDevSettingsPersistAtom,
  usePasswordAtom,
  usePasswordPersistAtom,
  useSettingsPersistAtom,
  useSystemIdleLockSupport,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { analytics } from '@onekeyhq/shared/src/analytics';
import { buildServiceEndpoint } from '@onekeyhq/shared/src/config/appConfig';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';

const LastActivityTracker = () => {
  const [{ enableSystemIdleLock, appLockDuration }] = usePasswordPersistAtom();
  const [settings] = useSettingsPersistAtom();
  const [devSettings] = useDevSettingsPersistAtom();
  const [{ unLock }] = usePasswordAtom();
  const [supportSystemIdle] = useSystemIdleLockSupport();
  const instanceIdRef = useRef(settings.instanceId);

  useEffect(() => {
    analytics.init({
      instanceId: instanceIdRef.current,
      baseURL: buildServiceEndpoint({
        serviceName: EServiceEndpointEnum.Utility,
        env: devSettings.settings?.enableTestEndpoint ? 'test' : 'prod',
      }),
    });
    defaultLogger.app.page.appStart();
  }, [devSettings.settings?.enableTestEndpoint]);

  const refresh = useCallback(() => {
    if (AppState.currentState === 'active') {
      backgroundApiProxy.serviceSetting
        .refreshLastActivity()
        .catch(console.error);
    }
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

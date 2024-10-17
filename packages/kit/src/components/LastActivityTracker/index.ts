import { useCallback, useEffect } from 'react';

import { AppState } from 'react-native';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useInterval } from '@onekeyhq/kit/src/hooks/useInterval';
import {
  usePasswordAtom,
  usePasswordPersistAtom,
  useSystemIdleLockSupport,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { analytics } from '@onekeyhq/shared/src/analytics';
import { analyticLogEvent } from '@onekeyhq/shared/src/analytics/firebase';
import { buildServiceEndpoint } from '@onekeyhq/shared/src/config/appConfig';
import { setAttributes } from '@onekeyhq/shared/src/crashlytics';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';

const LastActivityTracker = () => {
  const [{ enableSystemIdleLock, appLockDuration }] = usePasswordPersistAtom();
  const [{ unLock }] = usePasswordAtom();
  const [supportSystemIdle] = useSystemIdleLockSupport();

  useEffect(() => {
    setTimeout(async () => {
      const instanceId =
        await backgroundApiProxy.serviceSetting.getInstanceId();
      const devSettings =
        await backgroundApiProxy.serviceDevSetting.getDevSetting();
      analytics.init({
        instanceId,
        baseURL: buildServiceEndpoint({
          serviceName: EServiceEndpointEnum.Utility,
          env:
            devSettings.enabled && devSettings.settings?.enableTestEndpoint
              ? 'test'
              : 'prod',
        }),
      });
      analyticLogEvent('initialized', {
        instanceId,
        platform: platformEnv.symbol,
        distribution: platformEnv.appChannel,
      });
      setAttributes({
        instanceId,
        platform: platformEnv.symbol || '',
        appChannel: platformEnv.appChannel || '',
      });
    }, 0);
    defaultLogger.app.page.appStart();
  }, []);

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
        globalThis?.desktopApi?.setSystemIdleTime(appLockDuration * 60, () => {
          void backgroundApiProxy.servicePassword.lockApp();
        });
      }
    } else {
      if (platformEnv.isExtension) {
        chrome.idle.onStateChanged.removeListener(extHandleSystemIdle);
      }
      if (platformEnv.isDesktop) {
        globalThis?.desktopApi?.setSystemIdleTime(0); // set 0 to disable
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

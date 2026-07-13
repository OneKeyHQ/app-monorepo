import { useCallback, useEffect } from 'react';

import { AppState } from 'react-native';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useInterval } from '@onekeyhq/kit/src/hooks/useInterval';
import {
  usePasswordAtom,
  usePasswordPersistAtom,
  useSystemIdleLockSupport,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms/passwordLock';
import { analytics } from '@onekeyhq/shared/src/analytics';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import LaunchOptionsManager from '@onekeyhq/shared/src/modules/LaunchOptionsManager';
import { initPosthog } from '@onekeyhq/shared/src/modules3rdParty/posthog';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';

const LAST_ACTIVITY_TRACKER_START_DELAY_MS = platformEnv.isWeb ? 3000 : 0;
const LAST_ACTIVITY_TRACKER_REFRESH_INTERVAL_MS = platformEnv.isWeb
  ? 6000
  : 5 * 1000;

const LastActivityTracker = () => {
  const [{ enableSystemIdleLock, appLockDuration }] = usePasswordPersistAtom();
  const [{ unLock }] = usePasswordAtom();
  const [supportSystemIdle] = useSystemIdleLockSupport();

  useEffect(() => {
    const timer = setTimeout(async () => {
      const instanceId =
        await backgroundApiProxy.serviceSetting.getInstanceId();
      const devSettings =
        await backgroundApiProxy.serviceDevSetting.getDevSetting();
      analytics.init({
        instanceId,
        baseURL: (
          await backgroundApiProxy.serviceApp.getEndpointInfo({
            name: EServiceEndpointEnum.Utility,
          })
        ).endpoint,
        enableAnalyticsInDev:
          devSettings.enabled && devSettings.settings?.enableAnalyticsRequest,
      });
      initPosthog({
        enableTestEndpoint:
          devSettings.enabled && devSettings.settings?.enableTestEndpoint,
      });
      void import('@onekeyhq/shared/src/modules3rdParty/sentry').then(
        ({ setUser: setSentryUser }) =>
          setSentryUser({
            id: instanceId,
            instanceId,
            platform: platformEnv.appPlatform || '',
            appChannel: platformEnv.appChannel || '',
          }),
      );
      const jsReadyTime = await LaunchOptionsManager.getJSReadyTime();
      if (jsReadyTime > 0) {
        defaultLogger.app.page.jsReadyTime(jsReadyTime);
      }
      const uiVisibleTime = await LaunchOptionsManager.getUIVisibleTime();
      if (uiVisibleTime > 0) {
        defaultLogger.app.page.uiVisibleTime(uiVisibleTime);
      }
    }, LAST_ACTIVITY_TRACKER_START_DELAY_MS);
    defaultLogger.app.page.appStart();
    defaultLogger.app.page.jsVersion({
      appVersion: platformEnv.version ?? '',
      buildNumber: platformEnv.buildNumber ?? '',
      bundleVersion: platformEnv.bundleVersion ?? '',
      githubSHA: platformEnv.githubSHA ?? '',
    });
    return () => clearTimeout(timer);
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
  useInterval(refresh, LAST_ACTIVITY_TRACKER_REFRESH_INTERVAL_MS);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const timer = setTimeout(refresh, LAST_ACTIVITY_TRACKER_START_DELAY_MS);
    return () => clearTimeout(timer);
  }, [refresh]);

  // idle event trigger
  useEffect(() => {
    setTimeout(() => {
      if (supportSystemIdle && enableSystemIdleLock && unLock) {
        if (platformEnv.isExtension) {
          chrome.idle.setDetectionInterval(appLockDuration * 60);
          chrome.idle.onStateChanged.addListener(extHandleSystemIdle);
        }

        if (platformEnv.isDesktop) {
          globalThis?.desktopApi?.setSystemIdleTime(
            appLockDuration * 60,
            () => {
              void backgroundApiProxy.servicePassword.lockApp();
            },
          );
        }
      } else {
        if (platformEnv.isExtension) {
          chrome.idle.onStateChanged.removeListener(extHandleSystemIdle);
        }
        if (platformEnv.isDesktop) {
          globalThis?.desktopApi?.setSystemIdleTime(0); // set 0 to disable
        }
      }
    }, 0);
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

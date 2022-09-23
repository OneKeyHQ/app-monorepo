import React, { memo, useCallback, useEffect } from 'react';

import { requestPermissionsAsync } from 'expo-notifications';
import JPush from 'jpush-react-native';
import { AppState } from 'react-native';

import { DialogManager } from '@onekeyhq/components';
import { NotificationType } from '@onekeyhq/engine/src/managers/notification';
import { useSettings } from '@onekeyhq/kit/src/hooks/redux';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import {
  checkPushNotificationPermission,
  hasPermission,
  initJpush,
} from '@onekeyhq/shared/src/notification';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';
import PermissionDialog from '../components/PermissionDialog/PermissionDialog';
import { setPushNotificationConfig } from '../store/reducers/settings';

const NotificationProvider: React.FC<{
  children: React.ReactElement<any, any> | null;
}> = ({ children }) => {
  const { pushNotification } = useSettings();

  const { dispatch, serviceNotification } = backgroundApiProxy;

  const clearBadge = useCallback(() => {
    debugLogger.notification.debug('clearBadge');
    if (platformEnv.isNative) {
      JPush.setBadge({
        badge: 0,
        appBadge: 0,
      });
    }
  }, []);

  const handleNotificationCallback = useCallback(
    (result: NotificationType) => {
      serviceNotification.handleNotificaitonCallback(result);
    },
    [serviceNotification],
  );

  const handleRegistrationIdCallback = useCallback(
    (res: { registerID: string }) => {
      debugLogger.notification.debug('JPUSH.getRegistrationID', res);
      dispatch(
        setPushNotificationConfig({
          registrationId: res.registerID,
        }),
      );
      serviceNotification.syncPushNotificationConfig();
    },
    [dispatch, serviceNotification],
  );

  const handleConnectStateChangeCallback = useCallback(
    (result: { connectEnable: boolean }) => {
      debugLogger.notification.debug('JPUSH.addConnectEventListener', result);
      if (!result.connectEnable) {
        return;
      }
      JPush.getRegistrationID(handleRegistrationIdCallback);
    },
    [handleRegistrationIdCallback],
  );

  const checkPermission = useCallback(async () => {
    if (!pushNotification?.pushEnable) {
      return false;
    }
    if (platformEnv.isNative) {
      const permission = await requestPermissionsAsync();
      if (hasPermission(permission)) {
        return true;
      }
      const alreadyHasPermission = await checkPushNotificationPermission();
      if (alreadyHasPermission) {
        return true;
      }
    }
    // Desktop、web、extension
    if (platformEnv.isRuntimeBrowser && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        return true;
      }
      const res = await Notification.requestPermission();
      if (res === 'granted') {
        return true;
      }
    }
    dispatch(
      setPushNotificationConfig({
        pushEnable: false,
      }),
    );
    DialogManager.show({
      render: <PermissionDialog type="notification" />,
    });
    return false;
  }, [dispatch, pushNotification?.pushEnable]);

  const checkPermissionAndInitJpush = useCallback(async () => {
    const enabled = await checkPermission();
    serviceNotification.syncPushNotificationConfig();
    if (!enabled) {
      return;
    }
    if (platformEnv.isNative) {
      initJpush();
      JPush.getRegistrationID(handleRegistrationIdCallback);
    }
  }, [checkPermission, serviceNotification, handleRegistrationIdCallback]);

  // addEventListener
  useEffect(() => {
    serviceNotification.syncLocalEnabledAccounts();
    if (platformEnv.isRuntimeBrowser) {
      serviceNotification.registerNotificationCallback();
    }
    const clear = () => {
      if (!platformEnv.isNative) {
        return;
      }
      JPush.removeListener(handleNotificationCallback);
      JPush.removeListener(handleConnectStateChangeCallback);
    };
    if (platformEnv.isNative) {
      clear();
      JPush.addConnectEventListener(handleConnectStateChangeCallback);
      // @ts-ignore
      JPush.addNotificationListener(handleNotificationCallback);
      // @ts-ignore
      JPush.addLocalNotificationListener(handleNotificationCallback);
    }
    return clear;
  }, [
    handleNotificationCallback,
    handleConnectStateChangeCallback,
    serviceNotification,
  ]);

  // checkPermission and init
  useEffect(() => {
    clearBadge();
    const listener = AppState.addEventListener('change', (state) => {
      if (!['background', 'inactive'].includes(state)) {
        clearBadge();
        checkPermission();
      }
    });
    if (pushNotification?.pushEnable) {
      checkPermissionAndInitJpush();
    }
    return () => {
      listener.remove();
    };
  }, [
    clearBadge,
    checkPermission,
    pushNotification?.pushEnable,
    checkPermissionAndInitJpush,
  ]);

  return children;
};

NotificationProvider.displayName = 'NotificationProvider';

export default memo(NotificationProvider);

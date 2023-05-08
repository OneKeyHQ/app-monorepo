import type { FC } from 'react';
import { memo, useCallback, useEffect } from 'react';

import { AppState, NativeModules } from 'react-native';

import type { NotificationExtra } from '@onekeyhq/engine/src/managers/notification';
import { useSettings } from '@onekeyhq/kit/src/hooks/redux';
import { requestPermissionsAsync } from '@onekeyhq/shared/src/modules3rdParty/expo-notifications';
import {
  checkPushNotificationPermission,
  hasPermission,
} from '@onekeyhq/shared/src/notification';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';
import PermissionDialog from '../components/PermissionDialog/PermissionDialog';
import { setPushNotificationConfig } from '../store/reducers/settings';
import { showDialog } from '../utils/overlayUtils';

const NotificationProvider: FC<{
  launchNotification?: NotificationExtra;
}> = ({ launchNotification }) => {
  const { pushNotification } = useSettings();

  const { dispatch, serviceNotification } = backgroundApiProxy;

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
    showDialog(<PermissionDialog type="notification" />);
    return false;
  }, [dispatch, pushNotification?.pushEnable]);

  const checkPermissionAndInitJpush = useCallback(async () => {
    const enabled = await checkPermission();
    if (!enabled) {
      return;
    }
    if (platformEnv.isNativeIOS) {
      NativeModules.JPushManager.registerNotification();
    }
  }, [checkPermission]);

  useEffect(() => {
    // init in background if platform is ext
    if (!platformEnv.isExtension) {
      serviceNotification.init(launchNotification);
      return () => serviceNotification.clear();
    }
  }, [serviceNotification, launchNotification]);

  // checkPermission and init
  useEffect(() => {
    serviceNotification.clearBadge();
    const listener = AppState.addEventListener('change', (state) => {
      if (!['background', 'inactive'].includes(state)) {
        serviceNotification.clearBadge();
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
    serviceNotification,
    checkPermission,
    pushNotification?.pushEnable,
    checkPermissionAndInitJpush,
  ]);

  return null;
};

NotificationProvider.displayName = 'NotificationProvider';

export default memo(NotificationProvider);

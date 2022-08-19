import {
  IosAuthorizationStatus,
  NotificationPermissionsStatus,
  getPermissionsAsync,
  requestPermissionsAsync,
} from 'expo-notifications';

const hasPermission = (settings: NotificationPermissionsStatus) =>
  settings.granted ||
  settings.ios?.status === IosAuthorizationStatus.PROVISIONAL;

export const checkPushNotificationPermission = async (
  autoApplyPermission = false,
) => {
  let permissions = await getPermissionsAsync();
  if (hasPermission(permissions)) {
    return true;
  }
  if (!autoApplyPermission) {
    return false;
  }
  permissions = await requestPermissionsAsync();
  return hasPermission(permissions);
};

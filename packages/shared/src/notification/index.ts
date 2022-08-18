import {
  IosAuthorizationStatus,
  NotificationPermissionsStatus,
  getPermissionsAsync,
  requestPermissionsAsync,
} from 'expo-notifications';

const hasPermission = (settings: NotificationPermissionsStatus) =>
  settings.granted ||
  settings.ios?.status === IosAuthorizationStatus.PROVISIONAL;

export const checkPushNotificationPermission = async () => {
  let permissions = await getPermissionsAsync();
  if (hasPermission(permissions)) {
    return true;
  }
  permissions = await requestPermissionsAsync();
  return hasPermission(permissions);
};

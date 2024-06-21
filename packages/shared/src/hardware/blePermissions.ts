import { Linking, PermissionsAndroid, Platform } from 'react-native';

import {
  PERMISSIONS,
  RESULTS,
  check,
  openSettings,
  request,
  requestMultiple,
} from '../modules3rdParty/react-native-permissions';
import platformEnv from '../platformEnv';

export async function openBLESettings() {
  if (platformEnv.isNativeIOS) {
    await Linking.openURL('App-Prefs:Bluetooth');
  } else {
    await Linking.sendIntent('android.settings.BLUETOOTH_SETTINGS');
  }
}

export async function openBLEPermissionsSettings() {
  await openSettings();
}

export async function checkBLEPermissions() {
  if (platformEnv.isNativeIOS) {
    // If you only call the `request` function to check if Bluetooth permission is enabled,
    //  it will still return false in scenarios where the Bluetooth switch is turned off
    const permissionStatus = await check(PERMISSIONS.IOS.BLUETOOTH);
    if (permissionStatus !== RESULTS.GRANTED) {
      const status = await request(PERMISSIONS.IOS.BLUETOOTH);
      return status === RESULTS.GRANTED;
    }
    return true;
  }

  if (platformEnv.isNativeAndroid) {
    if ((Platform.Version as number) < 31) {
      const status = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      );
      return status === RESULTS.GRANTED;
    }
    const permissions = [
      PERMISSIONS.ANDROID.BLUETOOTH_CONNECT,
      PERMISSIONS.ANDROID.BLUETOOTH_SCAN,
    ];
    const statuses = await requestMultiple(permissions);
    return (
      statuses[PERMISSIONS.ANDROID.BLUETOOTH_CONNECT] === RESULTS.GRANTED &&
      statuses[PERMISSIONS.ANDROID.BLUETOOTH_SCAN] === RESULTS.GRANTED
    );
  }
}

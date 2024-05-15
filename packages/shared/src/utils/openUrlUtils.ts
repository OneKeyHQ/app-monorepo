import {
  canOpenURL as linkingCanOpenURL,
  openSettings as linkingOpenSettings,
  openURL as linkingOpenURL,
} from 'expo-linking';

import platformEnv from '../platformEnv';

import type { IPrefType } from '../../types/desktop';

export const openUrlExternal = (url: string) => {
  if (platformEnv.isNative) {
    void linkingOpenURL(url);
  } else {
    window.open(url, '_blank');
  }
};

export const openSettings = (prefType: IPrefType) => {
  if (platformEnv.isNative) {
    void linkingOpenSettings();
  } else {
    window?.desktopApi?.openPreferences(prefType);
  }
};

export default {
  openUrlExternal,
  openSettings,
  linkingCanOpenURL,
  linkingOpenURL,
};

import {
  openSettings as LinkingOpenSettings,
  openURL as LinkingOpenURL,
} from 'expo-linking';

import platformEnv from '../platformEnv';

import type { IPrefType } from '../../types/desktop';

export const openUrlExternal = (url: string) => {
  if (platformEnv.isNative) {
    void LinkingOpenURL(url);
  } else {
    window.open(url, '_blank');
  }
};

export const openSettings = (prefType: IPrefType) => {
  if (platformEnv.isNative) {
    void LinkingOpenSettings();
  } else {
    window?.desktopApi?.openPreferences(prefType);
  }
};

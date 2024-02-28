import { openURL as LinkingOpenURL } from 'expo-linking';

import platformEnv from '../platformEnv';

export const openUrlExternal = (url: string) => {
  if (platformEnv.isNative) {
    void LinkingOpenURL(url);
  } else {
    window.open(url, '_blank');
  }
};

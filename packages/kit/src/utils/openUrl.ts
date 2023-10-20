import { openURL as LinkingOpenURL } from 'expo-linking';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

export const openUrlExternal = (url: string) => {
  if (platformEnv.isNative) {
    // open by OS default browser
    LinkingOpenURL(url);
  } else {
    window.open(url, '_blank');
  }
};

import { NativeModules } from 'react-native';

import type { ILaunchOptionsManagerInterface } from './type';

const { LaunchOptionsManager } = NativeModules as {
  LaunchOptionsManager: ILaunchOptionsManagerInterface;
};

export default {
  getLaunchOptions: () => {
    if (LaunchOptionsManager && LaunchOptionsManager.getLaunchOptions) {
      return LaunchOptionsManager.getLaunchOptions();
    }
    return Promise.resolve(null);
  },
  clearLaunchOptions: () => {
    if (LaunchOptionsManager && LaunchOptionsManager.clearLaunchOptions) {
      return LaunchOptionsManager.clearLaunchOptions();
    }
    return Promise.resolve(true);
  },
} as ILaunchOptionsManagerInterface;

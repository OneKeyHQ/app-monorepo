import { ReactNativeDeviceUtils } from '@onekeyfe/react-native-device-utils';
import { noop } from 'lodash';

import type { IMainMenu } from './types';

export type { IMainMenu, IMainMenuCommand, IMainMenuConfig } from './types';

// JS can reach users over the air before a native shell that has these
// methods, so treat their absence as "no menu bar".
const isSupported =
  typeof ReactNativeDeviceUtils.setMainMenuConfig === 'function';

const mainMenu: IMainMenu = {
  setConfig: (config) => {
    if (!isSupported) {
      return;
    }
    ReactNativeDeviceUtils.setMainMenuConfig(config);
  },
  addCommandListener: (callback) => {
    if (!isSupported) {
      return noop;
    }
    const listenerId =
      ReactNativeDeviceUtils.addMainMenuCommandListener(callback);
    return () => {
      ReactNativeDeviceUtils.removeMainMenuCommandListener(listenerId);
    };
  },
};

export default mainMenu;

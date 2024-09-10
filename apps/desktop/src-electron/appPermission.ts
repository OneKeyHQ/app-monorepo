import os from 'os';

import { ipcMain, shell } from 'electron';

import type {
  IDesktopSubModuleInitParams,
  IPrefType,
} from '@onekeyhq/shared/types/desktop';

import { ipcMessageKeys } from './config';

function init({ APP_NAME, getSafelyMainWindow }: IDesktopSubModuleInitParams) {
  ipcMain.on(
    ipcMessageKeys.APP_OPEN_PREFERENCES,
    async (_event, prefType: IPrefType) => {
      const platform = os.type();
      if (platform === 'Darwin') {
        if (prefType === 'notification') {
          // const appId = 'com.google.Chrome';
          let appId = ''; // TODO how to get appId on production
          if (process.env.NODE_ENV !== 'production') {
            appId = 'com.github.Electron';
          }
          void shell.openExternal(
            `x-apple.systempreferences:com.apple.preference.notifications?id=${appId}`,
          );
          // old version MacOS
          // 'x-apple.systempreferences:com.apple.preference.security?Privacy_Notifications'
        } else {
          void shell.openPath(
            '/System/Library/PreferencePanes/Security.prefPane',
          );
        }
      } else if (platform === 'Windows_NT') {
        void shell.openExternal('ms-settings:notifications');

        // ref https://docs.microsoft.com/en-us/windows/uwp/launch-resume/launch-settings-app
        if (prefType === 'camera') {
          void shell.openExternal('ms-settings:privacy-webcam');
        }
        // BlueTooth is not supported on desktop currently
      } else {
        // Linux ??
      }
    },
  );
}

export default {
  init,
};

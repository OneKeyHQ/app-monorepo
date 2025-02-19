import { ipcMain, shell } from 'electron';

import type { IDesktopMainProcessDevOnlyApiParams } from '@onekeyhq/shared/types/desktop';

import { ipcMessageKeys } from './config';

function init() {
  ipcMain.on(
    ipcMessageKeys.APP_DEV_ONLY_API,
    (event, apiParams: IDesktopMainProcessDevOnlyApiParams) => {
      if (process.env.NODE_ENV !== 'production') {
        const { module, method, params } = apiParams;
        console.log('call APP_DEV_ONLY_API::', module, method, params);
        if (module === 'shell') {
          // @ts-ignore
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call
          shell[method](...params);
        }
      }
    },
  );
}

export default {
  init,
};

import * as path from 'path';

import { shell } from 'electron';
import logger from 'electron-log/main';

import * as store from '@onekeyhq/desktop/app/libs/store';
import type { IDesktopMainProcessDevOnlyApiParams } from '@onekeyhq/shared/types/desktop';

import type { IDesktopApi } from './instance/IDesktopApi';

class DesktopApiDev {
  constructor({ desktopApi }: { desktopApi: IDesktopApi }) {
    this.desktopApi = desktopApi;
  }

  desktopApi: IDesktopApi;

  async callDevOnlyApi(
    params: IDesktopMainProcessDevOnlyApiParams,
  ): Promise<any> {
    if (process.env.NODE_ENV !== 'production') {
      const { module, method, params: apiParams } = params;
      console.log('call APP_DEV_ONLY_API::', module, method, apiParams);
      if (module === 'shell') {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        return (shell as any)[method](...apiParams);
      }
    }
    return undefined;
  }

  async openLoggerFile(): Promise<void> {
    await shell.openPath(path.dirname(logger.transports.file.getFile().path));
  }

  async changeDevTools(isOpen: boolean): Promise<void> {
    store.setDevTools(isOpen);
    globalThis.$desktopMainAppFunctions?.refreshMenu?.();
  }

  // not working, use globalThis.desktopApi.testCrash(); instead
  // async testCrash(): Promise<void> {}
}

export default DesktopApiDev;

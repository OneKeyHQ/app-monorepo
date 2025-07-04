import { ipcRenderer } from 'electron';

import { ipcMessageKeys } from '@onekeyhq/desktop/app/config';
import type { IDesktopMainProcessDevOnlyApiParams } from '@onekeyhq/shared/types/desktop';

class DesktopApiDev {
  callDevOnlyApi(params: IDesktopMainProcessDevOnlyApiParams): any {
    return ipcRenderer.sendSync(ipcMessageKeys.APP_DEV_ONLY_API, params);
  }

  openLoggerFile(): void {
    ipcRenderer.send(ipcMessageKeys.APP_OPEN_LOGGER_FILE);
  }

  testCrash(): void {
    ipcRenderer.send(ipcMessageKeys.APP_TEST_CRASH);
  }
}

export default DesktopApiDev;
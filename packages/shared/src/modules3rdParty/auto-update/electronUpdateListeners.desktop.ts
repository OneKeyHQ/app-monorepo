import { ipcMessageKeys } from '@onekeyhq/desktop/app/config';
import type { IUpdateProgressUpdate } from '@onekeyhq/kit-bg/src/desktopApis/DesktopApiAppUpdate';

import type { IElectronUpdateListeners, IUpdateDownloadedEvent } from './type';

export const electronUpdateListeners: IElectronUpdateListeners = {
  onProgressUpdate: (callback: (params: IUpdateProgressUpdate) => void) => {
    return globalThis.desktopApi.on(
      ipcMessageKeys.UPDATE_DOWNLOADING,
      callback,
    );
  },
  onDownloaded: (callback: (params: IUpdateDownloadedEvent) => void) => {
    return globalThis.desktopApi.on(ipcMessageKeys.UPDATE_DOWNLOADED, callback);
  },
  onDownloadedFileEvent: (callback: (fileUrl: string) => void) => {
    return globalThis.desktopApi.on(
      ipcMessageKeys.UPDATE_DOWNLOAD_FILE_INFO,
      callback,
    );
  },
  onUpdateError: (callback: (params: { message: string }) => void) => {
    return globalThis.desktopApi.on(ipcMessageKeys.UPDATE_ERROR, callback);
  },
};

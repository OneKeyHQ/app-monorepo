import type { IElectronUpdateListeners } from './type';

export const electronUpdateListeners = {
  onProgressUpdate: () => {},
  onDownloaded: () => {},
  onDownloadedFileEvent: () => {},
  onUpdateError: () => {},
} as IElectronUpdateListeners;

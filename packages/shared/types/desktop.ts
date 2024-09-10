import type { BrowserWindow } from 'electron';

export type IPrefType =
  | 'default'
  | 'camera'
  | 'bluetooth'
  | 'location'
  | 'notification'
  | 'locationService'
  | 'localNetwork';

export type IMediaType = 'camera' | 'microphone' | 'screen';

export type IDesktopAppState = 'active' | 'background' | 'blur';

export type IDesktopSubModuleInitParams = {
  APP_NAME: string;
  getSafelyMainWindow: () => BrowserWindow | undefined;
};

export type IDesktopMainProcessDevOnlyApiParams = {
  module: string;
  method: string;
  params: any[];
};

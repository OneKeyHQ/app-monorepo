import type { INotificationPushMessageInfo } from '@onekeyhq/shared/types/notification';

export interface ILaunchOptionsNotificationInfo {
  fireDate: number | null;
  userInfo: INotificationPushMessageInfo;
}

export interface ILaunchOptionsManagerInterface {
  getLaunchOptions(): Promise<ILaunchOptions | null>;
  clearLaunchOptions(): Promise<boolean>;
  // Drains (returns once, then clears) the payload of a LOCAL notification the
  // user tapped to launch a killed app. Null when there is none. iOS-only
  // meaningful; other platforms always resolve null.
  getAndClearColdStartLocalNotification(): Promise<INotificationPushMessageInfo | null>;
  getDeviceToken(): Promise<string | null>;
  getStartupTime(): Promise<number>;
  getStartupTimeAt(): Promise<number>;
  getJSReadyTimeAt(): Promise<number>;
  getUIVisibleTimeAt(): Promise<number>;
  getJSReadyTime(): Promise<number>;
  getUIVisibleTime(): Promise<number>;
  getBundleStartTime(): Promise<number>;
  getJsReadyFromPerformanceNow(): Promise<number>;
  getUIVisibleFromPerformanceNow(): Promise<number>;
  registerDeviceToken(): Promise<boolean>;
}

export enum ELaunchOptionsLaunchType {
  localNotification = 'localNotification',
  remoteNotification = 'remoteNotification',
  normal = 'normal',
}

export interface ILaunchOptions {
  localNotification?: ILaunchOptionsNotificationInfo;
  remoteNotification?: ILaunchOptionsNotificationInfo;
  launchType: ELaunchOptionsLaunchType;
}

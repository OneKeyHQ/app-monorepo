import type { INotificationPushMessageInfo } from '@onekeyhq/shared/types/notification';

export interface ILaunchOptionsNotificationInfo {
  fireDate: number | null;
  userInfo: INotificationPushMessageInfo;
}

export interface ILaunchOptionsManagerInterface {
  getLaunchOptions(): Promise<ILaunchOptions | null>;
  clearLaunchOptions(): Promise<boolean>;
  getDeviceToken(): Promise<string | null>;
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

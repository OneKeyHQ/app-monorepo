export interface ILaunchOptionsNotificationInfo {
  fireDate: number | null;
  userInfo: Record<string, any> | null;
}

export interface ILaunchOptionsManagerInterface {
  getLaunchOptions(): Promise<ILaunchOptions | null>;
  clearLaunchOptions(): Promise<boolean>;
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

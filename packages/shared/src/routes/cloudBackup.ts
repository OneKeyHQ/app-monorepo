export enum ECloudBackupRoutes {
  CloudBackupHome = 'CloudBackupHome',
  CloudBackupList = 'CloudBackupList',
  CloudBackupDetail = 'CloudBackupDetail',
}

export type ICloudBackupParamList = {
  [ECloudBackupRoutes.CloudBackupHome]: undefined;
  [ECloudBackupRoutes.CloudBackupList]: {
    deviceInfo: { deviceName: string; osName: string };
  };
  [ECloudBackupRoutes.CloudBackupDetail]: {
    item: { filename: string; backupTime: number };
  };
};

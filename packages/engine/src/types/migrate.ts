import type { IDistributionChannel } from '@onekeyhq/shared/src/platformEnv';

export type MigrateServiceResp<T> = {
  success?: boolean;
  data?: T;
  message?: string;
  code?: number;
};

export type MigrateData = {
  private: string;
  public: string;

  appVersion?: string; // undefined if old version
};

export type DeviceInfo = {
  deviceName: string;
  platform: string;
  channel?: IDistributionChannel;
  version: string;
  buildNumber?: string;
};

export enum MigrateErrorCode {
  ConnectFail = 400,
  EncryptFail = 1000,
  DecryptFail = 1001,
  PublicKeyError = 1002,
  RejectData = 1003,
  UUIDNotMatch = 1004,
  KetPairLose = 1005,
}

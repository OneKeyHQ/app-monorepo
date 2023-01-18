import type { IDistributionChannel } from '@onekeyhq/shared/src/platformEnv';

export type MigrateServiceResp<T> = {
  success?: boolean;
  data?: T;
};

export type MigrateData = {
  private: string;
  public: string;
};

export type DeviceInfo = {
  deviceName: string;
  platform: string;
  channel?: IDistributionChannel;
  version: string;
  buildNumber?: string;
};

import type { ICloudSyncServerItem } from './prime/primeCloudSyncTypes';
import type { EPrimeCloudSyncDataType } from '../src/consts/primeConsts';

export enum EAppSocketEventNames {
  notification = 'notification',
  ping = 'ping',
  pong = 'pong',
  ack = 'ack',
  market = 'market',
  primeConfigChanged = 'CONFIG_CHANGE',
  primeSubscriptionChanged = 'SUBSCRIPTION_CHANGE',
  primeDeviceLogout = 'DEVICE_LOGOUT',
  primeConfigFlush = 'CONFIG_FLUSH',
  primeLockChanged = 'LOCK_CHANGE',
}

export type IPrimeSubscriptionInfo = {
  userId: string;
  nonce: number;
};

export type IPrimeDeviceLogoutInfo = {
  id: string;
  emails: string[];
};

export type IPrimeConfigChangedInfo = {
  nonce: number;
  serverData: ICloudSyncServerItem[];
};

export type IPrimeConfigFlushInfo = {
  lock: {
    key: string;
    dataType: EPrimeCloudSyncDataType.Lock;
    data: string;
    dataTimestamp: number;
    isDeleted: boolean;
  };
  pwdHash: string;
  nonce: number;
  serverData: ICloudSyncServerItem[];
};

export type IPrimeLockChangedInfo = {
  lock: {
    key: string;
    dataType: EPrimeCloudSyncDataType.Lock;
    data: string;
    dataTimestamp: number;
    isDeleted: boolean;
  };
  pwdHash: string;
};

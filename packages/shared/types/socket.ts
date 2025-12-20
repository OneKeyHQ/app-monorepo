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
  msgId: string;
  id: string;
  emails: string[];
};

export type IPrimeConfigChangedInfo = {
  msgId: string;
  nonce: number;
  pwdHash: string;
  serverData: ICloudSyncServerItem[];
};

export type IPrimeConfigFlushInfo = {
  msgId: string;
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
  msgId: string;
  lock: {
    key: string;
    dataType: EPrimeCloudSyncDataType.Lock;
    data: string;
    dataTimestamp: number;
    isDeleted: boolean;
  };
  pwdHash: string;
};

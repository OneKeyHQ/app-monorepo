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
  hardwareSyncSessionRevoked = 'HW_SYNC_SESSION_REVOKED',
  setBadge = 'SET_BADGE',
  userInfoUpdated = 'USER_INFO_UPDATED',
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
    pwdHash: string;
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
    pwdHash: string;
  };
  pwdHash: string;
};

// A hardware Cloud sync session was revoked, e.g. by a key reset on another
// device. Only the revoked session's own id.
export type IHardwareSyncSessionRevokedInfo = {
  msgId: string;
  sessionId: string;
};

export type ISetBadgeInfo = {
  msgId: string;
  badge: number;
};

export interface IUserInfoUpdatedPayload {
  msgId: string;
}

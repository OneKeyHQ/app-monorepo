export enum EAppSocketEventNames {
  notification = 'notification',
  ping = 'ping',
  pong = 'pong',
  ack = 'ack',
  primeConfigChanged = 'CONFIG_CHANGE',
  primeSubscriptionChanged = 'SUBSCRIPTION_CHANGE',
  primeDeviceLogout = 'DEVICE_LOGOUT',
}

export type IPrimeConfigInfo = {
  nonce: number;
  serverData: Array<{
    key: string;
    userId: string;
  }>;
};

export type IPrimeSubscriptionInfo = {
  userId: string;
  nonce: number;
};

export type IPrimeDeviceLogoutInfo = {
  id: string;
  emails: string[];
};

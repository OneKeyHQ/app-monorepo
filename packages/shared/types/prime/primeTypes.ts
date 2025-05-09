export type IPrimeSubscriptionInfo = {
  isActive: boolean;
  expiresAt: number;
};
export type IPrimeUserInfo = {
  isLoggedIn: boolean; // privy login status
  isLoggedInOnServer: boolean; // server login status
  email: string | undefined;
  displayEmail: string | undefined;
  privyUserId: string | undefined;
  subscriptionManageUrl: string | undefined;
  primeSubscription: IPrimeSubscriptionInfo | undefined;
};

export type IPrimeDeviceInfo = {
  instanceId: string;
  lastLoginTime: string;
  platform: string;
  platformName: string | undefined;
  version: string;
  deviceName: string;
};

export type IPrimeServerUserInfo = {
  createdAt: string;
  updatedAt: string;

  isPrime: boolean;
  primeExpiredAt: number;
  level: 'PRIME' | 'NORMAL';
  salt: string;
  pwdHash: string;
  userId: string;
  emails: string[];
  // isLogin

  inviteCode: string;
};

export enum ESecurityPasswordType {
  CloudSyncR1 = 'CloudSyncR1', // risk level 1 (low), for wallet names, bookmarks, etc.
  CloudSyncR5 = 'CloudSyncR5', // risk level 5 (high), for wallet private keys, mnemonic words, etc.
}

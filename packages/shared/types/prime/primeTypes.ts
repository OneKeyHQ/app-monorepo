export type IPrimeSubscriptionInfo = {
  isActive: boolean;
  expiresAt: number;
  subscriptions?: {
    id?: string;
    managementUrl?: string;
  }[];
  willRenew?: boolean;
};
export type IPrimeUserInfo = {
  isLoggedIn: boolean; // local supabase sdk login status
  isLoggedInOnServer: boolean; // server api login status
  isEnablePrime: boolean | undefined;
  isEnableSandboxPay: boolean | undefined;
  isPrimeDeviceLimitExceeded: boolean | undefined;
  email: string | undefined; // update by local supabase sdk
  keylessWalletId: string | undefined; // packSetId
  displayEmail: string | undefined; // update by server api
  nickname: string | undefined; // update by server api
  avatar: string | undefined; // update by server api
  onekeyUserId: string | undefined;
  subscriptionManageUrl: string | undefined; // update by local revenuecat sdk: Purchases.getCustomerInfo()
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
  avatar: string | undefined; // update by server api
  nickname: string | undefined; // update by server api
  createdAt: string;
  updatedAt: string;

  isEnablePrime: boolean | undefined;
  isEnableSandboxPay: boolean | undefined;
  isPrime: boolean;
  isPrimeDeviceLimitExceeded: boolean | undefined;
  primeExpiredAt: number;
  level: 'PRIME' | 'NORMAL';
  keylessWalletId: string | undefined; // packSetId
  salt: string;
  pwdHash: string;
  userId: string;
  emails: string[];
  subscriptions?: {
    id?: string;
    managementUrl?: string;
  }[];
  willRenew?: boolean;
  // isLogin

  inviteCode: string;
};

export enum ESecurityPasswordType {
  CloudSyncR1 = 'CloudSyncR1', // risk level 1 (low), for wallet names, bookmarks, etc.
  CloudSyncR5 = 'CloudSyncR5', // risk level 5 (high), for wallet private keys, mnemonic words, etc.
}

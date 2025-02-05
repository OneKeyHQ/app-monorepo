export type IPrimeSubscriptionInfo = {
  isActive: boolean;
  expiresAt: number;
};
export type IPrimeUserInfo = {
  isLoggedIn: boolean;
  email: string | undefined;
  privyUserId: string | undefined;
  subscriptionManageUrl: string | undefined;
  primeSubscription: IPrimeSubscriptionInfo | undefined;
};

export type IPrimeServerUserInfo = {
  createdAt: string;
  updatedAt: string;

  lastChangeUUID: string;

  isPrime: boolean;
  primeExpiredAt: number;
  level: 'PRIME' | 'NORMAL';
  salt: string;
  userId: string;
  // email
  // isLogin
};

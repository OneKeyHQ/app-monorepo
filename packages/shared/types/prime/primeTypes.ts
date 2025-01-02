export type IPrimeUserInfo = {
  isLoggedIn: boolean;
  email: string | undefined;
  privyUserId: string | undefined;
  subscriptionManageUrl: string | undefined;
  primeSubscription:
    | {
        isActive: boolean;
        expiresAt: number;
        plan: string;
      }
    | undefined;
};

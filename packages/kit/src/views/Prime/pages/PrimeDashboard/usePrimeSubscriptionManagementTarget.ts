import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import type { IPrimeSubscriptionInfo } from '@onekeyhq/shared/types/prime/primeTypes';

import {
  type IPrimeSubscriptionManagementTarget,
  getPrimeSubscriptionManagementSourceKey,
  getPrimeSubscriptionManagementTarget,
} from './primeSubscriptionManagementUtils';

export function usePrimeSubscriptionManagementTarget({
  primeSubscription,
  onekeyUserId,
}: {
  primeSubscription: IPrimeSubscriptionInfo | undefined;
  onekeyUserId: string | undefined;
}): IPrimeSubscriptionManagementTarget | undefined {
  const isPrime = primeSubscription?.isActive === true;
  const currentTarget = getPrimeSubscriptionManagementTarget({
    userInfo: { primeSubscription },
  });
  const subscriptionSourceKey = getPrimeSubscriptionManagementSourceKey({
    primeSubscription,
  });
  const shouldResolve = Boolean(isPrime && onekeyUserId);
  const { result: resolution } = usePromiseResult(
    async () => {
      if (!isPrime || !onekeyUserId) {
        return undefined;
      }
      const { userInfo } =
        await backgroundApiProxy.servicePrime.apiFetchPrimeUserInfo({
          forceRefresh: true,
        });
      return {
        onekeyUserId,
        subscriptionSourceKey,
        target: getPrimeSubscriptionManagementTarget({
          userInfo,
        }),
      };
    },
    [isPrime, onekeyUserId, subscriptionSourceKey],
    {
      undefinedResultIfError: true,
      undefinedResultIfReRun: true,
    },
  );

  if (!shouldResolve) {
    return undefined;
  }
  const resolved =
    resolution &&
    resolution.onekeyUserId === onekeyUserId &&
    resolution.subscriptionSourceKey === subscriptionSourceKey
      ? resolution.target
      : undefined;
  return resolved ?? currentTarget;
}

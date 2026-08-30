/* cspell:ignore Infini */
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import type { IPrimeSubscriptionInfo } from '@onekeyhq/shared/types/prime/primeTypes';

import { usePrimePayment } from '../../hooks/usePrimePayment';
import { isInfiniSubscriptionInPeriod } from '../PrimeInfiniSubscription/infiniSubscriptionUtils';

import {
  type IPrimeSubscriptionManagementTarget,
  getPrimeSubscriptionManagementSourceKey,
  getPrimeSubscriptionManagementTarget,
  hasRevenueCatSubscriptionChannel,
  isMissingChannelManagementTarget,
} from './primeSubscriptionManagementUtils';

export function usePrimeSubscriptionManagementTarget({
  primeSubscription,
  subscriptionManageUrl,
  onekeyUserId,
}: {
  primeSubscription: IPrimeSubscriptionInfo | undefined;
  subscriptionManageUrl: string | undefined;
  onekeyUserId: string | undefined;
}): IPrimeSubscriptionManagementTarget | undefined {
  const { getCustomerInfo } = usePrimePayment();
  const isPrime = primeSubscription?.isActive === true;
  const currentTarget = getPrimeSubscriptionManagementTarget({
    userInfo: { primeSubscription, subscriptionManageUrl },
  });
  const subscriptionSourceKey = getPrimeSubscriptionManagementSourceKey({
    primeSubscription,
    subscriptionManageUrl,
  });
  const shouldResolve = Boolean(isPrime && onekeyUserId);
  const shouldProbeLegacyInfini =
    isMissingChannelManagementTarget(currentTarget);
  const { result: resolution } = usePromiseResult(
    async () => {
      if (!isPrime || !onekeyUserId) {
        return undefined;
      }
      const { userInfo } =
        await backgroundApiProxy.servicePrime.apiFetchPrimeUserInfo({
          forceRefresh: true,
        });
      let target = getPrimeSubscriptionManagementTarget({
        userInfo,
      });
      if (
        target.type === 'unavailable' &&
        hasRevenueCatSubscriptionChannel({
          subscriptions: userInfo.primeSubscription?.subscriptions,
        })
      ) {
        try {
          const customerInfo = await getCustomerInfo();
          const revenueCatManagementUrl = customerInfo.managementURL?.trim();
          if (revenueCatManagementUrl) {
            target = getPrimeSubscriptionManagementTarget({
              userInfo: {
                ...userInfo,
                subscriptionManageUrl: revenueCatManagementUrl,
              },
            });
          }
        } catch {
          // Keep the unresolved target; the menu still toasts.
        }
      }
      if (shouldProbeLegacyInfini && isMissingChannelManagementTarget(target)) {
        const infiniSubscription =
          await backgroundApiProxy.servicePrime.apiGetInfiniSubscription({
            expectedOneKeyUserId: onekeyUserId,
          });
        if (isInfiniSubscriptionInPeriod(infiniSubscription)) {
          target = { type: 'infini' };
        }
      }
      return {
        onekeyUserId,
        subscriptionSourceKey,
        target,
      };
    },
    [
      getCustomerInfo,
      isPrime,
      onekeyUserId,
      shouldProbeLegacyInfini,
      subscriptionSourceKey,
    ],
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

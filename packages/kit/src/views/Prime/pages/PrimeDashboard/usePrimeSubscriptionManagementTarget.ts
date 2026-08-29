/* cspell:ignore Infini */
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IPrimeSubscriptionInfo } from '@onekeyhq/shared/types/prime/primeTypes';

import { isInfiniSubscriptionInPeriod } from '../PrimeInfiniSubscription/infiniSubscriptionUtils';

import {
  type IPrimeSubscriptionManagementTarget,
  getPrimeSubscriptionManagementTarget,
} from './primeSubscriptionManagementUtils';

type IAvailableManagementTarget = Exclude<
  IPrimeSubscriptionManagementTarget,
  { type: 'unavailable' }
>;

const isInfiniManageSupported =
  !platformEnv.isNativeIOS && !platformEnv.isNativeAndroidGooglePlay;

export function usePrimeSubscriptionManagementTarget({
  primeSubscription,
  subscriptionManageUrl,
  onekeyUserId,
}: {
  primeSubscription: IPrimeSubscriptionInfo | undefined;
  subscriptionManageUrl: string | undefined;
  onekeyUserId: string | undefined;
}): IAvailableManagementTarget | undefined {
  const isPrime = primeSubscription?.isActive === true;
  const currentTarget = getPrimeSubscriptionManagementTarget({
    userInfo: { primeSubscription, subscriptionManageUrl },
    isInfiniManageSupported,
  });
  const subscriptionSourceKey = JSON.stringify([
    primeSubscription?.expiresAt,
    primeSubscription?.subscriptions,
    subscriptionManageUrl,
  ]);
  const shouldResolve = Boolean(
    isPrime && onekeyUserId && currentTarget.type === 'unavailable',
  );
  const shouldProbeLegacyInfini =
    isInfiniManageSupported &&
    currentTarget.type === 'unavailable' &&
    currentTarget.reason === 'missing-channel-and-management-url';
  const { result: resolution, isLoading } = usePromiseResult(
    async () => {
      if (!shouldResolve || !onekeyUserId) {
        return undefined;
      }
      const { userInfo } =
        await backgroundApiProxy.servicePrime.apiFetchPrimeUserInfo({
          forceRefresh: true,
        });
      let target = getPrimeSubscriptionManagementTarget({
        userInfo,
        isInfiniManageSupported,
      });
      if (
        shouldProbeLegacyInfini &&
        target.type === 'unavailable' &&
        target.reason === 'missing-channel-and-management-url'
      ) {
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
      onekeyUserId,
      shouldProbeLegacyInfini,
      shouldResolve,
      subscriptionSourceKey,
    ],
    {
      watchLoading: true,
      undefinedResultIfError: true,
      undefinedResultIfReRun: true,
    },
  );

  if (!isPrime || !onekeyUserId) {
    return undefined;
  }
  if (currentTarget.type !== 'unavailable') {
    return currentTarget;
  }
  if (
    isLoading ||
    !resolution ||
    resolution.onekeyUserId !== onekeyUserId ||
    resolution.subscriptionSourceKey !== subscriptionSourceKey ||
    resolution.target.type === 'unavailable'
  ) {
    return undefined;
  }
  return resolution.target;
}

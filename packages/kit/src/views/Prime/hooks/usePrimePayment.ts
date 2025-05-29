import { useEffect, useRef } from 'react';

import type { IPrimeUserInfo } from '@onekeyhq/shared/types/prime/primeTypes';

import { usePrimeAuthV2 } from './usePrimeAuthV2';
import { usePrimePaymentMethods } from './usePrimePaymentMethods';

import type {
  IRevenueCatCustomerInfoNative,
  IRevenueCatCustomerInfoWeb,
  IUsePrimePayment,
} from './usePrimePaymentTypes';

export function usePrimePayment(): IUsePrimePayment {
  const { user } = usePrimeAuthV2();

  const {
    getCustomerInfo,
    isReady,
    restorePurchases,
    getPackagesNative,
    purchasePackageNative,
    getPackagesWeb,
    purchasePackageWeb,
  } = usePrimePaymentMethods();

  const userRef = useRef<IPrimeUserInfo>(user);
  userRef.current = user;

  useEffect(() => {
    void (async () => {
      if (isReady && user?.privyUserId) {
        const customerInfo = await getCustomerInfo();

        const customerInfoWeb = customerInfo as IRevenueCatCustomerInfoWeb;
        const customerInfoNative =
          customerInfo as IRevenueCatCustomerInfoNative;

        const localIsActive =
          customerInfo?.entitlements?.active?.Prime?.isActive;
        const localWillRenew =
          customerInfo?.entitlements?.active?.Prime?.willRenew;
        const localIsSandbox =
          customerInfo?.entitlements?.active?.Prime?.isSandbox;
        const localSubscriptionManageUrl = customerInfo?.managementURL;

        let localExpiresAt = 0;
        if (
          customerInfoNative?.entitlements?.active?.Prime?.expirationDateMillis
        ) {
          localExpiresAt =
            customerInfoNative.entitlements.active.Prime.expirationDateMillis;
        } else if (
          customerInfoWeb?.entitlements?.active?.Prime?.expirationDate?.getTime
        ) {
          localExpiresAt =
            customerInfoWeb.entitlements.active.Prime.expirationDate?.getTime() ??
            0;
        }

        console.log('prime payment status ===========================', {
          local: {
            $customerInfo: customerInfo,
            isActive: localIsActive,
            willRenew: localWillRenew,
            expiresAt: localExpiresAt,
            isSandbox: localIsSandbox,
            subscriptionManageUrl: localSubscriptionManageUrl,
          },
          server: {
            $user: userRef.current,
            isActive: userRef.current.primeSubscription?.isActive,
            expiresAt: userRef.current.primeSubscription?.expiresAt,
            willRenew: userRef.current.primeSubscription?.willRenew,
            subscriptions: userRef.current.primeSubscription?.subscriptions,
          },
        });
        if (localIsActive !== userRef.current.primeSubscription?.isActive) {
          console.log(
            'prime payment status not match ===========================',
          );
        }
      }
    })();
  }, [getCustomerInfo, isReady, user?.privyUserId]);

  return {
    getCustomerInfo,
    isReady,
    restorePurchases,
    getPackagesNative,
    purchasePackageNative,
    getPackagesWeb,
    purchasePackageWeb,
  };
}

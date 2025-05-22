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
        let localExpiresAt = 0;
        if (!localWillRenew) {
          if (
            customerInfoNative?.entitlements?.active?.Prime
              ?.expirationDateMillis
          ) {
            localExpiresAt =
              customerInfoNative.entitlements.active.Prime.expirationDateMillis;
          } else if (
            customerInfoWeb?.entitlements?.active?.Prime?.expirationDate
              ?.getTime
          ) {
            localExpiresAt =
              customerInfoWeb.entitlements.active.Prime.expirationDate?.getTime() ??
              0;
          }
        }

        if (localIsActive !== userRef.current.primeSubscription?.isActive) {
          console.log('prime payment status not match', {
            local: {
              customerInfo,
              isActive: localIsActive,
              willRenew: localWillRenew,
              expiresAt: localExpiresAt,
            },
            server: {
              user: userRef.current,
            },
          });
        }
      }
    })();
  }, [getCustomerInfo, isReady, user?.privyUserId]);

  return {
    getCustomerInfo,
    isReady,
    getPackagesNative,
    purchasePackageNative,
    getPackagesWeb,
    purchasePackageWeb,
  };
}

import { useRef } from 'react';

import type { IPrimeUserInfo } from '@onekeyhq/shared/types/prime/primeTypes';

import { usePrimeAuthV2 } from './usePrimeAuthV2';
import { usePrimePaymentMethods } from './usePrimePaymentMethods';

import type { IUsePrimePayment } from './usePrimePaymentTypes';

export function usePrimePayment(): IUsePrimePayment {
  const { user } = usePrimeAuthV2();
  const userRef = useRef<IPrimeUserInfo>(user);
  userRef.current = user;

  const {
    getCustomerInfo,
    isReady,
    restorePurchases,
    getPackagesNative,
    purchasePackageNative,
    getPackagesWeb,
    purchasePackageWeb,
  } = usePrimePaymentMethods();

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

import { useRef } from 'react';

import { useOneKeyAuth } from '@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth';
import type { IPrimeUserInfo } from '@onekeyhq/shared/types/prime/primeTypes';

import { usePrimePaymentMethods } from './usePrimePaymentMethods';

import type { IUsePrimePayment } from './usePrimePaymentTypes';

export function usePrimePayment(): IUsePrimePayment {
  const { user } = useOneKeyAuth();
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

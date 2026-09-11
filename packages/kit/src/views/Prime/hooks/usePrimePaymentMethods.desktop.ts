import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { desktopStorePurchasesSdk } from './desktopStorePurchasesSdk';
import { usePrimePaymentMethodsStore } from './usePrimePaymentMethodsStore';
import { usePrimePaymentMethodsWeb } from './usePrimePaymentMethodsWeb';

function usePrimePaymentMethodsMacAppStore() {
  return usePrimePaymentMethodsStore(desktopStorePurchasesSdk);
}

export const usePrimePaymentMethods = platformEnv.isMas
  ? usePrimePaymentMethodsMacAppStore
  : usePrimePaymentMethodsWeb;

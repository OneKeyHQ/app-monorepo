import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { createDesktopStorePurchasesSdk } from './desktopStorePurchasesSdk';
import { usePrimePaymentMethodsStore } from './usePrimePaymentMethodsStore';
import { usePrimePaymentMethodsWeb } from './usePrimePaymentMethodsWeb';

function usePrimePaymentMethodsMacAppStore() {
  const intl = useIntl();
  const sdk = useMemo(() => createDesktopStorePurchasesSdk(intl), [intl]);
  return usePrimePaymentMethodsStore(sdk);
}

export const usePrimePaymentMethods = platformEnv.isMas
  ? usePrimePaymentMethodsMacAppStore
  : usePrimePaymentMethodsWeb;

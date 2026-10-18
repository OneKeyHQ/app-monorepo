import PurchasesReactNative from 'react-native-purchases';

import type { IPrimeWebPurchaseLinkConfig } from '@onekeyhq/shared/src/consts/primeConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import openUrlUtils from '@onekeyhq/shared/src/utils/openUrlUtils';
import type { IPrimeWebCheckoutPendingSession } from '@onekeyhq/shared/types/prime/primeTypes';

import { getPrimePaymentApiKey } from './getPrimePaymentApiKey';
import { configureRevenueCat } from './revenueCatNativeCompatibility.native';

import type { IPrimeWebCheckoutEntitlement } from './primeWebCheckoutResult';
import type { IPrimeWebPurchaseLinkPackage } from './primeWebPurchaseLink';
import type { ISubscriptionPeriod } from './usePrimePaymentTypes';

const PRIME_ENTITLEMENT_ID = 'Prime';

// Android only: RevenueCat customer info is project-wide, so the store SDK
// also sees Web Billing entitlements. The SDK key does not depend on the
// checkout's sandbox mode; `isSandbox` is compared on the entitlement.
export async function fetchPrimeWebCheckoutEntitlement({
  onekeyUserId,
}: {
  onekeyUserId: string;
  isSandbox: boolean;
}): Promise<IPrimeWebCheckoutEntitlement | undefined> {
  if (!onekeyUserId) {
    throw new OneKeyLocalError('Prime web checkout: missing OneKey ID');
  }
  if (!(await PurchasesReactNative.isConfigured())) {
    const { apiKey } = await getPrimePaymentApiKey({ apiKeyType: 'native' });
    configureRevenueCat({ apiKey });
  }
  if ((await PurchasesReactNative.getAppUserID()) !== onekeyUserId) {
    await PurchasesReactNative.logIn(onekeyUserId);
  }
  // The native SDK caches customer info; a poll must hit RevenueCat.
  await PurchasesReactNative.invalidateCustomerInfoCache();
  const customerInfo = await PurchasesReactNative.getCustomerInfo();
  if ((await PurchasesReactNative.getAppUserID()) !== onekeyUserId) {
    throw new OneKeyLocalError('AppUserId not match');
  }
  const entitlement = customerInfo.entitlements.active[PRIME_ENTITLEMENT_ID];
  if (!entitlement) {
    return undefined;
  }
  return {
    isActive: entitlement.isActive,
    // Native reports e.g. RC_BILLING; match the purchases-js values.
    store: entitlement.store.toLowerCase(),
    latestPurchaseDate: Number.isFinite(entitlement.latestPurchaseDateMillis)
      ? new Date(entitlement.latestPurchaseDateMillis)
      : null,
    isSandbox: entitlement.isSandbox,
    periodType: entitlement.periodType.toLowerCase(),
    productIdentifier: entitlement.productIdentifier,
  };
}

// purchases-js does not run in the native runtime. On Android the web-embed
// checkout page resolves the package and hands it over.
export async function resolvePrimeWebCheckoutPackage(_params: {
  config: IPrimeWebPurchaseLinkConfig;
  onekeyUserId: string;
  isSandbox: boolean;
  currency?: string;
  subscriptionPeriod: ISubscriptionPeriod;
}): Promise<IPrimeWebPurchaseLinkPackage> {
  throw new OneKeyLocalError(
    'Prime web checkout package must come from the web-embed checkout',
  );
}

// Opens the hosted checkout in the system browser; its return page brings the
// app back through the onekey-wallet:// deep link.
export async function openPrimeWebCheckoutPage(
  session: IPrimeWebCheckoutPendingSession,
): Promise<'opened' | 'navigatedAway'> {
  openUrlUtils.openUrlExternal(session.checkoutUrl, {
    useSystemBrowser: true,
  });
  return 'opened';
}

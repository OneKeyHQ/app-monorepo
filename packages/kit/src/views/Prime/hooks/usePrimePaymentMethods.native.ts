import PurchasesReactNative, {
  INTRO_ELIGIBILITY_STATUS,
  LOG_LEVEL,
  type PurchasesPackage,
} from 'react-native-purchases';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import {
  configureRevenueCat,
  getRevenueCatRecurringPriceUnit,
} from './revenueCatNativeCompatibility.native';
import { usePrimePaymentMethodsStore } from './usePrimePaymentMethodsStore';

import type { IPrimeStorePurchasesSdk } from './storePurchasesSdkTypes';

void (async () => {
  if (process.env.NODE_ENV !== 'production') {
    await PurchasesReactNative.setLogLevel(LOG_LEVEL.VERBOSE);
    // TODO VPN required
    await PurchasesReactNative.setProxyURL('https://api.rc-backup.com/');
  }
})();

async function getIOSIntroEligibleProductIds(
  nativePackages: PurchasesPackage[],
): Promise<ReadonlySet<string> | undefined> {
  if (!platformEnv.isNativeIOS) {
    return undefined;
  }

  const productIds = nativePackages.map(({ product }) => product.identifier);
  if (!productIds.length) {
    return new Set();
  }

  try {
    const eligibilityByProductId =
      await PurchasesReactNative.checkTrialOrIntroductoryPriceEligibility(
        productIds,
      );

    return new Set(
      productIds.filter(
        (productId) =>
          eligibilityByProductId[productId]?.status ===
          INTRO_ELIGIBILITY_STATUS.INTRO_ELIGIBILITY_STATUS_ELIGIBLE,
      ),
    );
  } catch {
    // RevenueCat recommends showing non-intro pricing when eligibility is
    // unknown to avoid misleading users.
    return new Set();
  }
}

const nativePurchasesSdk: IPrimeStorePurchasesSdk<PurchasesPackage> = {
  configure: ({ apiKey }) =>
    new Promise<void>((resolve, reject) => {
      // Native setup decodes cached CustomerInfo synchronously on the main
      // thread; defer it so the initial application render can finish first.
      requestIdleCallback(() => {
        try {
          configureRevenueCat({ apiKey });
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    }),
  logIn: (appUserId) => PurchasesReactNative.logIn(appUserId),
  getAppUserID: () => PurchasesReactNative.getAppUserID(),
  getCustomerInfo: () => PurchasesReactNative.getCustomerInfo(),
  getOfferings: () => PurchasesReactNative.getOfferings(),
  purchasePackage: (offering) => PurchasesReactNative.purchasePackage(offering),
  restorePurchases: () => PurchasesReactNative.restorePurchases(),
  setMixpanelDistinctID: (instanceId) =>
    PurchasesReactNative.setMixpanelDistinctID(instanceId),
  setAttributes: (attributes) => PurchasesReactNative.setAttributes(attributes),
  getIntroEligibleProductIds: getIOSIntroEligibleProductIds,
  getRecurringPriceUnit: getRevenueCatRecurringPriceUnit,
};

export function usePrimePaymentMethods() {
  return usePrimePaymentMethodsStore(nativePurchasesSdk);
}

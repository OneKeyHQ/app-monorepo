import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type * as PurchasesSdk from '@revenuecat/purchases-js';

let stripeV3Promise: Promise<unknown> | undefined;
let purchasesSdkPromise: Promise<typeof PurchasesSdk> | undefined;
let verboseLogLevelApplied = false;

async function loadStripeV3BeforeRevenueCat() {
  if (platformEnv.isNative) {
    return;
  }

  if (!stripeV3Promise) {
    const promise = import('@onekeyhq/shared/src/modules3rdParty/stripe-v3')
      .then(() => undefined)
      .catch((error: unknown) => {
        if (stripeV3Promise === promise) {
          stripeV3Promise = undefined;
        }
        throw error;
      });
    stripeV3Promise = promise;
  }

  await stripeV3Promise;
}

export async function loadPurchasesSdkWeb() {
  if (!purchasesSdkPromise) {
    const promise = loadStripeV3BeforeRevenueCat()
      .then(() => import('@revenuecat/purchases-js'))
      .then((sdk) => {
        if (process.env.NODE_ENV !== 'production' && !verboseLogLevelApplied) {
          console.log('Purchases.setLogLevel Verbose');
          sdk.Purchases.setLogLevel(sdk.LogLevel.Verbose);
          verboseLogLevelApplied = true;
        }
        return sdk;
      })
      .catch((error: unknown) => {
        if (purchasesSdkPromise === promise) {
          purchasesSdkPromise = undefined;
        }
        throw error;
      });
    purchasesSdkPromise = promise;
  }
  return purchasesSdkPromise;
}

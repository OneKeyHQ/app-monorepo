import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import {
  loadStripeJsForPrimeCheckout,
  shouldLoadStripeForPrimeCheckout,
} from './shouldLoadStripeForPrimeCheckout';
import { instrumentStripePaymentElementHealth } from './stripePaymentElementHealth';

import type * as PurchasesSdk from '@revenuecat/purchases-js';

export const PRIME_EMBEDDED_CHECKOUT_UNAVAILABLE_MESSAGE =
  'Embedded card checkout is unavailable in this runtime';

let stripeV3Promise: Promise<boolean> | undefined;
let purchasesSdkPromise: Promise<typeof PurchasesSdk> | undefined;
let isStripeV3LoadedBeforeSdk = false;
let verboseLogLevelApplied = false;

async function shouldLoadStripeV3() {
  if (platformEnv.isNative) {
    return false;
  }
  return shouldLoadStripeForPrimeCheckout();
}

async function importStripeV3(): Promise<boolean> {
  try {
    await loadStripeJsForPrimeCheckout();
  } catch (error) {
    // Stripe.js only powers the embedded card form. Keep purchases-js usable
    // so the card checkout can fall back to the hosted Purchase Link.
    console.error('Failed to load Stripe.js for Prime checkout', error);
    return false;
  }
  if (typeof (globalThis as { Stripe?: unknown }).Stripe !== 'function') {
    return false;
  }
  instrumentStripePaymentElementHealth();
  return true;
}

async function loadStripeV3BeforeRevenueCat(): Promise<boolean> {
  if (!stripeV3Promise) {
    const promise = shouldLoadStripeV3()
      .then((shouldLoad) => (shouldLoad ? importStripeV3() : false))
      .catch((error: unknown) => {
        if (stripeV3Promise === promise) {
          stripeV3Promise = undefined;
        }
        throw error;
      });
    stripeV3Promise = promise;
  }

  return stripeV3Promise;
}

// The Stripe decision is made once per JS runtime, before purchases-js is
// first imported: purchases-js initializes its Stripe loader at import time
// and our patch disables its remote js.stripe.com fallback.
export async function loadPurchasesSdkWeb() {
  if (!purchasesSdkPromise) {
    const promise = loadStripeV3BeforeRevenueCat()
      .then(async (isStripeV3Loaded) => {
        const sdk = await import('@revenuecat/purchases-js');
        isStripeV3LoadedBeforeSdk = isStripeV3Loaded;
        return sdk;
      })
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

// Without Stripe.js preloaded, the embedded purchase() never settles. Fail
// fast instead of leaving the checkout spinner hanging.
export async function loadPurchasesSdkWebForEmbeddedPurchase() {
  const sdk = await loadPurchasesSdkWeb();
  if (!isStripeV3LoadedBeforeSdk) {
    throw new OneKeyLocalError(PRIME_EMBEDDED_CHECKOUT_UNAVAILABLE_MESSAGE);
  }
  return sdk;
}

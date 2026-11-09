import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type * as PurchasesSdk from '@revenuecat/purchases-js';

const OFFICIAL_STRIPE_JS_URL = 'https://js.stripe.com/v3';

let stripeV3Promise: Promise<unknown> | undefined;
let purchasesSdkPromise: Promise<typeof PurchasesSdk> | undefined;
let verboseLogLevelApplied = false;

export function isPurchasesSdkWebLoaded(): boolean {
  return Boolean(purchasesSdkPromise);
}

// The isolated Prime checkout runs the same app shell with
// `?render=prime-purchase` (see apps/desktop/App.tsx). Only that view may load
// Stripe.js inside the desktop renderer: the desktop main window calls the
// RevenueCat REST APIs only, while the real `Purchases.purchase()` (Stripe
// Elements) runs in the isolated <webview> container.
function isDesktopPrimePurchaseRender() {
  if (!platformEnv.isDesktop) {
    return false;
  }
  const search = globalThis.location?.search ?? '';
  return new URLSearchParams(search).get('render') === 'prime-purchase';
}

function hasWindowStripe() {
  const globalWithStripe = globalThis as typeof globalThis & {
    Stripe?: unknown;
  };
  return 'Stripe' in globalWithStripe && Boolean(globalWithStripe.Stripe);
}

// Stripe officially does not allow pinning Stripe.js to a fixed version or
// locking it with an SRI hash: the server hot-updates the script and its
// sub-chunks. Always prefer the official `https://js.stripe.com/v3` entry; the
// bundled copy is a network/offline fallback only.
async function loadOfficialStripeJs(): Promise<void> {
  if (hasWindowStripe()) {
    return;
  }
  await new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = OFFICIAL_STRIPE_JS_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      // Drop the failed tag so a retry (after the cached promise is reset)
      // never stacks duplicate Stripe.js script elements.
      script.remove();
      reject(new OneKeyLocalError('Failed to load official Stripe.js'));
    };
    (document.head || document.body).appendChild(script);
  });
}

async function importLocalStripeV3(): Promise<void> {
  await import('@onekeyhq/shared/src/modules3rdParty/stripe-v3');
}

async function loadStripeV3WithFallback(): Promise<void> {
  try {
    await loadOfficialStripeJs();
    if (!hasWindowStripe()) {
      throw new OneKeyLocalError(
        'Official Stripe.js did not expose window.Stripe',
      );
    }
  } catch (error) {
    console.warn(
      '[Prime] Falling back to the bundled Stripe.js:',
      error instanceof Error ? error.message : String(error),
    );
    await importLocalStripeV3();
  }
}

async function loadStripeV3BeforeRevenueCat() {
  if (platformEnv.isNative) {
    return;
  }

  const isDesktopPrimePurchaseView = isDesktopPrimePurchaseRender();
  if (platformEnv.isDesktop && !isDesktopPrimePurchaseView) {
    // Desktop main window: never load Stripe.js here. RevenueCat's
    // getOfferings/getCustomerInfo/changeUser only issue fetch requests, and
    // the checkout form itself lives in the isolated <webview>.
    return;
  }

  if (!stripeV3Promise) {
    const promise = (
      platformEnv.isWeb || platformEnv.isWebEmbed || isDesktopPrimePurchaseView
        ? loadStripeV3WithFallback()
        : importLocalStripeV3()
    ).catch((error: unknown) => {
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

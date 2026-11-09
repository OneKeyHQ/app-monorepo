import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

// Stripe.js only powers the embedded card checkout; the hosted Purchase Link
// dev override skips it.
export async function shouldLoadStripeForPrimeCheckout() {
  const { getPrimeCardCheckoutMode } =
    await import('../hooks/primeCardCheckoutMode');
  return (await getPrimeCardCheckoutMode()) === 'embedded';
}

const OFFICIAL_STRIPE_JS_URL = 'https://js.stripe.com/v3';

// The isolated Prime checkout renders the app shell with
// `?render=prime-purchase` (see apps/desktop/App.tsx). Only that desktop view
// may load Stripe.js: the desktop main window calls RevenueCat REST APIs only,
// while the real `Purchases.purchase()` (Stripe Elements) runs in the
// isolated <webview> container.
export function isDesktopPrimePurchaseRender() {
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
  return (
    'Stripe' in globalWithStripe &&
    typeof globalWithStripe.Stripe === 'function'
  );
}

// Stripe officially does not allow pinning Stripe.js to a fixed version or
// locking it with an SRI hash: the server hot-updates the script and its
// sub-chunks. Prefer the official `https://js.stripe.com/v3` entry; the
// bundled copy remains a network/offline fallback only.
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
  if (!hasWindowStripe()) {
    throw new OneKeyLocalError(
      'Official Stripe.js did not expose window.Stripe',
    );
  }
}

export async function loadStripeJsForPrimeCheckout() {
  const { shouldUseFaultyPrimeStripeJs } =
    await import('../hooks/primeCardCheckoutMode');
  if (await shouldUseFaultyPrimeStripeJs()) {
    await import('@onekeyhq/shared/src/modules3rdParty/stripe-v3/faulty-before-13914');
    return;
  }
  const useOfficialStripeJs =
    platformEnv.isWeb ||
    platformEnv.isWebEmbed ||
    isDesktopPrimePurchaseRender();
  if (!useOfficialStripeJs) {
    // Extension builds keep the bundled copy: MV3 CSP blocks remote scripts.
    await import('@onekeyhq/shared/src/modules3rdParty/stripe-v3');
    return;
  }
  try {
    await loadOfficialStripeJs();
  } catch (error) {
    console.warn(
      '[Prime] Falling back to the bundled Stripe.js:',
      error instanceof Error ? error.message : String(error),
    );
    await import('@onekeyhq/shared/src/modules3rdParty/stripe-v3');
  }
}

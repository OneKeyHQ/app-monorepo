import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

// 'embedded': purchases-js purchase() with the bundled Stripe Elements form.
// 'hostedLink': RevenueCat Web Purchase Link opened outside the app.
export type IPrimeCardCheckoutMode = 'embedded' | 'hostedLink';

// Each channel moves to hosted Purchase Links in its own rollout step.
function getDefaultPrimeCardCheckoutMode(): IPrimeCardCheckoutMode {
  if (platformEnv.isExtension) {
    return 'hostedLink';
  }
  return 'embedded';
}

let modePromise: Promise<IPrimeCardCheckoutMode> | undefined;

// Resolved once per JS runtime: the purchases-js loader decides once whether
// Stripe.js is loaded, so switching the dev override needs an app restart.
export function getPrimeCardCheckoutMode(): Promise<IPrimeCardCheckoutMode> {
  if (!modePromise) {
    modePromise = (async () => {
      const defaultMode = getDefaultPrimeCardCheckoutMode();
      if (defaultMode === 'embedded') {
        return defaultMode;
      }
      try {
        const devSettings =
          await backgroundApiProxy.serviceDevSetting.getDevSetting();
        if (
          devSettings?.enabled &&
          devSettings.settings?.usePrimeEmbeddedCardCheckout
        ) {
          return 'embedded';
        }
      } catch {
        // Dev overrides must never block checkout.
      }
      return defaultMode;
    })();
  }
  return modePromise;
}

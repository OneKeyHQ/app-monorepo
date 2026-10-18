import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';

// 'embedded': purchases-js purchase() with the bundled Stripe Elements form.
// 'hostedLink': RevenueCat Web Purchase Link opened outside the app.
export type IPrimeCardCheckoutMode = 'embedded' | 'hostedLink';

let modePromise: Promise<IPrimeCardCheckoutMode> | undefined;

// Every channel starts with the embedded form and only falls back to the
// hosted Purchase Link when it fails; the dev override skips Stripe so the
// hosted flow can be tested directly.
// Resolved once per JS runtime: the purchases-js loader decides once whether
// Stripe.js is loaded, so switching the dev override needs an app restart.
export function getPrimeCardCheckoutMode(): Promise<IPrimeCardCheckoutMode> {
  if (!modePromise) {
    modePromise = (async () => {
      try {
        const devSettings =
          await backgroundApiProxy.serviceDevSetting.getDevSetting();
        if (
          devSettings?.enabled &&
          devSettings.settings?.usePrimeHostedCardCheckout
        ) {
          return 'hostedLink';
        }
      } catch {
        // Dev overrides must never block checkout.
      }
      return 'embedded';
    })();
  }
  return modePromise;
}

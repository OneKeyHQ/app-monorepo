import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';

// 'embedded': purchases-js purchase() with the bundled Stripe Elements form.
// 'hostedLink': RevenueCat Web Purchase Link opened outside the app.
export type IPrimeCardCheckoutMode = 'embedded' | 'hostedLink';

type IPrimeCardCheckoutSettings = {
  mode: IPrimeCardCheckoutMode;
  useFaultyStripeJs: boolean;
};

let settingsPromise: Promise<IPrimeCardCheckoutSettings> | undefined;

// Every channel starts with the embedded form and only falls back to the
// hosted Purchase Link when it fails; the dev override skips Stripe so the
// hosted flow can be tested directly.
// Resolved once per JS runtime: the purchases-js loader decides once whether
// Stripe.js is loaded, so switching the dev override needs an app restart.
function getPrimeCardCheckoutSettings(): Promise<IPrimeCardCheckoutSettings> {
  if (!settingsPromise) {
    settingsPromise = (async (): Promise<IPrimeCardCheckoutSettings> => {
      try {
        const devSettings =
          await backgroundApiProxy.serviceDevSetting.getDevSetting();
        if (devSettings?.enabled) {
          return {
            mode: devSettings.settings?.usePrimeHostedCardCheckout
              ? 'hostedLink'
              : 'embedded',
            useFaultyStripeJs: Boolean(
              devSettings.settings?.useFaultyPrimeStripeJs,
            ),
          };
        }
      } catch {
        // Dev overrides must never block checkout.
      }
      return { mode: 'embedded', useFaultyStripeJs: false };
    })();
  }
  return settingsPromise;
}

export async function getPrimeCardCheckoutMode(): Promise<IPrimeCardCheckoutMode> {
  return (await getPrimeCardCheckoutSettings()).mode;
}

export async function shouldUseFaultyPrimeStripeJs(): Promise<boolean> {
  const { mode, useFaultyStripeJs } = await getPrimeCardCheckoutSettings();
  return mode === 'embedded' && useFaultyStripeJs;
}

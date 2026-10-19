// Stripe.js only powers the embedded card checkout; the hosted Purchase Link
// dev override skips it.
export async function shouldLoadStripeForPrimeCheckout() {
  const { getPrimeCardCheckoutMode } =
    await import('../hooks/primeCardCheckoutMode');
  return (await getPrimeCardCheckoutMode()) === 'embedded';
}

export async function loadStripeJsForPrimeCheckout() {
  const { shouldUseFaultyPrimeStripeJs } =
    await import('../hooks/primeCardCheckoutMode');
  if (await shouldUseFaultyPrimeStripeJs()) {
    await import('@onekeyhq/shared/src/modules3rdParty/stripe-v3/faulty-before-13914');
  } else {
    await import('@onekeyhq/shared/src/modules3rdParty/stripe-v3');
  }
}

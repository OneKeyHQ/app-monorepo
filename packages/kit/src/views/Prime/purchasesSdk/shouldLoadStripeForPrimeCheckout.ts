// Stripe.js only powers the embedded card checkout; channels on hosted
// Purchase Links skip it.
export async function shouldLoadStripeForPrimeCheckout() {
  const { getPrimeCardCheckoutMode } =
    await import('../hooks/primeCardCheckoutMode');
  return (await getPrimeCardCheckoutMode()) === 'embedded';
}

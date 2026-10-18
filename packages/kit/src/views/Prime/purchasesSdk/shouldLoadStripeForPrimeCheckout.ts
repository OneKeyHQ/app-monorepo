// Stripe.js only powers the embedded card checkout; the hosted Purchase Link
// dev override skips it.
export async function shouldLoadStripeForPrimeCheckout() {
  const { getPrimeCardCheckoutMode } =
    await import('../hooks/primeCardCheckoutMode');
  return (await getPrimeCardCheckoutMode()) === 'embedded';
}

// web-embed hosts the embedded checkout for Android builds. Keep it free of
// the checkout-mode module, which pulls in the background API.
export async function shouldLoadStripeForPrimeCheckout() {
  return true;
}

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { monitorStripePaymentElementLoading } from './stripePaymentElementHealth';

import type { IPrimeEmbeddedCheckoutSession } from './primeEmbeddedCheckoutSession';

export const PRIME_STRIPE_FORM_LOAD_FAILED_MESSAGE =
  'Stripe payment form failed to load';
export const PRIME_HOSTED_CHECKOUT_REQUESTED_MESSAGE =
  'User requested hosted card checkout before submitting payment';

export async function purchaseWithStripeLoadingGuard<T>(
  purchase: () => Promise<T>,
  session?: IPrimeEmbeddedCheckoutSession,
): Promise<T> {
  const rootsBeforePurchase = new Set(
    typeof document === 'undefined'
      ? []
      : document.querySelectorAll('.rcb-ui-root'),
  );
  let checkoutRoot: Element | undefined;
  let automaticallyClosed = false;
  const stopMonitoring = monitorStripePaymentElementLoading(() => {
    if (session) {
      session.cancel('loadFailure');
      return;
    }
    // purchase() mounts after asynchronous validation/preloading. Locate its
    // root at failure time, excluding any roots from an earlier purchase.
    if (typeof document !== 'undefined') {
      checkoutRoot =
        document.getElementById('rcb-ui-root') ??
        Array.from(document.querySelectorAll('.rcb-ui-root')).find(
          (root) => !rootsBeforePurchase.has(root),
        );
    }
    // purchases-js 0.15.1 has no modal cancellation API: close() only clears
    // its singleton. Use this purchase's own close control so the SDK clears
    // the modal and rejects purchase() through its normal cancellation path.
    const closeButton = checkoutRoot?.querySelector<HTMLButtonElement>(
      'button.close-button',
    );
    if (!checkoutRoot?.isConnected || !closeButton || closeButton.disabled) {
      return;
    }
    automaticallyClosed = true;
    closeButton.click();
  });
  try {
    return await purchase();
  } catch (error) {
    if (
      session?.getCancellation() &&
      !session.hasSubmitted() &&
      (error as { errorCode?: unknown } | undefined)?.errorCode === 1 &&
      session.root.childNodes.length === 0
    ) {
      throw new OneKeyLocalError(
        session.getCancellation() === 'hostedCheckout'
          ? PRIME_HOSTED_CHECKOUT_REQUESTED_MESSAGE
          : PRIME_STRIPE_FORM_LOAD_FAILED_MESSAGE,
      );
    }
    if (
      automaticallyClosed &&
      (error as { errorCode?: unknown } | undefined)?.errorCode === 1 &&
      checkoutRoot?.childNodes.length === 0
    ) {
      throw new OneKeyLocalError(PRIME_STRIPE_FORM_LOAD_FAILED_MESSAGE);
    }
    throw error;
  } finally {
    stopMonitoring();
  }
}

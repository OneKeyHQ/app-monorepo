import { EOneKeyErrorClassNames } from '@onekeyhq/shared/src/errors/types/errorTypes';
import errorUtils from '@onekeyhq/shared/src/errors/utils/errorUtils';

import { PRIME_EMBEDDED_CHECKOUT_UNAVAILABLE_MESSAGE } from './purchasesSdkWebLoader';

import type { IStripePaymentElementState } from './stripePaymentElementHealth';

// 'checkoutError': switch to the hosted Purchase Link right away.
// 'formNotLoaded': the user closed a card form that never rendered; offer it.
// Neither fires once the card form rendered: the user may have submitted a
// payment that is still processing.
export type IPrimeEmbeddedCheckoutFallbackTrigger =
  | 'checkoutError'
  | 'formNotLoaded';

// Literals of @revenuecat/purchases-js ErrorCode, kept local so this module
// never pulls the web SDK into other bundles.
const USER_CANCELLED_ERROR_CODE = 1;
// Failures of the embedded checkout itself. Card declines, ineligibility or
// an existing purchase would fail the same way on the hosted page.
const FALLBACK_ERROR_CODES = new Set([
  0, // UnknownError
  2, // StoreProblemError (purchase setup failed)
  12, // UnexpectedBackendResponseError
  16, // UnknownBackendError
  23, // ConfigurationError
  24, // UnsupportedError
]);

export function getPrimeEmbeddedCheckoutFallbackTrigger({
  error,
  paymentElementState,
}: {
  error: unknown;
  paymentElementState: IStripePaymentElementState;
}): IPrimeEmbeddedCheckoutFallbackTrigger | undefined {
  if (!error) {
    return undefined;
  }
  const { errorCode, message } = error as {
    errorCode?: unknown;
    message?: unknown;
  };
  if (errorCode === USER_CANCELLED_ERROR_CODE) {
    return paymentElementState === 'loading' ||
      paymentElementState === 'loadError'
      ? 'formNotLoaded'
      : undefined;
  }
  // purchases-js reports UnknownError when RevenueCat confirms a submitted
  // card too slowly (~10 s of polling). Opening a second checkout then could
  // charge the user twice, so a rendered form keeps the error in the app.
  if (paymentElementState === 'ready') {
    return undefined;
  }
  if (message === PRIME_EMBEDDED_CHECKOUT_UNAVAILABLE_MESSAGE) {
    return 'checkoutError';
  }
  if (typeof errorCode === 'number') {
    return FALLBACK_ERROR_CODES.has(errorCode) ? 'checkoutError' : undefined;
  }
  // Our own validation errors (not logged in, no offering) would fail the
  // hosted checkout too; anything else is a Stripe.js / runtime failure.
  if (
    errorUtils.isErrorByClassName({
      error,
      className: EOneKeyErrorClassNames.OneKeyLocalError,
    })
  ) {
    return undefined;
  }
  return 'checkoutError';
}

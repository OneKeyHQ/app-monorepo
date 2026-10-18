import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { getPrimeEmbeddedCheckoutFallbackTrigger } from './primeEmbeddedCheckoutFallback';
import { PRIME_EMBEDDED_CHECKOUT_UNAVAILABLE_MESSAGE } from './purchasesSdkWebLoader';

/*
yarn test packages/kit/src/views/Prime/purchasesSdk/primeEmbeddedCheckoutFallback.test.ts
*/

function purchasesError(errorCode: number) {
  return Object.assign(new Error(`PurchasesError ${errorCode}`), {
    errorCode,
  });
}

describe('getPrimeEmbeddedCheckoutFallbackTrigger', () => {
  it('offers the hosted checkout when a blank card form was closed', () => {
    expect(
      getPrimeEmbeddedCheckoutFallbackTrigger({
        error: purchasesError(1),
        paymentElementState: 'loading',
      }),
    ).toBe('formNotLoaded');
    expect(
      getPrimeEmbeddedCheckoutFallbackTrigger({
        error: purchasesError(1),
        paymentElementState: 'loadError',
      }),
    ).toBe('formNotLoaded');
  });

  it('respects a cancel after the form rendered or before it existed', () => {
    expect(
      getPrimeEmbeddedCheckoutFallbackTrigger({
        error: purchasesError(1),
        paymentElementState: 'ready',
      }),
    ).toBeUndefined();
    expect(
      getPrimeEmbeddedCheckoutFallbackTrigger({
        error: purchasesError(1),
        paymentElementState: 'notCreated',
      }),
    ).toBeUndefined();
  });

  it('switches when the embedded checkout is unavailable', () => {
    expect(
      getPrimeEmbeddedCheckoutFallbackTrigger({
        error: new OneKeyLocalError(
          PRIME_EMBEDDED_CHECKOUT_UNAVAILABLE_MESSAGE,
        ),
        paymentElementState: 'notCreated',
      }),
    ).toBe('checkoutError');
  });

  it.each([0, 2, 12, 16, 23, 24])(
    'switches for embedded checkout error code %s',
    (errorCode) => {
      expect(
        getPrimeEmbeddedCheckoutFallbackTrigger({
          error: purchasesError(errorCode),
          paymentElementState: 'ready',
        }),
      ).toBe('checkoutError');
    },
  );

  it.each([4, 6, 10, 18, 20, 38])(
    'keeps payment outcome error code %s in the app',
    (errorCode) => {
      expect(
        getPrimeEmbeddedCheckoutFallbackTrigger({
          error: purchasesError(errorCode),
          paymentElementState: 'ready',
        }),
      ).toBeUndefined();
    },
  );

  it('switches for Stripe.js runtime errors but not app validation errors', () => {
    expect(
      getPrimeEmbeddedCheckoutFallbackTrigger({
        error: new Error('Failed to load Stripe.js'),
        paymentElementState: 'notCreated',
      }),
    ).toBe('checkoutError');
    expect(
      getPrimeEmbeddedCheckoutFallbackTrigger({
        error: new OneKeyLocalError('User not logged in'),
        paymentElementState: 'notCreated',
      }),
    ).toBeUndefined();
    expect(
      getPrimeEmbeddedCheckoutFallbackTrigger({
        error: undefined,
        paymentElementState: 'loading',
      }),
    ).toBeUndefined();
  });
});

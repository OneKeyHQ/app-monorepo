/** @jest-environment jsdom */

import { createPrimeEmbeddedCheckoutSession } from './primeEmbeddedCheckoutSession';
import {
  PRIME_STRIPE_FORM_LOAD_FAILED_MESSAGE,
  purchaseWithStripeLoadingGuard,
} from './purchaseWithStripeLoadingGuard';
import {
  beginStripePaymentElementAttempt,
  instrumentStripePaymentElementHealth,
} from './stripePaymentElementHealth';

const mockResourceListeners = new Set<(requestStartedAt: number) => void>();
jest.mock('./stripeResourceFailure', () => ({
  subscribeToStripeResourceForbidden: (listener: (started: number) => void) => {
    mockResourceListeners.add(listener);
    return () => mockResourceListeners.delete(listener);
  },
}));

type ITestStripe = () => {
  elements: () => {
    create: (type: string) => {
      on: (event: string, listener: () => void) => void;
    };
  };
};
const stripeHost = globalThis as { Stripe?: ITestStripe };
const paymentEvents: Record<string, () => void> = {};

function startCheckout(closeState: 'missing' | 'disabled' | 'ignored') {
  let canCancel = closeState !== 'ignored';
  const root = document.createElement('div');
  root.className = 'rcb-ui-root';
  document.body.append(root);
  const session = createPrimeEmbeddedCheckoutSession(root);
  const form = document.createElement('form');
  form.addEventListener('submit', (event) => event.preventDefault());
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'close-button';
  close.disabled = closeState === 'disabled';
  root.append(form);
  if (closeState !== 'missing') root.append(close);
  let resolvePurchase: ((value: string) => void) | undefined;
  let failure: unknown;
  let result: string | undefined;
  const onClose = jest.fn();
  const complete = purchaseWithStripeLoadingGuard(
    () =>
      new Promise<string>((resolve, reject) => {
        resolvePurchase = resolve;
        stripeHost.Stripe?.().elements().create('payment');
        close.onclick = () => {
          onClose();
          if (!canCancel) return;
          root.replaceChildren();
          reject(Object.assign(new Error('User cancelled'), { errorCode: 1 }));
        };
      }),
    session,
  )
    .then(
      (value) => {
        result = value;
      },
      (error: unknown) => {
        failure = error;
      },
    )
    .finally(() => session.finish());
  return {
    root,
    session,
    form,
    close,
    onClose,
    complete,
    enableCancellation: () => {
      canCancel = true;
    },
    finish: async () => {
      resolvePurchase?.('settled');
      await complete;
    },
    getFailure: () => failure,
    getResult: () => result,
  };
}

beforeEach(() => {
  jest.useFakeTimers();
  mockResourceListeners.clear();
  Object.keys(paymentEvents).forEach((key) => delete paymentEvents[key]);
  stripeHost.Stripe = () => ({
    elements: () => ({
      create: () => ({
        on: (event, listener) => {
          paymentEvents[event] = listener;
        },
      }),
    }),
  });
  instrumentStripePaymentElementHealth();
  beginStripePaymentElementAttempt();
});

afterEach(() => {
  delete stripeHost.Stripe;
  document.body.replaceChildren();
  jest.useRealTimers();
});

it('retries an early loaderror after the SDK creates its close control', async () => {
  const checkout = startCheckout('missing');
  paymentEvents.loaderror();
  await jest.advanceTimersByTimeAsync(1);
  expect(checkout.getFailure()).toBeUndefined();
  expect(checkout.root.childNodes.length).toBe(1);
  checkout.root.append(checkout.close);
  await jest.advanceTimersByTimeAsync(100);
  expect(checkout.onClose).toHaveBeenCalledTimes(1);
  expect(checkout.root.childNodes.length).toBe(0);
  expect(checkout.getFailure()).toMatchObject({
    message: PRIME_STRIPE_FORM_LOAD_FAILED_MESSAGE,
  });
  expect(jest.getTimerCount()).toBe(0);
  await checkout.finish();
});

it('retries an early HTTP 403 after the SDK enables its close control', async () => {
  const checkout = startCheckout('disabled');
  mockResourceListeners.forEach((listener) => listener(Date.now()));
  await jest.advanceTimersByTimeAsync(1);
  expect(checkout.onClose).not.toHaveBeenCalled();
  expect(checkout.getFailure()).toBeUndefined();
  checkout.close.disabled = false;
  await jest.advanceTimersByTimeAsync(100);
  expect(checkout.onClose).toHaveBeenCalledTimes(1);
  expect(checkout.root.childNodes.length).toBe(0);
  expect(checkout.getFailure()).toMatchObject({
    message: PRIME_STRIPE_FORM_LOAD_FAILED_MESSAGE,
  });
  expect(mockResourceListeners.size).toBe(0);
  await checkout.finish();
});

it('does not retry after the payment element becomes ready', async () => {
  const checkout = startCheckout('disabled');
  paymentEvents.loaderror();
  await jest.advanceTimersByTimeAsync(1);
  paymentEvents.ready();
  checkout.close.disabled = false;
  await jest.advanceTimersByTimeAsync(60_000);
  expect(checkout.onClose).not.toHaveBeenCalled();
  expect(checkout.getFailure()).toBeUndefined();
  expect(jest.getTimerCount()).toBe(0);
  await checkout.finish();
});

it('does not expose fallback until the SDK actually acknowledges a retried close', async () => {
  const checkout = startCheckout('ignored');
  paymentEvents.loaderror();
  await jest.advanceTimersByTimeAsync(201);
  expect(checkout.onClose).toHaveBeenCalledTimes(3);
  expect(checkout.getFailure()).toBeUndefined();
  expect(checkout.root.childNodes.length).toBe(2);
  checkout.enableCancellation();
  await jest.advanceTimersByTimeAsync(100);
  expect(checkout.onClose).toHaveBeenCalledTimes(4);
  expect(checkout.root.childNodes.length).toBe(0);
  expect(checkout.getFailure()).toMatchObject({
    message: PRIME_STRIPE_FORM_LOAD_FAILED_MESSAGE,
  });
  await checkout.finish();
});

it('does not retry after another checkout attempt starts', async () => {
  const checkout = startCheckout('missing');
  paymentEvents.loaderror();
  await jest.advanceTimersByTimeAsync(1);
  beginStripePaymentElementAttempt();
  checkout.root.append(checkout.close);
  await jest.advanceTimersByTimeAsync(60_000);
  expect(checkout.onClose).not.toHaveBeenCalled();
  expect(checkout.getFailure()).toBeUndefined();
  expect(jest.getTimerCount()).toBe(0);
  await checkout.finish();
});

it('keeps the submission lock if a failed form submits before cancellation is possible', async () => {
  const checkout = startCheckout('disabled');
  paymentEvents.loaderror();
  await jest.advanceTimersByTimeAsync(1);
  checkout.form.dispatchEvent(
    new Event('submit', { bubbles: true, cancelable: true }),
  );
  checkout.close.disabled = false;
  await jest.advanceTimersByTimeAsync(60_000);
  expect(checkout.session.hasSubmitted()).toBe(true);
  expect(checkout.onClose).not.toHaveBeenCalled();
  expect(checkout.session.cancel('hostedCheckout')).toBe(false);
  expect(checkout.getFailure()).toBeUndefined();
  expect(jest.getTimerCount()).toBe(0);
  await checkout.finish();
  expect(checkout.getResult()).toBe('settled');
});

it('cleans up pending retries when the SDK settles before its close control is enabled', async () => {
  const checkout = startCheckout('disabled');
  paymentEvents.loaderror();
  await jest.advanceTimersByTimeAsync(1);
  await checkout.finish();
  checkout.close.disabled = false;
  await jest.advanceTimersByTimeAsync(60_000);
  expect(checkout.onClose).not.toHaveBeenCalled();
  expect(checkout.getResult()).toBe('settled');
  expect(checkout.getFailure()).toBeUndefined();
  expect(jest.getTimerCount()).toBe(0);
});

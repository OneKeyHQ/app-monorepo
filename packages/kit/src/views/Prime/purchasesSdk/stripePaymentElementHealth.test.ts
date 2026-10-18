import {
  beginStripePaymentElementAttempt,
  getStripePaymentElementState,
  instrumentStripePaymentElementHealth,
} from './stripePaymentElementHealth';

/*
yarn test packages/kit/src/views/Prime/purchasesSdk/stripePaymentElementHealth.test.ts
*/

type IHandlers = Record<string, () => void>;

function installFakeStripe() {
  const elementsHandlers: IHandlers[] = [];
  const fakeStripe = Object.assign(
    jest.fn(() => ({
      elements: () => ({
        create: (_type: string) => {
          const handlers: IHandlers = {};
          elementsHandlers.push(handlers);
          return {
            on: (event: string, handler: () => void) => {
              handlers[event] = handler;
            },
          };
        },
      }),
    })),
    { version: 3 },
  );
  (globalThis as { Stripe?: unknown }).Stripe = fakeStripe;
  return { fakeStripe, elementsHandlers };
}

function createElement(type: string) {
  const stripe = (
    globalThis as unknown as {
      Stripe: (key: string) => {
        elements: () => { create: (type: string) => unknown };
      };
    }
  ).Stripe('pk_test');
  return stripe.elements().create(type);
}

describe('stripePaymentElementHealth', () => {
  afterEach(() => {
    delete (globalThis as { Stripe?: unknown }).Stripe;
  });

  it('tracks the payment element of the current attempt', () => {
    const { fakeStripe, elementsHandlers } = installFakeStripe();
    instrumentStripePaymentElementHealth();
    expect(
      (globalThis as { Stripe?: { version?: number } }).Stripe?.version,
    ).toBe(3);

    beginStripePaymentElementAttempt();
    expect(getStripePaymentElementState()).toBe('notCreated');

    createElement('payment');
    expect(fakeStripe).toHaveBeenCalledWith('pk_test');
    expect(getStripePaymentElementState()).toBe('loading');

    elementsHandlers[0].ready();
    expect(getStripePaymentElementState()).toBe('ready');
    elementsHandlers[0].loaderror();
    expect(getStripePaymentElementState()).toBe('ready');
  });

  it('ignores other element types and events of older attempts', () => {
    const { elementsHandlers } = installFakeStripe();
    instrumentStripePaymentElementHealth();

    beginStripePaymentElementAttempt();
    createElement('linkAuthentication');
    expect(getStripePaymentElementState()).toBe('notCreated');

    createElement('payment');
    elementsHandlers[1].loaderror();
    expect(getStripePaymentElementState()).toBe('loadError');

    beginStripePaymentElementAttempt();
    elementsHandlers[1].ready();
    expect(getStripePaymentElementState()).toBe('notCreated');
  });

  it('wraps the Stripe factory only once', () => {
    installFakeStripe();
    instrumentStripePaymentElementHealth();
    const wrapped = (globalThis as { Stripe?: unknown }).Stripe;
    instrumentStripePaymentElementHealth();
    expect((globalThis as { Stripe?: unknown }).Stripe).toBe(wrapped);
  });
});

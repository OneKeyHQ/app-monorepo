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

    createElement('payment');
    elementsHandlers[1].loaderror();
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

  it('keeps the cached Stripe factory connected to a reloaded health monitor', () => {
    jest.useFakeTimers();
    installFakeStripe();
    instrumentStripePaymentElementHealth();
    try {
      jest.isolateModules(() => {
        const reloaded = jest.requireActual<
          typeof import('./stripePaymentElementHealth')
        >('./stripePaymentElementHealth');
        reloaded.beginStripePaymentElementAttempt();
        const onFailure = jest.fn();
        const stop = reloaded.monitorStripePaymentElementLoading(onFailure);
        try {
          createElement('payment');
          jest.advanceTimersByTime(30_001);
          expect(onFailure).toHaveBeenCalledTimes(1);
        } finally {
          stop();
        }
      });
    } finally {
      jest.useRealTimers();
    }
  });

  it('observes getter-only SDK members and passes the original Elements object back to confirmation', () => {
    const handlers: IHandlers = {};
    const create = (_type: string) => ({
      on: (event: string, handler: () => void) => {
        handlers[event] = handler;
      },
    });
    const elements = Object.defineProperty({ create }, 'create', {
      get: () => create,
    });
    const getElements = () => elements;
    const confirm = jest.fn(function confirm(
      this: { marker: string },
      options: { elements: unknown },
    ) {
      return { marker: this.marker, elements: options.elements };
    });
    const stripe = Object.defineProperty(
      {
        marker: 'original-stripe',
        elements: getElements,
        confirmPayment: confirm,
        confirmSetup: confirm,
      },
      'elements',
      { get: () => getElements },
    );
    const host = globalThis as { Stripe?: () => typeof stripe };
    host.Stripe = () => stripe;
    instrumentStripePaymentElementHealth();
    beginStripePaymentElementAttempt();
    const instrumentedStripe = host.Stripe();
    const instrumentedElements = instrumentedStripe.elements();
    instrumentedElements.create('payment');
    expect(getStripePaymentElementState()).toBe('loading');
    handlers.ready();
    expect(getStripePaymentElementState()).toBe('ready');
    expect(instrumentedStripe.elements()).toBe(instrumentedElements);
    expect(stripe.elements()).toBe(elements);
    expect(elements.create).toBe(create);
    for (const method of ['confirmPayment', 'confirmSetup'] as const) {
      expect(
        instrumentedStripe[method]({ elements: instrumentedElements }),
      ).toEqual({
        marker: 'original-stripe',
        elements,
      });
      expect(confirm).toHaveBeenLastCalledWith({ elements });
    }
  });
});

// purchases-js only listens to the Payment Element `change` event, so a card
// form whose Stripe iframes fail to load (e.g. retired iframe scripts
// answering 403) stays blank without any error. Wrapping the Stripe.js
// factory lets us observe the public `ready` / `loaderror` element events.

// 'notCreated': purchases-js closed before showing the card form.
export type IStripePaymentElementState =
  | 'notCreated'
  | 'loading'
  | 'ready'
  | 'loadError';

type IStripeElementLike = {
  on?: (event: string, handler: () => void) => unknown;
};
type IStripeElementsLike = {
  create?: (type: string, ...args: unknown[]) => IStripeElementLike;
};
type IStripeInstanceLike = {
  elements?: (...args: unknown[]) => IStripeElementsLike;
};
type IStripeFactory = ((...args: unknown[]) => IStripeInstanceLike) & {
  $$onekeyPaymentElementHealth?: true;
};

let attemptId = 0;
let paymentElementState: IStripePaymentElementState = 'notCreated';

// Call right before each embedded purchase; events from older forms are
// ignored afterwards.
export function beginStripePaymentElementAttempt() {
  attemptId += 1;
  paymentElementState = 'notCreated';
}

export function getStripePaymentElementState(): IStripePaymentElementState {
  return paymentElementState;
}

function trackPaymentElement(element: IStripeElementLike | undefined) {
  const elementAttemptId = attemptId;
  paymentElementState = 'loading';
  element?.on?.('ready', () => {
    if (attemptId === elementAttemptId) {
      paymentElementState = 'ready';
    }
  });
  element?.on?.('loaderror', () => {
    if (attemptId === elementAttemptId && paymentElementState !== 'ready') {
      paymentElementState = 'loadError';
    }
  });
}

function instrumentStripeInstance(stripe: IStripeInstanceLike | undefined) {
  const originalElements = stripe?.elements;
  if (!stripe || typeof originalElements !== 'function') {
    return;
  }
  stripe.elements = (...args: unknown[]) => {
    const elements = originalElements.apply(stripe, args);
    const originalCreate = elements?.create;
    if (elements && typeof originalCreate === 'function') {
      elements.create = (type: string, ...createArgs: unknown[]) => {
        const element = originalCreate.apply(elements, [type, ...createArgs]);
        if (type === 'payment') {
          trackPaymentElement(element);
        }
        return element;
      };
    }
    return elements;
  };
}

// Must run after Stripe.js is loaded and before purchases-js is imported:
// purchases-js captures window.Stripe when it is first imported.
export function instrumentStripePaymentElementHealth() {
  const host = globalThis as { Stripe?: IStripeFactory };
  const originalStripe = host.Stripe;
  if (
    typeof originalStripe !== 'function' ||
    originalStripe.$$onekeyPaymentElementHealth
  ) {
    return;
  }
  const instrumentedStripe: IStripeFactory = function instrumentedStripe(
    this: unknown,
    ...args: unknown[]
  ) {
    const stripe = originalStripe.apply(this, args);
    try {
      instrumentStripeInstance(stripe);
    } catch {
      // Observability must never break the checkout.
    }
    return stripe;
  };
  // Keeps static fields such as Stripe.version.
  Object.assign(instrumentedStripe, originalStripe);
  instrumentedStripe.$$onekeyPaymentElementHealth = true;
  host.Stripe = instrumentedStripe;
}

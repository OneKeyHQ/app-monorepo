// purchases-js only listens to the Payment Element `change` event, so a card
// form whose Stripe iframes fail to load (e.g. retired iframe scripts
// answering 403) stays blank without any error. Wrapping the Stripe.js
// factory lets us observe the public `ready` / `loaderror` element events.

import { subscribeToStripeResourceForbidden } from './stripeResourceFailure';

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
type IStripePaymentElementHealth = {
  attemptId: number;
  state: IStripePaymentElementState;
  listeners: Set<() => void>;
};
type IStripeFactory = ((...args: unknown[]) => IStripeInstanceLike) & {
  $$onekeyPaymentElementHealth?: true;
  $$onekeyPaymentElementHealthState?: IStripePaymentElementHealth;
};

const initialHealth: IStripePaymentElementHealth = {
  attemptId: 0,
  state: 'notCreated',
  listeners: new Set(),
};

// The cached Stripe factory outlives module reloads. Keep its observers with
// that factory so new callers and existing instrumented elements share state.
function getHealth() {
  return (
    (globalThis as { Stripe?: IStripeFactory }).Stripe
      ?.$$onekeyPaymentElementHealthState ?? initialHealth
  );
}

function setPaymentElementState(
  health: IStripePaymentElementHealth,
  state: IStripePaymentElementState,
) {
  health.state = state;
  health.listeners.forEach((listener) => listener());
}

// Call right before each embedded purchase; events from older forms are
// ignored afterwards.
export function beginStripePaymentElementAttempt() {
  const health = getHealth();
  health.attemptId += 1;
  setPaymentElementState(health, 'notCreated');
}

export function getStripePaymentElementState(): IStripePaymentElementState {
  return getHealth().state;
}

// A rendered form may already have submitted a payment. Stop permanently on
// ready, and scope the timer to the current attempt rather than the SDK import.
export function monitorStripePaymentElementLoading(onFailure: () => void) {
  const health = getHealth();
  const monitoredAttemptId = health.attemptId;
  const monitoredAt = Date.now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const resourceSubscription: { unsubscribe?: () => void } = {};
  const monitor = {
    stop: () => {
      clearTimeout(timer);
      health.listeners.delete(monitor.onStateChanged);
      resourceSubscription.unsubscribe?.();
    },
    fail: () => {
      const shouldFail =
        health === getHealth() &&
        health.attemptId === monitoredAttemptId &&
        (health.state === 'loading' || health.state === 'loadError');
      monitor.stop();
      if (shouldFail) onFailure();
    },
    onStateChanged: () => {
      if (
        health !== getHealth() ||
        health.attemptId !== monitoredAttemptId ||
        health.state === 'ready'
      ) {
        monitor.stop();
      } else if (health.state === 'loadError') {
        clearTimeout(timer);
        timer = setTimeout(monitor.fail, 0);
      } else if (health.state === 'loading' && timer === undefined) {
        timer = setTimeout(monitor.fail, 30_000);
      }
    },
  };
  health.listeners.add(monitor.onStateChanged);
  resourceSubscription.unsubscribe = subscribeToStripeResourceForbidden(
    (requestStartedAt) => {
      if (
        health === getHealth() &&
        health.attemptId === monitoredAttemptId &&
        health.state !== 'ready' &&
        requestStartedAt >= monitoredAt
      ) {
        setPaymentElementState(health, 'loadError');
      }
    },
  );
  monitor.onStateChanged();
  return monitor.stop;
}

function trackPaymentElement(element: IStripeElementLike | undefined) {
  const health = getHealth();
  const elementAttemptId = health.attemptId;
  if (health.state !== 'ready') {
    setPaymentElementState(health, 'loading');
  }
  element?.on?.('ready', () => {
    if (health === getHealth() && health.attemptId === elementAttemptId) {
      setPaymentElementState(health, 'ready');
    }
  });
  element?.on?.('loaderror', () => {
    if (
      health === getHealth() &&
      health.attemptId === elementAttemptId &&
      health.state !== 'ready'
    ) {
      setPaymentElementState(health, 'loadError');
    }
  });
}

function instrumentStripeInstance(stripe: IStripeInstanceLike) {
  const elementsCache = new WeakMap<IStripeElementsLike, IStripeElementsLike>();
  const originalElementsByProxy = new WeakMap<object, IStripeElementsLike>();
  // Stripe exposes elements/create as non-configurable, getter-only members.
  // Observe through proxies without mutating the SDK's read-only objects.
  return new Proxy(stripe, {
    get(target, key): unknown {
      if (key === 'elements' && typeof target.elements === 'function') {
        const originalElements = target.elements;
        return (...args: unknown[]) => {
          const elements = originalElements.apply(target, args);
          if (!elements || typeof elements.create !== 'function')
            return elements;
          let instrumentedElements = elementsCache.get(elements);
          if (!instrumentedElements) {
            instrumentedElements = new Proxy(elements, {
              get(elementsTarget, elementsKey): unknown {
                if (
                  elementsKey === 'create' &&
                  typeof elementsTarget.create === 'function'
                ) {
                  const originalCreate = elementsTarget.create;
                  return (type: string, ...createArgs: unknown[]) => {
                    const element = originalCreate.apply(elementsTarget, [
                      type,
                      ...createArgs,
                    ]);
                    if (type === 'payment') trackPaymentElement(element);
                    return element;
                  };
                }
                const value: unknown = Reflect.get(
                  elementsTarget,
                  elementsKey,
                  elementsTarget,
                );
                return typeof value === 'function'
                  ? value.bind(elementsTarget)
                  : value;
              },
            });
            elementsCache.set(elements, instrumentedElements);
            originalElementsByProxy.set(instrumentedElements, elements);
          }
          return instrumentedElements;
        };
      }
      const value: unknown = Reflect.get(target, key, target);
      if (
        (key === 'confirmPayment' || key === 'confirmSetup') &&
        typeof value === 'function'
      ) {
        return (options: unknown) => {
          let originalOptions = options;
          if (
            options &&
            typeof options === 'object' &&
            'elements' in options &&
            options.elements &&
            typeof options.elements === 'object'
          ) {
            const originalElements = originalElementsByProxy.get(
              options.elements,
            );
            if (originalElements)
              originalOptions = { ...options, elements: originalElements };
          }
          const result: unknown = Reflect.apply(value, target, [
            originalOptions,
          ]);
          return result;
        };
      }
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
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
      return instrumentStripeInstance(stripe);
    } catch {
      // Observability must never break the checkout.
    }
    return stripe;
  };
  // Keeps static fields such as Stripe.version.
  Object.assign(instrumentedStripe, originalStripe);
  instrumentedStripe.$$onekeyPaymentElementHealth = true;
  instrumentedStripe.$$onekeyPaymentElementHealthState = getHealth();
  host.Stripe = instrumentedStripe;
}

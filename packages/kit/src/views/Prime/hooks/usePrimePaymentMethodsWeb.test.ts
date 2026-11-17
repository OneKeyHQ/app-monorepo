/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';

import { getPrimeEmbeddedCheckoutFallbackTrigger } from '../purchasesSdk/primeEmbeddedCheckoutFallback';
import {
  beginStripePaymentElementAttempt,
  getStripePaymentElementState,
  instrumentStripePaymentElementHealth,
} from '../purchasesSdk/stripePaymentElementHealth';

import { usePrimePaymentMethodsWeb } from './usePrimePaymentMethodsWeb';

type IPurchaseResult = { customerInfo: { entitlements: { active: object } } };
const mockPurchase = jest.fn<Promise<IPurchaseResult>, []>();
const mockClose = jest.fn();
const mockTrackSuccess = jest.fn<void, unknown[]>();
const mockTrackFailed = jest.fn(() => ({ reason: 'unknown' }));
const mockToastIfError = jest.fn<void, unknown[]>();
const mockPaymentHandlers: Record<string, () => void> = {};
const mockStripeResourceListeners = new Set<(details: unknown) => void>();
let mockCancelPurchase: (() => void) | undefined;

jest.mock('../components/PrimeEmbeddedWebCheckout', () => ({
  purchaseWithPrimeEmbeddedWebCheckout: (
    purchase: (target: HTMLElement) => Promise<IPurchaseResult>,
  ) => {
    const { purchaseWithStripeLoadingGuard } = jest.requireActual<
      typeof import('../purchasesSdk/purchaseWithStripeLoadingGuard')
    >('../purchasesSdk/purchaseWithStripeLoadingGuard');
    return purchaseWithStripeLoadingGuard(() =>
      purchase(document.createElement('div')),
    );
  },
}));

jest.mock('../purchasesSdk/stripeResourceFailure', () =>
  jest.requireActual<
    typeof import('../purchasesSdk/stripeResourceFailure.desktop')
  >('../purchasesSdk/stripeResourceFailure.desktop'),
);

jest.mock('@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth', () => ({
  useOneKeyAuth: () => ({ user: { onekeyUserId: 'test-user' }, isReady: true }),
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  usePrimePersistAtom: () => [undefined, jest.fn()],
}));
jest.mock('react-intl', () => ({ useIntl: () => ({ locale: 'en-US' }) }));
jest.mock('./getPrimePaymentApiKey', () => ({
  getPrimePaymentApiKey: async () => ({
    apiKey: 'test-key',
    isSandboxKey: true,
  }),
}));
jest.mock('./primePaymentUtils', () => ({
  __esModule: true,
  default: {
    fetchWebTargetOffering: async () => ({
      targetOffering: {
        availablePackages: [
          { rcBillingProduct: { normalPeriodDuration: 'P1M' } },
        ],
      },
    }),
    trackPrimeSubscriptionSuccess: (...args: unknown[]) =>
      mockTrackSuccess(...args),
    trackPrimeSubscriptionFailed: () => mockTrackFailed(),
    extractWebPaywallPrice: () => ({}),
  },
}));
jest.mock('../purchasesSdk/purchaseSdkUtils', () => ({
  __esModule: true,
  default: { convertToRevenuecatLocale: () => 'en' },
}));
jest.mock('@onekeyhq/shared/src/errors/utils/errorToastUtils', () => ({
  __esModule: true,
  default: { toastIfError: (...args: unknown[]) => mockToastIfError(...args) },
}));
jest.mock('../purchasesSdk/purchasesSdkWebLoader', () => {
  const sdk = {
    Purchases: {
      configure: jest.fn(),
      getSharedInstance: () => ({ purchase: () => mockPurchase() }),
    },
  };
  return {
    PRIME_EMBEDDED_CHECKOUT_UNAVAILABLE_MESSAGE:
      'Embedded card checkout is unavailable in this runtime',
    loadPurchasesSdkWeb: async () => sdk,
    loadPurchasesSdkWebForEmbeddedPurchase: async () => sdk,
  };
});

function startPaymentElement() {
  const stripeHost = globalThis as {
    Stripe?: () => { elements: () => { create: (type: string) => unknown } };
  };
  stripeHost.Stripe = () => {
    const create = () => ({
      on: (event: string, handler: () => void) => {
        mockPaymentHandlers[event] = handler;
      },
    });
    const elements = Object.defineProperty({ create }, 'create', {
      get: () => create,
    });
    const getElements = () => elements;
    return Object.defineProperty({ elements: getElements }, 'elements', {
      get: () => getElements,
    });
  };
  instrumentStripePaymentElementHealth();
  stripeHost.Stripe().elements().create('payment');
}

describe('embedded Prime checkout loading failure', () => {
  const startPurchase = async () => {
    const { result } = renderHook(() => usePrimePaymentMethodsWeb());
    let failure: unknown;
    await act(async () => {
      void result.current
        .purchasePackageWeb?.({
          subscriptionPeriod: 'P1M',
          email: 'test@example.com',
        })
        .catch((error: unknown) => {
          failure = error;
        });
    });
    return { getFailure: () => failure };
  };

  const getFallback = (error: unknown) =>
    getPrimeEmbeddedCheckoutFallbackTrigger({
      error,
      paymentElementState: getStripePaymentElementState(),
    });

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    Object.defineProperty(globalThis, 'desktopApi', {
      configurable: true,
      value: {
        on: (channel: string, listener: (details: unknown) => void) => {
          if (channel === 'prime/stripeResourceForbidden') {
            mockStripeResourceListeners.add(listener);
          }
          return () => mockStripeResourceListeners.delete(listener);
        },
      },
    });
    beginStripePaymentElementAttempt();
    Object.keys(mockPaymentHandlers).forEach(
      (key) => delete mockPaymentHandlers[key],
    );
    mockPurchase.mockImplementation(async () => {
      // The SDK validates/preloads asynchronously before mounting its modal.
      await Promise.resolve();
      startPaymentElement();
      return new Promise((_, reject) => {
        const root = document.createElement('div');
        root.className = 'rcb-ui-root';
        const close = document.createElement('button');
        close.className = 'close-button';
        mockCancelPurchase = () => {
          mockClose();
          root.innerHTML = '';
          reject(Object.assign(new Error('User cancelled'), { errorCode: 1 }));
        };
        close.onclick = mockCancelPurchase;
        root.appendChild(close);
        document.body.appendChild(root);
      });
    });
  });

  afterEach(() => {
    mockCancelPurchase?.();
    mockCancelPurchase = undefined;
    delete (globalThis as { Stripe?: unknown }).Stripe;
    document.body.innerHTML = '';
    Reflect.deleteProperty(globalThis, 'desktopApi');
    mockStripeResourceListeners.clear();
    jest.useRealTimers();
  });

  it('closes a perpetually loading form and enables automatic hosted fallback without a user cancel', async () => {
    const staleRoot = document.createElement('div');
    staleRoot.className = 'rcb-ui-root';
    const staleClose = document.createElement('button');
    staleClose.className = 'close-button';
    const onStaleClose = jest.fn();
    staleClose.onclick = onStaleClose;
    staleRoot.appendChild(staleClose);
    document.body.appendChild(staleRoot);
    const { getFailure } = await startPurchase();
    expect(mockPurchase).toHaveBeenCalledTimes(1);
    expect(getStripePaymentElementState()).toBe('loading');

    await act(async () => {
      await jest.advanceTimersByTimeAsync(30_001);
    });

    expect(mockClose).toHaveBeenCalledTimes(1);
    expect(onStaleClose).not.toHaveBeenCalled();
    expect(getFallback(getFailure())).toBe('checkoutError');
    expect(mockTrackSuccess).not.toHaveBeenCalled();
    expect(mockToastIfError).not.toHaveBeenCalled();
  });

  it('automatically cancels an explicit Stripe loaderror without waiting for the timeout', async () => {
    const { getFailure } = await startPurchase();
    await act(async () => {
      mockPaymentHandlers.loaderror();
      await jest.advanceTimersByTimeAsync(1);
    });
    expect(mockClose).toHaveBeenCalledTimes(1);
    expect(getFallback(getFailure())).toBe('checkoutError');
  });

  it('immediately cancels a pending SDK purchase when its Stripe resource returns HTTP 403', async () => {
    const { getFailure } = await startPurchase();
    await act(async () => {
      mockStripeResourceListeners.forEach((listener) =>
        listener({ requestStartedAt: Date.now(), statusCode: 403 }),
      );
      await jest.advanceTimersByTimeAsync(1);
    });
    expect(mockClose).toHaveBeenCalledTimes(1);
    expect(getFallback(getFailure())).toBe('checkoutError');
    expect(mockStripeResourceListeners.size).toBe(0);
  });

  it('ignores malformed signals and 403 responses from requests started before this checkout', async () => {
    const { getFailure } = await startPurchase();
    await act(async () => {
      for (const details of [
        null,
        { requestStartedAt: Date.now(), statusCode: 500 },
        { requestStartedAt: 'invalid', statusCode: 403 },
        { requestStartedAt: Date.now() - 1, statusCode: 403 },
      ]) {
        mockStripeResourceListeners.forEach((listener) => listener(details));
      }
      await jest.advanceTimersByTimeAsync(1);
    });
    expect(mockClose).not.toHaveBeenCalled();
    expect(getFailure()).toBeUndefined();
  });

  it('never falls back on a late HTTP 403 after the form is ready', async () => {
    const { getFailure } = await startPurchase();
    const delayedListeners = [...mockStripeResourceListeners];
    await act(async () => {
      mockPaymentHandlers.ready();
      delayedListeners.forEach((listener) =>
        listener({ requestStartedAt: Date.now(), statusCode: 403 }),
      );
      await jest.advanceTimersByTimeAsync(60_000);
    });
    expect(mockClose).not.toHaveBeenCalled();
    expect(getFailure()).toBeUndefined();
    expect(mockStripeResourceListeners.size).toBe(0);
  });

  it('never times out after ready, even when Stripe emits a late loaderror', async () => {
    const { getFailure } = await startPurchase();
    await act(async () => {
      await jest.advanceTimersByTimeAsync(29_999);
      mockPaymentHandlers.ready();
      mockPaymentHandlers.loaderror();
      await jest.advanceTimersByTimeAsync(60_000);
    });
    expect(mockClose).not.toHaveBeenCalled();
    expect(getFallback(getFailure())).toBeUndefined();
  });

  it('cleans up after a manual close and preserves the existing fallback confirmation', async () => {
    const { getFailure } = await startPurchase();
    await act(async () => {
      mockCancelPurchase?.();
    });
    expect(getFallback(getFailure())).toBe('formNotLoaded');
    await act(async () => {
      await jest.advanceTimersByTimeAsync(60_000);
    });
    expect(mockClose).toHaveBeenCalledTimes(1);
  });

  it('does not cancel an older purchase when a new attempt has started', async () => {
    await startPurchase();
    await act(async () => {
      beginStripePaymentElementAttempt();
      mockPaymentHandlers.loaderror();
      await jest.advanceTimersByTimeAsync(60_000);
    });
    expect(mockClose).not.toHaveBeenCalled();
  });

  it('cleans up when the SDK settles and preserves a successful purchase', async () => {
    mockPurchase.mockImplementationOnce(async () => {
      startPaymentElement();
      return { customerInfo: { entitlements: { active: {} } } };
    });
    const { getFailure } = await startPurchase();
    await act(async () => {
      await jest.advanceTimersByTimeAsync(60_000);
    });
    expect(getFailure()).toBeUndefined();
    expect(mockTrackSuccess).toHaveBeenCalledTimes(1);
    expect(mockClose).not.toHaveBeenCalled();
  });

  it('does not enable automatic fallback unless the SDK acknowledges cancellation', async () => {
    const { getFailure } = await startPurchase();
    const close = document.querySelector<HTMLButtonElement>(
      'button.close-button',
    );
    expect(close).not.toBeNull();
    if (close) close.onclick = jest.fn();
    await act(async () => {
      await jest.advanceTimersByTimeAsync(30_001);
    });
    expect(getFallback(getFailure())).toBeUndefined();
    expect(document.querySelector('.rcb-ui-root')?.childElementCount).toBe(1);
  });
});

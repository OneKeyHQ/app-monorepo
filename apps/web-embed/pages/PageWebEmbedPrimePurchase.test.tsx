/** @jest-environment jsdom */

import { StrictMode } from 'react';

import { act, cleanup, render, waitFor } from '@testing-library/react';

import type { IUsePrimePayment } from '@onekeyhq/kit/src/views/Prime/hooks/usePrimePaymentTypes';
import { purchaseWithStripeLoadingGuard } from '@onekeyhq/kit/src/views/Prime/purchasesSdk/purchaseWithStripeLoadingGuard';
import {
  EWebEmbedPrivateRequestMethod,
  PRIME_CHECKOUT_CANCEL_MESSAGE,
} from '@onekeyhq/shared/src/consts/webEmbedConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import PageWebEmbedPrimePurchase from './PageWebEmbedPrimePurchase';

import type { PurchaseResult } from '@revenuecat/purchases-js';

const mockRequest = jest.fn(
  async (_request: { method: string; params?: unknown }) => undefined,
);
const mockPurchase = jest.fn<
  Promise<PurchaseResult>,
  [Parameters<NonNullable<IUsePrimePayment['purchasePackageWeb']>>[0]]
>();
const mockFetchOffering = jest.fn<Promise<unknown>, []>();
let mockPaymentState = 'ready';
const mockQuery = {
  apiKey: 'key',
  primeUserId: 'user',
  primeUserEmail: 'user@example.com',
  subscriptionPeriod: 'P1M',
  primeCheckoutId: 'modal',
  currency: 'EUR',
};
jest.mock('@onekeyhq/kit/src/views/Prime/hooks/usePrimePaymentMethods', () => ({
  usePrimePaymentMethods: () => ({
    webEmbedQueryParams: mockQuery,
    purchasePackageWeb: mockPurchase,
  }),
}));
jest.mock('@onekeyhq/kit/src/views/Prime/hooks/primePaymentUtils', () => ({
  __esModule: true,
  default: {
    fetchWebTargetOffering: () => mockFetchOffering(),
  },
}));
jest.mock(
  '@onekeyhq/kit/src/views/Prime/purchasesSdk/purchasesSdkWebLoader',
  () => ({
    PRIME_EMBEDDED_CHECKOUT_UNAVAILABLE_MESSAGE: 'Embedded unavailable',
    loadPurchasesSdkWeb: async () => ({
      Purchases: { getSharedInstance: () => ({}) },
    }),
  }),
);
jest.mock(
  '@onekeyhq/kit/src/views/Prime/purchasesSdk/stripePaymentElementHealth',
  () => ({
    beginStripePaymentElementAttempt: jest.fn(),
    getStripePaymentElementState: () => mockPaymentState,
    monitorStripePaymentElementLoading: () => () => undefined,
  }),
);

let form: HTMLFormElement;
let close: HTMLButtonElement;
let rejectPurchase: (error: Error) => void;
let resolvePurchase: (result: PurchaseResult) => void;
const send = () =>
  globalThis.dispatchEvent(
    new MessageEvent('message', {
      source: globalThis.window,
      data: {
        type: PRIME_CHECKOUT_CANCEL_MESSAGE,
        checkoutId: 'modal',
        attemptId: currentAttempt(),
        requestId: 'request',
      },
    }),
  );
function currentAttempt() {
  return (
    mockRequest.mock.calls.find(
      ([data]) =>
        data.method ===
        EWebEmbedPrivateRequestMethod.primeEmbeddedCheckoutState,
    )?.[0].params as { attemptId: string } | undefined
  )?.attemptId;
}
const fallbackCalls = () =>
  mockRequest.mock.calls.filter(
    ([data]) =>
      data.method ===
      EWebEmbedPrivateRequestMethod.fallbackToPrimeHostedCheckout,
  );

beforeEach(() => {
  mockRequest.mockClear();
  mockPurchase.mockReset();
  mockFetchOffering
    .mockReset()
    .mockRejectedValue(new OneKeyLocalError('Host resolves the package'));
  mockPaymentState = 'ready';
  globalThis.addEventListener =
    EventTarget.prototype.addEventListener.bind(globalThis);
  globalThis.$onekey = {
    $private: { request: mockRequest },
  } as unknown as typeof globalThis.$onekey;
  mockPurchase.mockImplementation(({ embeddedCheckoutSession: session }) => {
    if (!session) throw new OneKeyLocalError('Missing session');
    return purchaseWithStripeLoadingGuard(
      () =>
        new Promise<PurchaseResult>((resolve, reject) => {
          form = document.createElement('form');
          close = document.createElement('button');
          close.type = 'button';
          close.className = 'close-button';
          session.root.append(form, close);
          rejectPurchase = reject;
          resolvePurchase = resolve;
          close.onclick = () => {
            session.root.replaceChildren();
            reject(Object.assign(new Error('Cancelled'), { errorCode: 1 }));
          };
        }),
      session,
    );
  });
});
afterEach(cleanup);

it('requests the existing hosted handoff only after the guarded SDK cancellation, with the route identity and plan', async () => {
  render(<PageWebEmbedPrimePurchase />);
  await act(async () => {
    send();
  });
  await waitFor(() => expect(fallbackCalls()).toHaveLength(1));
  expect(fallbackCalls()[0][0].params).toMatchObject({
    trigger: 'userRequestedHostedCheckout',
    checkoutId: 'modal',
    attemptId: currentAttempt(),
    requestId: 'request',
    onekeyUserId: 'user',
    subscriptionPeriod: 'P1M',
    currency: 'EUR',
  });
  await act(async () => {
    send();
  });
  expect(fallbackCalls()).toHaveLength(1);
});

it('keeps one guarded purchase during the web-embed StrictMode effect replay', async () => {
  render(
    <StrictMode>
      <PageWebEmbedPrimePurchase />
    </StrictMode>,
  );
  await act(async () => {
    send();
  });
  await waitFor(() => expect(fallbackCalls()).toHaveLength(1));
  expect(mockPurchase).toHaveBeenCalledTimes(1);
});

it('leaves the embedded form when SDK cancellation is ignored', async () => {
  render(<PageWebEmbedPrimePurchase />);
  close.onclick = jest.fn();
  await act(async () => {
    send();
  });
  expect(form.isConnected).toBe(true);
  expect(fallbackCalls()).toHaveLength(0);
});

it('blocks automatic fallback after submission even when Stripe health is unknown and RevenueCat later errors', async () => {
  render(<PageWebEmbedPrimePurchase />);
  mockPaymentState = 'notCreated';
  await act(async () => {
    form.dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );
    send();
    rejectPurchase(
      Object.assign(new Error('Unknown payment result'), { errorCode: 0 }),
    );
  });
  expect(fallbackCalls()).toHaveLength(0);
});

it('does not hand off when a cleared SDK target rejects with an error other than cancellation', async () => {
  render(<PageWebEmbedPrimePurchase />);
  mockPaymentState = 'notCreated';
  close.onclick = () => {
    form.parentElement?.replaceChildren();
    rejectPurchase(
      Object.assign(new Error('Unknown outcome'), { errorCode: 0 }),
    );
  };
  await act(async () => {
    send();
  });
  expect(fallbackCalls()).toHaveLength(0);
});

it('disposes on unmount and ignores a late result from the old checkout', async () => {
  const view = render(<PageWebEmbedPrimePurchase />);
  view.unmount();
  const previousCount = mockRequest.mock.calls.length;
  await act(async () => {
    send();
    rejectPurchase(
      Object.assign(new Error('Late cancellation'), { errorCode: 1 }),
    );
  });
  expect(mockRequest).toHaveBeenCalledTimes(previousCount);
  expect(fallbackCalls()).toHaveLength(0);
});

it.each(['pagehide', 'hashchange', 'popstate'])(
  'invalidates the old form on %s before any late cancellation',
  async (eventName) => {
    render(<PageWebEmbedPrimePurchase />);
    await act(async () => {
      globalThis.dispatchEvent(new Event(eventName));
      send();
      rejectPurchase(
        Object.assign(new Error('Old page cancelled'), { errorCode: 1 }),
      );
    });
    expect(fallbackCalls()).toHaveLength(0);
  },
);

it('revokes a confirmed handoff if navigation happens during hosted package resolution', async () => {
  let release: ((value: unknown) => void) | undefined;
  mockFetchOffering.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  render(<PageWebEmbedPrimePurchase />);
  await act(async () => {
    send();
  });
  await waitFor(() => expect(mockFetchOffering).toHaveBeenCalledTimes(1));
  await act(async () => {
    globalThis.dispatchEvent(new Event('hashchange'));
    release?.(undefined);
  });
  expect(fallbackCalls()).toHaveLength(0);
});

it('disables switching when the SDK completes before an external confirmation arrives', async () => {
  render(<PageWebEmbedPrimePurchase />);
  await act(async () => {
    resolvePurchase({
      customerInfo: { entitlements: { active: { Prime: { isActive: true } } } },
    } as unknown as PurchaseResult);
  });
  await act(async () => {
    send();
  });
  expect(fallbackCalls()).toHaveLength(0);
  expect(mockRequest).toHaveBeenCalledWith({
    method:
      EWebEmbedPrivateRequestMethod.closeWebViewModalAfterPrimePurchaseSuccess,
    params: { onekeyUserId: 'user' },
  });
});

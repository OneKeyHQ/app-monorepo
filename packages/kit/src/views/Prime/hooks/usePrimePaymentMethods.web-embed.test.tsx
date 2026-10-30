/** @jest-environment jsdom */

import { act, cleanup, renderHook, waitFor } from '@testing-library/react';

import { createPrimeEmbeddedCheckoutSession } from '../purchasesSdk/primeEmbeddedCheckoutSession';
import { PRIME_HOSTED_CHECKOUT_REQUESTED_MESSAGE } from '../purchasesSdk/purchaseWithStripeLoadingGuard';

import { usePrimePaymentMethods } from './usePrimePaymentMethods.web-embed';

import type { PurchaseParams, PurchaseResult } from '@revenuecat/purchases-js';

const mockPurchase = jest.fn<Promise<PurchaseResult>, [PurchaseParams]>();
const mockConfigure = jest.fn<void, unknown[]>();
jest.mock('@onekeyhq/shared/src/modules3rdParty/stripe-v3', () => ({}));
jest.mock('../purchasesSdk/purchasesSdkWebLoader', () => {
  const sdk = {
    Purchases: {
      configure: (...args: unknown[]) => mockConfigure(...args),
      getSharedInstance: () => ({
        purchase: (params: PurchaseParams) => mockPurchase(params),
      }),
    },
  };
  return {
    loadPurchasesSdkWeb: async () => sdk,
    loadPurchasesSdkWebForEmbeddedPurchase: async () => sdk,
  };
});
jest.mock('../purchasesSdk/stripePaymentElementHealth', () => ({
  monitorStripePaymentElementLoading: () => () => undefined,
}));
jest.mock('../purchasesSdk/purchaseSdkUtils', () => ({
  __esModule: true,
  default: { convertToRevenuecatLocale: () => 'en' },
}));
jest.mock('./primePaymentUtils', () => ({
  __esModule: true,
  default: {
    fetchWebTargetOffering: async () => ({
      targetOffering: {
        availablePackages: [
          {
            identifier: 'monthly',
            rcBillingProduct: { normalPeriodDuration: 'P1M' },
          },
        ],
      },
    }),
    trackPrimeSubscriptionFailed: jest.fn(),
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  globalThis.history.replaceState(
    {},
    '',
    '#/prime/purchase?apiKey=test-key&primeUserId=user&primeCheckoutId=modal',
  );
});
afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

it('retains the SDK modal presentation and guards cancellation in the page-owned default target', async () => {
  const root = document.createElement('div');
  root.id = 'rcb-ui-root';
  document.body.append(root);
  const session = createPrimeEmbeddedCheckoutSession(root);
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'close-button';
  mockPurchase.mockImplementation(
    (params) =>
      new Promise((_resolve, reject) => {
        // This is the target-selection contract of locked purchases-js 0.15.1.
        const sdkTarget =
          params.htmlTarget ?? document.getElementById('rcb-ui-root');
        expect(sdkTarget).toBe(root);
        sdkTarget?.append(close);
        close.onclick = () => {
          sdkTarget?.replaceChildren();
          reject(Object.assign(new Error('Cancelled'), { errorCode: 1 }));
        };
      }),
  );
  const { result } = renderHook(usePrimePaymentMethods);
  const completion = result.current
    .purchasePackageWeb?.({
      subscriptionPeriod: 'P1M',
      email: 'user@example.com',
      embeddedCheckoutSession: session,
    })
    .catch((error: unknown) => error);
  await waitFor(() => expect(mockPurchase).toHaveBeenCalledTimes(1));
  expect(mockConfigure).toHaveBeenCalledWith('test-key', 'user');
  expect(mockPurchase.mock.calls[0][0].htmlTarget).toBeUndefined();
  expect(result.current.webEmbedQueryParams?.primeCheckoutId).toBe('modal');
  await act(async () => {
    session.cancel('hostedCheckout');
  });
  expect(await completion).toMatchObject({
    message: PRIME_HOSTED_CHECKOUT_REQUESTED_MESSAGE,
  });
  session.finish();
});

it.each(['replaced', 'unmounted', 'shadowed'])(
  'does not start an SDK purchase when its target was %s',
  async (reason) => {
    const root = document.createElement('div');
    root.id = reason === 'replaced' ? 'other-root' : 'rcb-ui-root';
    if (reason === 'shadowed') {
      const other = document.createElement('div');
      other.id = 'rcb-ui-root';
      document.body.append(other, root);
    } else if (reason === 'replaced') document.body.append(root);
    const session = createPrimeEmbeddedCheckoutSession(root);
    const { result } = renderHook(usePrimePaymentMethods);
    await expect(
      result.current.purchasePackageWeb?.({
        subscriptionPeriod: 'P1M',
        email: 'user@example.com',
        embeddedCheckoutSession: session,
      }),
    ).rejects.toThrow('Prime embedded checkout target changed');
    expect(mockPurchase).not.toHaveBeenCalled();
    session.finish();
  },
);

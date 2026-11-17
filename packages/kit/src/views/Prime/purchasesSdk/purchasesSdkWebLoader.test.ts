import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import type { IPrimeCardCheckoutMode } from '../hooks/primeCardCheckoutMode';

const mockGetMode = jest.fn<Promise<IPrimeCardCheckoutMode>, []>();
const mockUseFaultyStripe = jest.fn<Promise<boolean>, []>();
const mockLoadCurrentStripe = jest.fn<void, []>();
const mockLoadFaultyStripe = jest.fn<void, []>();
const mockStripeHost = globalThis as { Stripe?: unknown };
const mockLoadOrder: string[] = [];

jest.mock('../hooks/primeCardCheckoutMode', () => ({
  getPrimeCardCheckoutMode: () => mockGetMode(),
  shouldUseFaultyPrimeStripeJs: () => mockUseFaultyStripe(),
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: false },
}));
jest.mock('@onekeyhq/shared/src/modules3rdParty/stripe-v3', () => {
  mockLoadCurrentStripe();
  return {};
});
jest.mock(
  '@onekeyhq/shared/src/modules3rdParty/stripe-v3/faulty-before-13914',
  () => {
    mockLoadFaultyStripe();
    return {};
  },
);
jest.mock('./stripePaymentElementHealth', () => ({
  instrumentStripePaymentElementHealth: jest.fn(),
}));
jest.mock('@revenuecat/purchases-js', () => {
  mockLoadOrder.push('revenuecat');
  return {
    Purchases: { setLogLevel: jest.fn() },
    LogLevel: { Verbose: 'verbose' },
  };
});

describe('Prime Stripe.js version loading', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    delete mockStripeHost.Stripe;
    mockLoadOrder.length = 0;
    mockGetMode.mockResolvedValue('embedded');
    mockUseFaultyStripe.mockResolvedValue(false);
    mockLoadCurrentStripe.mockImplementation(() => {
      mockLoadOrder.push('current');
      mockStripeHost.Stripe = jest.fn();
    });
    mockLoadFaultyStripe.mockImplementation(() => {
      mockLoadOrder.push('faulty');
      mockStripeHost.Stripe = jest.fn();
    });
  });

  afterEach(() => {
    delete mockStripeHost.Stripe;
  });

  it('loads only the current Stripe.js before RevenueCat by default', async () => {
    const loader = await import('./purchasesSdkWebLoader');
    await loader.loadPurchasesSdkWebForEmbeddedPurchase();
    expect(mockLoadOrder).toEqual(['current', 'revenuecat']);
    expect(mockLoadFaultyStripe).not.toHaveBeenCalled();
  });

  it('loads only the historical Stripe.js and still starts embedded checkout', async () => {
    mockUseFaultyStripe.mockResolvedValue(true);
    const loader = await import('./purchasesSdkWebLoader');
    await loader.loadPurchasesSdkWebForEmbeddedPurchase();
    await loader.loadPurchasesSdkWebForEmbeddedPurchase();
    expect(mockLoadOrder).toEqual(['faulty', 'revenuecat']);
    expect(mockLoadCurrentStripe).not.toHaveBeenCalled();
    expect(mockLoadFaultyStripe).toHaveBeenCalledTimes(1);
  });

  it('skips both Stripe versions when forced hosted checkout is enabled', async () => {
    mockGetMode.mockResolvedValue('hostedLink');
    mockUseFaultyStripe.mockResolvedValue(true);
    const loader = await import('./purchasesSdkWebLoader');
    await loader.loadPurchasesSdkWeb();
    expect(mockLoadOrder).toEqual(['revenuecat']);
    expect(mockLoadCurrentStripe).not.toHaveBeenCalled();
    expect(mockLoadFaultyStripe).not.toHaveBeenCalled();
    expect(mockUseFaultyStripe).not.toHaveBeenCalled();
  });

  it('keeps RevenueCat usable when Stripe.js fails and reports the normal fallback error', async () => {
    mockUseFaultyStripe.mockResolvedValue(true);
    mockLoadFaultyStripe.mockImplementation(() => {
      throw new OneKeyLocalError('Stripe.js failed to load');
    });
    const loader = await import('./purchasesSdkWebLoader');
    await expect(loader.loadPurchasesSdkWeb()).resolves.toBeDefined();
    await expect(
      loader.loadPurchasesSdkWebForEmbeddedPurchase(),
    ).rejects.toThrow(loader.PRIME_EMBEDDED_CHECKOUT_UNAVAILABLE_MESSAGE);
    expect(mockLoadCurrentStripe).not.toHaveBeenCalled();
  });
});

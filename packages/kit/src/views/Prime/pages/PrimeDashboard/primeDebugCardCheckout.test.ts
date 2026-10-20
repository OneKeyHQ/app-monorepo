import { startPrimeDebugCardCheckout } from './primeDebugCardCheckout';

import type { IUsePrimePayment } from '../../hooks/usePrimePaymentTypes';
import type { IPrimeEmbeddedCheckoutFallbackTrigger } from '../../purchasesSdk/primeEmbeddedCheckoutFallback';

const mockPlatformEnv = { isDev: true, isNative: false, isMas: false };
const mockFetchUserInfo = jest.fn(async () => ({
  userInfo: {
    isLoggedIn: true,
    isLoggedInOnServer: true,
    onekeyUserId: 'test-user',
  },
  primeSubscription: { isActive: true },
}));
const mockAssertCurrent = jest.fn<Promise<void>, [string]>(
  async () => undefined,
);
const mockCardMode = jest.fn<Promise<'embedded' | 'hostedLink'>, []>(
  async () => 'embedded',
);
const mockOpenExternal = jest.fn<void, [string]>();
const mockRefresh = jest.fn(async () => undefined);
const mockResolvePackage = jest.fn(async () => ({
  packageId: '$rc_annual',
  currency: 'USD',
}));
const mockFallbackTrigger = jest.fn<
  IPrimeEmbeddedCheckoutFallbackTrigger | undefined,
  [unknown]
>(() => undefined);
const mockClassifyError = jest.fn<
  { reason: 'paymentFailed' | 'userCancelled' },
  [unknown]
>(() => ({ reason: 'paymentFailed' }));
const mockPurchase = jest.fn<
  ReturnType<NonNullable<IUsePrimePayment['purchasePackageWeb']>>,
  Parameters<NonNullable<IUsePrimePayment['purchasePackageWeb']>>
>();

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    get isDev() {
      return mockPlatformEnv.isDev;
    },
    get isNative() {
      return mockPlatformEnv.isNative;
    },
    get isMas() {
      return mockPlatformEnv.isMas;
    },
  },
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    servicePrime: { apiFetchPrimeUserInfo: () => mockFetchUserInfo() },
  },
}));
jest.mock('@onekeyhq/shared/src/utils/openUrlUtils', () => ({
  __esModule: true,
  default: { openUrlExternal: (url: string) => mockOpenExternal(url) },
}));
jest.mock('../../hooks/getPrimePaymentApiKey', () => ({
  getPrimePaymentApiKey: async () => ({ isSandboxKey: true }),
}));
jest.mock('../../hooks/primeCardCheckoutMode', () => ({
  getPrimeCardCheckoutMode: () => mockCardMode(),
}));
jest.mock('../../hooks/primePaymentUtils', () => ({
  __esModule: true,
  default: {
    classifyPurchaseError: (error: unknown) => mockClassifyError(error),
  },
}));
jest.mock('../../hooks/primeWebCheckout', () => ({
  assertPrimeWebCheckoutUserCurrent: (id: string) => mockAssertCurrent(id),
  getPrimeWebCheckoutPlatform: () => 'extension',
  resolvePrimeWebCheckoutPackage: () => mockResolvePackage(),
}));
jest.mock('../../primeSubscriptionPurchaseSuccess', () => ({
  refreshPrimeUserInfoAfterPurchase: () => mockRefresh(),
}));
jest.mock('../../purchasesSdk/primeEmbeddedCheckoutFallback', () => ({
  getPrimeEmbeddedCheckoutFallbackTrigger: (params: unknown) =>
    mockFallbackTrigger(params),
}));
jest.mock('../../purchasesSdk/stripePaymentElementHealth', () => ({
  beginStripePaymentElementAttempt: jest.fn(),
  getStripePaymentElementState: () => 'ready',
}));

function startCheckout(onekeyUserId: string | undefined = 'test-user') {
  return startPrimeDebugCardCheckout({
    onekeyUserId,
    email: 'test@example.com',
    locale: 'en-US',
    purchasePackageWeb: mockPurchase,
  });
}

describe('Prime debug card checkout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPlatformEnv.isDev = true;
    mockPlatformEnv.isNative = false;
    mockPlatformEnv.isMas = false;
    mockFetchUserInfo.mockResolvedValue({
      userInfo: {
        isLoggedIn: true,
        isLoggedInOnServer: true,
        onekeyUserId: 'test-user',
      },
      primeSubscription: { isActive: true },
    });
    mockAssertCurrent.mockResolvedValue(undefined);
    mockCardMode.mockResolvedValue('embedded');
    mockFallbackTrigger.mockReturnValue(undefined);
    mockClassifyError.mockReturnValue({ reason: 'paymentFailed' });
    mockPurchase.mockResolvedValue({
      customerInfo: {
        entitlements: { active: {}, all: {} },
        allExpirationDatesByProduct: {},
        allPurchaseDatesByProduct: {},
        activeSubscriptions: new Set<string>(),
        managementURL: null,
        requestDate: new Date(),
        firstSeenDate: new Date(),
        originalPurchaseDate: null,
        originalAppUserId: 'test-user',
      },
      redemptionInfo: null,
    });
  });

  it('opens the annual card form for an already-active Prime account', async () => {
    await startCheckout();

    expect(mockFetchUserInfo).toHaveBeenCalledTimes(1);
    expect(mockPurchase).toHaveBeenCalledWith({
      subscriptionPeriod: 'P1Y',
      email: 'test@example.com',
      locale: 'en-US',
    });
    expect(mockAssertCurrent).toHaveBeenCalledTimes(2);
    expect(mockRefresh).toHaveBeenCalledTimes(1);
    expect(mockOpenExternal).not.toHaveBeenCalled();
  });

  it.each(['isDev', 'isNative', 'isMas'] as const)(
    'rejects unsupported builds using %s',
    async (flag) => {
      mockPlatformEnv[flag] = flag !== 'isDev';
      await expect(startCheckout()).rejects.toThrow('development build');
      expect(mockFetchUserInfo).not.toHaveBeenCalled();
      expect(mockPurchase).not.toHaveBeenCalled();
    },
  );

  it('requires a signed-in OneKey ID', async () => {
    await expect(startCheckout('')).rejects.toThrow('Sign in to OneKey ID');
    expect(mockFetchUserInfo).not.toHaveBeenCalled();
    expect(mockPurchase).not.toHaveBeenCalled();
  });

  it.each([
    { isLoggedIn: false },
    { isLoggedInOnServer: false },
    { onekeyUserId: 'other-user' },
  ])('rejects an invalid server session: %j', async (change) => {
    mockFetchUserInfo.mockResolvedValue({
      userInfo: {
        isLoggedIn: true,
        isLoggedInOnServer: true,
        onekeyUserId: 'test-user',
        ...change,
      },
      primeSubscription: { isActive: true },
    });

    await expect(startCheckout()).rejects.toThrow('user changed');
    expect(mockPurchase).not.toHaveBeenCalled();
    expect(mockOpenExternal).not.toHaveBeenCalled();
  });

  it('fails closed when refreshing the server session fails', async () => {
    mockFetchUserInfo.mockRejectedValueOnce(new Error('Network unavailable'));
    await expect(startCheckout()).rejects.toThrow('Network unavailable');
    expect(mockPurchase).not.toHaveBeenCalled();
  });

  it('rejects an account switch after the server check', async () => {
    mockAssertCurrent.mockRejectedValueOnce(new Error('user changed'));
    await expect(startCheckout()).rejects.toThrow('user changed');
    expect(mockPurchase).not.toHaveBeenCalled();
  });

  it('honors the hosted override without reporting existing Prime as a new purchase', async () => {
    mockCardMode.mockResolvedValueOnce('hostedLink');
    await startCheckout();

    expect(mockPurchase).not.toHaveBeenCalled();
    expect(mockOpenExternal).toHaveBeenCalledTimes(1);
    const url = new URL(mockOpenExternal.mock.calls[0][0]);
    expect(url.pathname).toContain('test-user');
    expect(url.searchParams.get('package_id')).toBe('$rc_annual');
    expect(url.searchParams.get('email')).toBe('test@example.com');
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it('switches to the hosted card page after acknowledged browser switching', async () => {
    mockPurchase.mockRejectedValueOnce(new Error('Switch to browser'));
    mockClassifyError.mockReturnValue({ reason: 'userCancelled' });
    mockFallbackTrigger.mockReturnValue('userRequestedHostedCheckout');

    await startCheckout();

    expect(mockOpenExternal).toHaveBeenCalledTimes(1);
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it('allows a loading failure to open hosted card checkout', async () => {
    mockPurchase.mockRejectedValueOnce(new Error('Card form failed to load'));
    mockFallbackTrigger.mockReturnValue('checkoutError');

    await startCheckout();

    expect(mockOpenExternal).toHaveBeenCalledTimes(1);
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it('keeps user cancellation from opening another checkout', async () => {
    mockPurchase.mockRejectedValueOnce(new Error('User cancelled'));
    mockClassifyError.mockReturnValue({ reason: 'userCancelled' });
    mockFallbackTrigger.mockReturnValue('formNotLoaded');

    await startCheckout();

    expect(mockOpenExternal).not.toHaveBeenCalled();
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it('does not open a second checkout for a non-fallback payment error', async () => {
    mockPurchase.mockRejectedValueOnce(new Error('Card declined'));

    await expect(startCheckout()).rejects.toThrow('Card declined');
    expect(mockOpenExternal).not.toHaveBeenCalled();
  });

  it('checks the account again after resolving the hosted package', async () => {
    mockCardMode.mockResolvedValueOnce('hostedLink');
    mockAssertCurrent
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('user changed'));

    await expect(startCheckout()).rejects.toThrow('user changed');
    expect(mockOpenExternal).not.toHaveBeenCalled();
  });
});

/** @jest-environment jsdom */

import { act, cleanup, renderHook } from '@testing-library/react';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import enMessages from '@onekeyhq/shared/src/locale/json/en_US.json';

import { usePrimeSubscriptionPackages } from './usePrimeSubscriptionPackages';

import type { IPackage } from './usePrimePaymentTypes';

type ISdkResult = {
  packages: IPackage[];
  failure?: unknown;
  simulatedFaultActive?: boolean;
};
type IPackagesLoaderResult = ISdkResult | IPackage[];
const mockRequests: Array<() => Promise<IPackagesLoaderResult>> = [];
const mockWebRequests: Array<() => Promise<IPackagesLoaderResult>> = [];
let mockSdkResult: ISdkResult | undefined;
let mockWebResult: IPackage[] | undefined;
const mockGetPackages = jest.fn<Promise<IPackage[]>, []>();
const mockGetPackagesWebFallback = jest.fn<Promise<IPackage[]>, []>();
const mockGetStorefront = jest.fn<
  Promise<{ countryCode: string } | null>,
  []
>();
let mockInitializationError: Error | undefined;
let mockIsMas = true;
let mockIsNativeAndroid = false;

jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: (
    request: () => Promise<IPackagesLoaderResult>,
    _deps: unknown[],
    options: { initResult: unknown },
  ) => {
    // The card-price loader starts from [], the SDK loader from an object.
    if (Array.isArray(options.initResult)) {
      mockWebRequests.push(request);
      return {
        result: mockWebResult ?? [],
        isLoading: false,
        run: jest.fn(),
      };
    }
    mockRequests.push(request);
    return {
      result: mockSdkResult ?? options.initResult,
      isLoading: false,
      run: jest.fn(),
    };
  },
}));
jest.mock('@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth', () => ({
  useOneKeyAuth: () => ({ user: { onekeyUserId: 'user-a' } }),
}));
jest.mock('./usePrimePaymentMethods', () => ({
  usePrimePaymentMethods: () => ({
    isReady: true,
    initializationError: mockInitializationError,
    getPackagesNative: mockGetPackages,
    getStorefront: mockGetStorefront,
  }),
}));
jest.mock('@onekeyhq/shared/src/utils/timerUtils', () => {
  const actual = jest.requireActual<{
    default: Record<string, unknown>;
  }>('@onekeyhq/shared/src/utils/timerUtils');
  return {
    __esModule: true,
    default: { ...actual.default, wait: async () => undefined },
  };
});
let mockSimulatedFault: unknown;
jest.mock('./primePackagesFetchFault', () => ({
  getPrimeSimulatedPackagesFault: async () => mockSimulatedFault,
}));
jest.mock('./usePrimePaymentMethodsWeb', () => ({
  usePrimePaymentMethodsWeb: () => ({
    getPackagesWeb: () => mockGetPackagesWebFallback(),
  }),
}));
jest.mock('@onekeyhq/shared/src/errors/utils/errorToastUtils', () => ({
  __esModule: true,
  default: {
    withErrorAutoToast: (request: () => Promise<IPackage[]>) => request(),
  },
}));
const mockFetchPackagesFailed = jest.fn<void, [unknown]>();
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    prime: {
      subscription: {
        fetchPackagesFailed: (params: unknown) =>
          mockFetchPackagesFailed(params),
      },
    },
  },
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    get isMas() {
      return mockIsMas;
    },
    get isNative() {
      return !mockIsMas;
    },
    get isNativeIOS() {
      return !mockIsMas && !mockIsNativeAndroid;
    },
    get isNativeAndroid() {
      return mockIsNativeAndroid;
    },
    get isNativeAndroidGooglePlay() {
      return false;
    },
  },
}));

async function loadPackages() {
  const hook = renderHook(() =>
    usePrimeSubscriptionPackages({ enabled: true }),
  );
  const request = mockRequests[0];
  const webRequest = mockWebRequests[0];
  let packages: IPackage[] | undefined;
  let error: unknown;
  await act(async () => {
    if (webRequest) {
      const webResult = await webRequest();
      mockWebResult = Array.isArray(webResult) ? webResult : [];
    }
    try {
      const sdkResult = await request();
      if (!Array.isArray(sdkResult)) {
        mockSdkResult = sdkResult;
        packages = sdkResult.packages;
      }
    } catch (e) {
      error = e;
    }
  });
  hook.rerender();
  return { hook, packages, error };
}

describe('Prime subscription loading fail states', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequests.length = 0;
    mockWebRequests.length = 0;
    mockInitializationError = undefined;
    mockIsMas = true;
    mockIsNativeAndroid = false;
    mockSimulatedFault = undefined;
    mockSdkResult = undefined;
    mockWebResult = undefined;
    mockGetPackages.mockResolvedValue([]);
    mockGetPackagesWebFallback.mockResolvedValue([]);
    mockGetStorefront.mockResolvedValue({ countryCode: 'CHN' });
  });
  afterEach(cleanup);

  it.each([
    { platform: 'MAS', isMas: true },
    { platform: 'iOS', isMas: false },
  ])(
    'keeps initialization guidance outside the fail state on $platform',
    async ({ isMas }) => {
      mockIsMas = isMas;
      mockInitializationError = new OneKeyLocalError(
        enMessages[ETranslations.global_update_to_continue_desc_fallback],
      );
      mockGetPackages.mockRejectedValue(mockInitializationError);

      const { hook, error } = await loadPackages();
      expect(error).toBe(mockInitializationError);
      expect(hook.result.current.packagesFailure).toBeUndefined();
      expect(mockGetStorefront).not.toHaveBeenCalled();
    },
  );

  it('keeps a CHN Storefront for a product error', async () => {
    mockGetPackages.mockRejectedValue({ code: '5' });
    const { hook, packages } = await loadPackages();
    expect(packages).toEqual([]);
    expect(hook.result.current.packagesFailure).toEqual({
      kind: 'productUnavailable',
      storefrontCountryCode: 'CHN',
    });
    expect(mockFetchPackagesFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCode: '5',
        failureKind: 'productUnavailable',
        storefrontCountryCode: 'CHN',
      }),
    );
  });

  it.each([
    [{ code: '10' }, 'network'],
    [{ code: '35' }, 'network'],
    [{ code: '32' }, 'network'],
    [{ code: '2' }, 'storeUnavailable'],
    [{ code: '3' }, 'purchaseNotAllowed'],
  ])('maps %j to the %s fail state', async (error, kind) => {
    mockGetStorefront.mockResolvedValue({ countryCode: 'USA' });
    mockGetPackages.mockRejectedValue(error);
    const { hook } = await loadPackages();
    expect(hook.result.current.packagesFailure).toEqual({
      kind,
      storefrontCountryCode: 'USA',
    });
  });

  it('keeps an empty Apple offering on the generic fail state for a CHN Storefront', async () => {
    const { hook } = await loadPackages();
    expect(hook.result.current.packagesFailure).toEqual({
      kind: 'unknown',
      storefrontCountryCode: 'CHN',
    });
  });

  it('shows the China tip when RevenueCat reports no registered products without a code', async () => {
    mockGetPackages.mockRejectedValue({
      message:
        'None of the products registered in the RevenueCat dashboard could be fetched',
    });
    const { hook } = await loadPackages();
    expect(hook.result.current.packagesFailure).toEqual({
      kind: 'productUnavailable',
      storefrontCountryCode: 'CHN',
    });
  });

  it('no longer swallows Android purchase-not-allowed errors', async () => {
    mockIsMas = false;
    mockIsNativeAndroid = true;
    mockGetStorefront.mockResolvedValue({ countryCode: 'US' });
    mockGetPackages.mockRejectedValue({
      code: '3',
      message: 'The device or user is not allowed to make the purchase.',
    });
    const { hook } = await loadPackages();
    expect(hook.result.current.packagesFailure).toEqual({
      kind: 'purchaseNotAllowed',
      storefrontCountryCode: 'US',
    });
  });

  it('drops a Storefront that is not a plain country code', async () => {
    mockGetStorefront.mockResolvedValue({ countryCode: 'cn; drop' });
    mockGetPackages.mockRejectedValue({ code: '10' });
    const { hook } = await loadPackages();
    expect(hook.result.current.packagesFailure?.storefrontCountryCode).toBe(
      undefined,
    );
  });

  it('runs a simulated dev fault through the real classification', async () => {
    mockGetPackages.mockResolvedValue([{} as IPackage]);
    mockSimulatedFault = {
      error: { code: '10', message: '[Simulated] network error' },
    };
    const { hook } = await loadPackages();
    expect(mockGetPackages).not.toHaveBeenCalled();
    expect(hook.result.current.packagesFailure?.kind).toBe('network');
  });

  it('reports an empty Google Play list instead of a blank paywall', async () => {
    mockIsMas = false;
    mockIsNativeAndroid = true;
    mockGetStorefront.mockResolvedValue({ countryCode: 'US' });
    const { hook } = await loadPackages();
    expect(hook.result.current.packagesFailure).toEqual({
      kind: 'unknown',
      storefrontCountryCode: 'US',
    });
  });

  it('retries a transient failure once before showing the fail state', async () => {
    mockGetPackages
      .mockRejectedValueOnce({ code: '2' })
      .mockResolvedValueOnce([{} as IPackage]);
    const { hook, packages } = await loadPackages();
    expect(mockGetPackages).toHaveBeenCalledTimes(2);
    expect(packages).toHaveLength(1);
    expect(mockFetchPackagesFailed).not.toHaveBeenCalled();
    expect(hook.result.current.packagesFailure).toBeUndefined();
  });

  it('applies a simulated Storefront override', async () => {
    mockSimulatedFault = {
      error: {
        code: '23',
        message:
          '[Simulated] None of the products registered in the RevenueCat dashboard could be fetched',
      },
      storefrontCountryCode: 'CHN',
    };
    mockGetStorefront.mockResolvedValue({ countryCode: 'USA' });
    const { hook } = await loadPackages();
    expect(mockGetStorefront).not.toHaveBeenCalled();
    expect(hook.result.current.packagesFailure).toEqual({
      kind: 'productUnavailable',
      storefrontCountryCode: 'CHN',
    });
  });

  it('does not retry a non-transient failure', async () => {
    mockGetPackages.mockRejectedValue({ code: '3' });
    await loadPackages();
    expect(mockGetPackages).toHaveBeenCalledTimes(1);
  });

  it.each([
    {
      userInfo: { underlyingErrorMessage: 'Network connection failed' },
    },
    {
      userInfo: {
        NSUnderlyingError: {
          code: '-1009',
          domain: 'NSURLErrorDomain',
          message: 'underlying error',
          userInfo: { NSLocalizedDescription: '互联网连接已断开' },
        },
      },
    },
  ])(
    'retries a code 23 native network failure before recovering: %j',
    async (details) => {
      mockIsMas = false;
      mockGetPackages
        .mockRejectedValueOnce({ code: '23', ...details })
        .mockResolvedValueOnce([{} as IPackage]);

      const { hook, packages } = await loadPackages();
      expect(mockGetPackages).toHaveBeenCalledTimes(2);
      expect(packages).toHaveLength(1);
      expect(hook.result.current.packagesFailure).toBeUndefined();
      expect(mockFetchPackagesFailed).not.toHaveBeenCalled();
    },
  );

  it('keeps a simulated fault visible when an Android APK card list loads', async () => {
    mockIsMas = false;
    mockIsNativeAndroid = true;
    mockGetStorefront.mockResolvedValue({ countryCode: 'US' });
    const cardPackage = { subscriptionPeriod: 'P1Y' } as IPackage;
    mockGetPackages.mockResolvedValue([cardPackage]);
    mockGetPackagesWebFallback.mockResolvedValue([cardPackage]);
    mockSimulatedFault = {
      error: { code: '5', message: '[Simulated] product not available' },
    };

    const { hook } = await loadPackages();

    expect(mockGetPackages).not.toHaveBeenCalled();
    expect(mockGetPackagesWebFallback).not.toHaveBeenCalled();
    expect(hook.result.current.packages).toEqual([]);
    expect(hook.result.current.packagesFailure).toEqual({
      kind: 'productUnavailable',
      storefrontCountryCode: 'US',
    });
    expect(mockFetchPackagesFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCode: '5',
        failureKind: 'productUnavailable',
        storefrontCountryCode: 'US',
      }),
    );
  });

  it('keeps a simulated empty offering visible when an Android APK card list loads', async () => {
    mockIsMas = false;
    mockIsNativeAndroid = true;
    mockGetStorefront.mockResolvedValue({ countryCode: 'US' });
    const cardPackage = { subscriptionPeriod: 'P1Y' } as IPackage;
    mockGetPackages.mockResolvedValue([cardPackage]);
    mockGetPackagesWebFallback.mockResolvedValue([cardPackage]);
    mockSimulatedFault = {};

    const { hook } = await loadPackages();

    expect(mockGetPackagesWebFallback).not.toHaveBeenCalled();
    expect(hook.result.current.packages).toEqual([]);
    expect(hook.result.current.packagesFailure).toEqual({
      kind: 'unknown',
      storefrontCountryCode: 'US',
    });
  });

  it('still shows Android APK card prices after a real store load failure', async () => {
    mockIsMas = false;
    mockIsNativeAndroid = true;
    mockGetStorefront.mockResolvedValue({ countryCode: 'US' });
    const cardPackage = { subscriptionPeriod: 'P1M' } as IPackage;
    mockGetPackages.mockRejectedValue({
      code: '5',
      message: 'missing product',
    });
    mockGetPackagesWebFallback.mockResolvedValue([cardPackage]);

    const { hook } = await loadPackages();

    expect(mockGetPackagesWebFallback).toHaveBeenCalledTimes(1);
    expect(hook.result.current.packages).toEqual([cardPackage]);
    expect(hook.result.current.packagesFailure).toBeUndefined();
  });

  it('loads Android APK store plans when the card price request fails', async () => {
    mockIsMas = false;
    mockIsNativeAndroid = true;
    const storePackage = { subscriptionPeriod: 'P1Y' } as IPackage;
    mockGetPackages.mockResolvedValue([storePackage]);
    mockGetPackagesWebFallback.mockRejectedValue(new Error('offline'));

    const { hook, error } = await loadPackages();

    expect(error).toBeUndefined();
    expect(hook.result.current.packages).toEqual([storePackage]);
    expect(hook.result.current.packagesFailure).toBeUndefined();
  });

  it('keeps a general configuration failure generic even for a CHN account', async () => {
    mockGetPackages.mockRejectedValue({
      code: '23',
      message: 'No products configured for the selected API key',
    });

    const { hook } = await loadPackages();
    expect(mockGetPackages).toHaveBeenCalledTimes(1);
    expect(hook.result.current.packagesFailure?.kind).toBe('unknown');
  });
});

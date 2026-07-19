/** @jest-environment jsdom */

import { act, cleanup, renderHook, waitFor } from '@testing-library/react';

import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

import { usePrimePurchaseCallback } from './PrimePurchaseDialog';

const mockPurchasePackageNative = jest.fn();
const mockPurchasePackageWeb = jest.fn();
const mockPurchasePackageWebview = jest.fn();
const mockRefreshPrimeUserInfo = jest.fn<Promise<void>, []>();
const mockTryClaimKytIntro = jest.fn<
  Promise<{
    status: 'claimed';
    claimId: string;
    entryPoint: 'primeSubscribeSuccess';
  }>,
  [unknown]
>();
const mockPurchaseSuccessListener = jest.fn();
const mockEmitToSelf = jest.spyOn(appEventBus, 'emitToSelf');
let mockIsNativeAndroidGooglePlay = false;

jest.mock('react-intl', () => ({
  useIntl: () => ({ locale: 'en-US', formatMessage: jest.fn() }),
}));

jest.mock('@onekeyhq/components', () => ({
  ActionList: { show: jest.fn() },
  Dialog: { Footer: () => null },
  Skeleton: () => null,
  Stack: () => null,
  YStack: () => null,
}));

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    servicePrime: {
      apiFetchPrimeUserInfo: () => mockRefreshPrimeUserInfo(),
    },
    serviceSetting: {
      tryClaimKytIntro: (params: unknown) => mockTryClaimKytIntro(params),
    },
  },
}));

jest.mock('@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth', () => ({
  useOneKeyAuth: () => ({
    supabaseUser: { email: 'prime@example.com' },
    user: { onekeyUserId: 'user-a' },
  }),
}));

jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: () => ({ result: undefined }),
}));

jest.mock('@onekeyhq/shared/src/googlePlayService/googlePlayService', () => ({
  __esModule: true,
  default: { isAvailable: jest.fn(async () => false) },
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    prime: {
      subscription: { primeSubscribeIntent: jest.fn() },
      usage: { primeReceiveKytIntroFlowFailed: jest.fn() },
    },
  },
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isNativeAndroid: false,
    get isNativeAndroidGooglePlay() {
      return mockIsNativeAndroidGooglePlay;
    },
    isNativeIOS: false,
  },
}));

jest.mock('../../hooks/usePrimePayment', () => ({
  usePrimePayment: () => ({
    purchasePackageNative: mockPurchasePackageNative,
    purchasePackageWeb: mockPurchasePackageWeb,
  }),
}));

jest.mock('./PrimeSubscriptionPlans', () => ({
  PrimeSubscriptionPlans: () => null,
}));

jest.mock('./usePurchasePackageWebview', () => ({
  usePurchasePackageWebview: () => mockPurchasePackageWebview,
}));

describe('usePrimePurchaseCallback web checkout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsNativeAndroidGooglePlay = false;
    mockRefreshPrimeUserInfo.mockResolvedValue(undefined);
    mockTryClaimKytIntro.mockResolvedValue({
      status: 'claimed',
      claimId: 'purchase-claim',
      entryPoint: 'primeSubscribeSuccess',
    });
    appEventBus.on(
      EAppEventBusNames.PrimeSubscriptionPurchaseSuccess,
      mockPurchaseSuccessListener,
    );
  });

  afterEach(() => {
    appEventBus.off(
      EAppEventBusNames.PrimeSubscriptionPurchaseSuccess,
      mockPurchaseSuccessListener,
    );
    cleanup();
  });

  afterAll(() => {
    mockEmitToSelf.mockRestore();
  });

  it('emits after an active entitlement even when the server refresh lags', async () => {
    mockPurchasePackageWeb.mockResolvedValue({
      customerInfo: {
        entitlements: {
          active: {
            Prime: { isActive: true, periodType: 'TRIAL' },
          },
        },
      },
    });
    mockRefreshPrimeUserInfo.mockRejectedValueOnce(
      new Error('server projection is delayed'),
    );
    const { result } = renderHook(() => usePrimePurchaseCallback());

    await act(async () => {
      await result.current.purchase({ selectedSubscriptionPeriod: 'P1Y' });
    });

    expect(mockRefreshPrimeUserInfo).toHaveBeenCalledTimes(1);
    expect(mockPurchaseSuccessListener).toHaveBeenCalledWith({
      claimId: 'purchase-claim',
      onekeyUserId: 'user-a',
    });
    expect(mockEmitToSelf).toHaveBeenCalledWith({
      type: EAppEventBusNames.PrimeSubscriptionPurchaseSuccess,
      payload: {
        claimId: 'purchase-claim',
        onekeyUserId: 'user-a',
      },
      isRemote: false,
    });
    expect(mockTryClaimKytIntro.mock.invocationCallOrder[0]).toBeLessThan(
      mockRefreshPrimeUserInfo.mock.invocationCallOrder[0],
    );
  });

  it('routes Google Play builds through the native purchase flow', async () => {
    mockIsNativeAndroidGooglePlay = true;
    mockPurchasePackageNative.mockResolvedValue({
      customerInfo: {
        entitlements: {
          active: { Prime: { isActive: true } },
        },
      },
    });
    const { result } = renderHook(() => usePrimePurchaseCallback());

    await act(async () => {
      await result.current.purchase({ selectedSubscriptionPeriod: 'P1Y' });
    });

    await waitFor(() => expect(mockPurchasePackageNative).toHaveBeenCalled());
    expect(mockPurchasePackageWeb).not.toHaveBeenCalled();
  });

  it('does not emit when checkout returns no active Prime entitlement', async () => {
    mockPurchasePackageWeb.mockResolvedValue({
      customerInfo: { entitlements: { active: {} } },
    });
    const { result } = renderHook(() => usePrimePurchaseCallback());

    await act(async () => {
      await result.current.purchase({ selectedSubscriptionPeriod: 'P1M' });
    });

    expect(mockPurchaseSuccessListener).not.toHaveBeenCalled();
  });

  it('does not emit when checkout is cancelled or fails', async () => {
    mockPurchasePackageWeb.mockRejectedValue(new Error('Purchase cancelled'));
    const { result } = renderHook(() => usePrimePurchaseCallback());

    await expect(
      act(async () => {
        await result.current.purchase({ selectedSubscriptionPeriod: 'P1Y' });
      }),
    ).rejects.toThrow('Purchase cancelled');

    expect(mockRefreshPrimeUserInfo).toHaveBeenCalledTimes(1);
    expect(mockPurchaseSuccessListener).not.toHaveBeenCalled();
  });
});

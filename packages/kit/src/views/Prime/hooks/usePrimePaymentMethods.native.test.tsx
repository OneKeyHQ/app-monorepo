/** @jest-environment jsdom */

import { act, cleanup, renderHook, waitFor } from '@testing-library/react';

import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

import primePaymentUtils from './primePaymentUtils';
import { usePrimePaymentMethods } from './usePrimePaymentMethods.native';

const mockConfigure = jest.fn<void, [unknown]>();
const mockGetAppUserID = jest.fn<Promise<string>, []>();
const mockGetOfferings = jest.fn<Promise<unknown>, []>();
const mockLogIn = jest.fn<Promise<void>, [string]>();
const mockPurchasePackage = jest.fn<Promise<unknown>, [unknown]>();
const mockSetMixpanelDistinctID = jest.fn<Promise<void>, [string]>();
const mockSetAttributes = jest.fn<Promise<void>, [Record<string, string>]>();
const mockPrimeSubscribeFailed = jest.fn<void, [unknown]>();
const mockPrimeSubscribeFailedLocal = jest.fn<void, [unknown]>();
const mockPrimeRestorePurchaseResult = jest.fn<void, [unknown]>();
const mockDialogConfirm = jest.fn<void, [unknown]>();
const mockFetchPrimeUserInfo = jest.fn<Promise<void>, []>();
const mockTryClaimKytIntro = jest.fn<
  Promise<{
    status: 'claimed';
    claimId: string;
    entryPoint: 'primeSubscribeSuccess';
  }>,
  [unknown]
>();
const mockHideDialogLoading = jest.fn(async () => undefined);
const mockPurchaseSuccessListener = jest.fn();
const mockTrackPrimeSubscriptionSuccess = jest.fn<void, [unknown]>();
const mockEmitToSelf = jest.spyOn(appEventBus, 'emitToSelf');
const mockIsGooglePlayAvailable = jest.fn(async () => true);
let mockIsNativeAndroid = false;
let mockIsNativeIOS = true;
let mockRecurringPriceUnit: 'major' | 'micros' = 'major';
const mockTrackPrimeSubscriptionSuccessSpy = jest
  .spyOn(primePaymentUtils, 'trackPrimeSubscriptionSuccess')
  .mockImplementation((params) => mockTrackPrimeSubscriptionSuccess(params));

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: {
    configure: (params: unknown) => mockConfigure(params),
    getAppUserID: () => mockGetAppUserID(),
    getOfferings: () => mockGetOfferings(),
    logIn: (onekeyUserId: string) => mockLogIn(onekeyUserId),
    purchasePackage: (offering: unknown) => mockPurchasePackage(offering),
    setLogLevel: jest.fn(async () => undefined),
    setMixpanelDistinctID: (instanceId: string) =>
      mockSetMixpanelDistinctID(instanceId),
    setAttributes: (attributes: Record<string, string>) =>
      mockSetAttributes(attributes),
    setProxyURL: jest.fn(async () => undefined),
  },
  INTRO_ELIGIBILITY_STATUS: {
    INTRO_ELIGIBILITY_STATUS_ELIGIBLE: 'eligible',
  },
  LOG_LEVEL: { VERBOSE: 'verbose' },
}));

jest.mock('@onekeyhq/components', () => ({
  Dialog: {
    confirm: (options: unknown) => {
      mockDialogConfirm(options);
    },
  },
  Toast: {
    message: jest.fn(),
    success: jest.fn(),
  },
}));

jest.mock('@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth', () => ({
  useOneKeyAuth: () => ({
    isReady: true,
    user: { onekeyUserId: 'user-a' },
  }),
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  usePrimePersistAtom: () => [{}, jest.fn()],
  useSettingsPersistAtom: () => [{ instanceId: 'instance-a' }],
}));

jest.mock('@onekeyhq/shared/src/errors/utils/errorToastUtils', () => ({
  __esModule: true,
  default: { toastIfError: jest.fn() },
}));

jest.mock('@onekeyhq/shared/src/googlePlayService/googlePlayService', () => ({
  __esModule: true,
  default: { isAvailable: () => mockIsGooglePlayAvailable() },
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    prime: {
      usage: { primeReceiveKytIntroFlowFailed: jest.fn() },
      subscription: {
        primeSubscribeFailed: (params: unknown) =>
          mockPrimeSubscribeFailed(params),
        primeSubscribeFailedLocal: (params: unknown) =>
          mockPrimeSubscribeFailedLocal(params),
        primeRestorePurchaseResult: (params: unknown) =>
          mockPrimeRestorePurchaseResult(params),
      },
    },
  },
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    get isNativeAndroid() {
      return mockIsNativeAndroid;
    },
    get isNativeIOS() {
      return mockIsNativeIOS;
    },
  },
}));

jest.mock('@onekeyhq/shared/src/utils/debug/perfUtils', () => ({
  __esModule: true,
  default: {
    buildNewValueIfChanged: (_previous: unknown, next: unknown) => next,
  },
}));

jest.mock('../../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceApp: {
      hideDialogLoading: () => mockHideDialogLoading(),
    },
    servicePrime: {
      apiFetchPrimeUserInfo: () => mockFetchPrimeUserInfo(),
    },
    serviceSetting: {
      tryClaimKytIntro: (params: unknown) => mockTryClaimKytIntro(params),
    },
  },
}));

jest.mock('./getPrimePaymentApiKey', () => ({
  getPrimePaymentApiKey: jest.fn(async () => ({ apiKey: 'rc-native-key' })),
}));

jest.mock('./revenueCatNativeCompatibility.native', () => ({
  configureRevenueCat: (params: unknown) => mockConfigure(params),
  getRevenueCatRecurringPriceUnit: () => mockRecurringPriceUnit,
}));

type ISuccessDialogOptions = {
  onClose: () => void;
};

const mockOffering = {
  product: {
    currencyCode: 'USD',
    pricePerMonth: 9,
    pricePerYear: 99,
    subscriptionPeriod: 'P1Y',
  },
};

function setRequestIdleCallback() {
  Object.defineProperty(globalThis, 'requestIdleCallback', {
    configurable: true,
    value: (callback: IdleRequestCallback) => {
      callback({
        didTimeout: false,
        timeRemaining: () => 50,
      });
      return 1;
    },
    writable: true,
  });
}

describe('usePrimePaymentMethods native purchase', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsNativeAndroid = false;
    mockIsNativeIOS = true;
    mockRecurringPriceUnit = 'major';
    setRequestIdleCallback();
    mockGetAppUserID.mockResolvedValue('user-a');
    mockGetOfferings.mockResolvedValue({
      current: { availablePackages: [mockOffering] },
    });
    mockLogIn.mockResolvedValue(undefined);
    mockSetMixpanelDistinctID.mockResolvedValue(undefined);
    mockFetchPrimeUserInfo.mockResolvedValue(undefined);
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
    mockTrackPrimeSubscriptionSuccessSpy.mockRestore();
  });

  it.each([
    {
      platform: 'iOS',
      isNativeAndroid: false,
      isNativeIOS: true,
      recurringPriceUnit: 'major' as const,
      rawPricePerYear: 99,
    },
    {
      platform: 'Google Play',
      isNativeAndroid: true,
      isNativeIOS: false,
      recurringPriceUnit: 'major' as const,
      rawPricePerYear: 99,
    },
    {
      platform: 'legacy Google Play OTA',
      isNativeAndroid: true,
      isNativeIOS: false,
      recurringPriceUnit: 'micros' as const,
      rawPricePerYear: 99_000_000,
    },
  ])(
    'emits after the success dialog closes for an active $platform entitlement',
    async ({
      isNativeAndroid,
      isNativeIOS,
      recurringPriceUnit,
      rawPricePerYear,
    }) => {
      mockIsNativeAndroid = isNativeAndroid;
      mockIsNativeIOS = isNativeIOS;
      mockRecurringPriceUnit = recurringPriceUnit;
      mockGetOfferings.mockResolvedValue({
        current: {
          availablePackages: [
            {
              product: {
                ...mockOffering.product,
                pricePerYear: rawPricePerYear,
              },
            },
          ],
        },
      });
      const purchaseResult = {
        customerInfo: {
          entitlements: {
            active: {
              Prime: { isActive: true, periodType: 'TRIAL' },
            },
          },
          managementURL: 'https://subscriptions.example.com',
        },
      };
      mockPurchasePackage.mockResolvedValue(purchaseResult);
      mockFetchPrimeUserInfo.mockRejectedValueOnce(
        new Error('RevenueCat webhook is delayed'),
      );
      const { result } = renderHook(() => usePrimePaymentMethods());
      await waitFor(() => expect(result.current.isReady).toBe(true));

      let returnedResult: unknown;
      await act(async () => {
        returnedResult = await result.current.purchasePackageNative?.({
          subscriptionPeriod: 'P1Y',
        });
      });

      expect(returnedResult).toBe(purchaseResult);
      expect(mockDialogConfirm).toHaveBeenCalledTimes(1);
      expect(mockPurchaseSuccessListener).not.toHaveBeenCalled();

      const dialogOptions = mockDialogConfirm.mock
        .calls[0][0] as ISuccessDialogOptions;
      act(() => {
        dialogOptions.onClose();
      });

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
        mockFetchPrimeUserInfo.mock.invocationCallOrder[0],
      );
      // The hook is the single refresh owner: exactly one refresh per purchase.
      expect(mockFetchPrimeUserInfo).toHaveBeenCalledTimes(1);
      expect(mockTrackPrimeSubscriptionSuccess).toHaveBeenCalledWith({
        amount: 99,
        currency: 'USD',
        subscriptionPeriod: 'P1Y',
        featureName: undefined,
        paymentMethod: 'iap',
      });
      // RevenueCat -> PostHog identity alignment: server-side subscription
      // events must land on the same analytics person as client events.
      expect(mockSetAttributes).toHaveBeenCalledWith({
        '$posthogUserId': 'instance-a',
      });
      if (isNativeAndroid) {
        expect(mockIsGooglePlayAvailable).toHaveBeenCalledTimes(1);
      } else {
        expect(mockIsGooglePlayAvailable).not.toHaveBeenCalled();
      }
    },
  );

  it('keeps native offering prices in major currency units', async () => {
    const { result } = renderHook(() => usePrimePaymentMethods());
    await waitFor(() => expect(result.current.isReady).toBe(true));

    let packages: Awaited<
      ReturnType<NonNullable<typeof result.current.getPackagesNative>>
    > = [];
    await act(async () => {
      packages = (await result.current.getPackagesNative?.()) || [];
    });

    expect(packages).toEqual([
      expect.objectContaining({
        pricePerMonth: 9,
        pricePerMonthString: '9 USD',
        pricePerYear: 99,
        pricePerYearString: '99 USD',
        priceTotalPerYearString: '99 USD',
      }),
    ]);
  });

  it('converts legacy Android offering prices from micros', async () => {
    mockIsNativeAndroid = true;
    mockIsNativeIOS = false;
    mockRecurringPriceUnit = 'micros';
    mockGetOfferings.mockResolvedValue({
      current: {
        availablePackages: [
          {
            product: {
              ...mockOffering.product,
              pricePerMonth: 9_000_000,
              pricePerYear: 99_000_000,
            },
          },
        ],
      },
    });

    const { result } = renderHook(() => usePrimePaymentMethods());
    await waitFor(() => expect(result.current.isReady).toBe(true));

    let packages: Awaited<
      ReturnType<NonNullable<typeof result.current.getPackagesNative>>
    > = [];
    await act(async () => {
      packages = (await result.current.getPackagesNative?.()) || [];
    });

    expect(packages).toEqual([
      expect.objectContaining({
        pricePerMonth: 9,
        pricePerMonthString: '9 USD',
        pricePerYear: 99,
        pricePerYearString: '99 USD',
        priceTotalPerYearString: '99 USD',
      }),
    ]);
  });

  it('does not show success or emit without an active Prime entitlement', async () => {
    mockPurchasePackage.mockResolvedValue({
      customerInfo: { entitlements: { active: {} } },
    });
    const { result } = renderHook(() => usePrimePaymentMethods());
    await waitFor(() => expect(result.current.isReady).toBe(true));

    await act(async () => {
      await result.current.purchasePackageNative?.({
        subscriptionPeriod: 'P1Y',
      });
    });

    expect(mockDialogConfirm).not.toHaveBeenCalled();
    expect(mockPurchaseSuccessListener).not.toHaveBeenCalled();
    // Failed purchases still refresh the server projection exactly once.
    expect(mockFetchPrimeUserInfo).toHaveBeenCalledTimes(1);
  });

  it('does not show success or emit when native purchase is cancelled', async () => {
    mockPurchasePackage.mockRejectedValue(new Error('Purchase was cancelled.'));
    const { result } = renderHook(() => usePrimePaymentMethods());
    await waitFor(() => expect(result.current.isReady).toBe(true));

    await expect(
      act(async () => {
        await result.current.purchasePackageNative?.({
          subscriptionPeriod: 'P1Y',
        });
      }),
    ).rejects.toThrow('Purchase was cancelled.');

    expect(mockDialogConfirm).not.toHaveBeenCalled();
    expect(mockPurchaseSuccessListener).not.toHaveBeenCalled();
    // The rejection surfaces before the catch/finally async tail settles, so
    // poll instead of asserting synchronously.
    await waitFor(() =>
      expect(mockPrimeSubscribeFailed).toHaveBeenCalledWith(
        expect.objectContaining({
          paymentMethod: 'iap',
          subscriptionPeriod: 'P1Y',
          reason: 'userCancelled',
        }),
      ),
    );
    expect(errorToastUtils.toastIfError).not.toHaveBeenCalled();
    // A cancelled purchase refreshes the server projection exactly once.
    await waitFor(() =>
      expect(mockFetchPrimeUserInfo).toHaveBeenCalledTimes(1),
    );
  });

  it('does not toast when native purchase is cancelled via userCancelled flag only', async () => {
    mockPurchasePackage.mockRejectedValue(
      Object.assign(new Error('Purchase cancelled by user'), {
        userCancelled: true,
        code: 1,
      }),
    );
    const { result } = renderHook(() => usePrimePaymentMethods());
    await waitFor(() => expect(result.current.isReady).toBe(true));

    await expect(
      act(async () => {
        await result.current.purchasePackageNative?.({
          subscriptionPeriod: 'P1Y',
        });
      }),
    ).rejects.toThrow('Purchase cancelled by user');

    await waitFor(() =>
      expect(mockPrimeSubscribeFailed).toHaveBeenCalledWith(
        expect.objectContaining({
          paymentMethod: 'iap',
          reason: 'userCancelled',
        }),
      ),
    );
    expect(errorToastUtils.toastIfError).not.toHaveBeenCalled();
  });

  it('reports paymentFailed when the store purchase throws a non-cancel error', async () => {
    mockPurchasePackage.mockRejectedValue(
      Object.assign(new Error('Store connection failed'), {
        code: 2,
        userCancelled: false,
      }),
    );
    const { result } = renderHook(() => usePrimePaymentMethods());
    await waitFor(() => expect(result.current.isReady).toBe(true));

    await expect(
      act(async () => {
        await result.current.purchasePackageNative?.({
          subscriptionPeriod: 'P1Y',
        });
      }),
    ).rejects.toThrow('Store connection failed');

    // The rejection surfaces before the catch/finally async tail settles, so
    // poll instead of asserting synchronously.
    await waitFor(() =>
      expect(mockPrimeSubscribeFailed).toHaveBeenCalledWith(
        expect.objectContaining({
          paymentMethod: 'iap',
          subscriptionPeriod: 'P1Y',
          reason: 'paymentFailed',
          errorCode: '2',
        }),
      ),
    );
    expect(errorToastUtils.toastIfError).toHaveBeenCalled();
  });
});

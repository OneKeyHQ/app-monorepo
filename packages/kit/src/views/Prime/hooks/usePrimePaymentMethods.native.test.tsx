/** @jest-environment jsdom */

import { act, cleanup, renderHook, waitFor } from '@testing-library/react';

import { Toast } from '@onekeyhq/components';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
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
const mockRestorePurchases = jest.fn<Promise<unknown>, []>();
const mockGetCustomerInfo = jest.fn<Promise<unknown>, []>();
const mockSetPrimePersistAtom = jest.fn<void, [unknown]>();
let mockOneKeyUserId = 'user-a';
let mockPersistedOneKeyUserId = 'user-a';
const mockPrimeRestorePurchaseErrorTrace = jest.fn<void, [unknown]>();
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
    getCustomerInfo: () => mockGetCustomerInfo(),
    logIn: (onekeyUserId: string) => mockLogIn(onekeyUserId),
    purchasePackage: (offering: unknown) => mockPurchasePackage(offering),
    restorePurchases: () => mockRestorePurchases(),
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
    user: { onekeyUserId: mockOneKeyUserId },
  }),
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  primePersistAtom: {
    get: async () => ({
      onekeyUserId: mockPersistedOneKeyUserId,
      isLoggedIn: true,
      isLoggedInOnServer: true,
    }),
  },
  usePrimePersistAtom: () => [{}, mockSetPrimePersistAtom],
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
        onekeyIdStateTrace: (params: unknown) =>
          mockPrimeRestorePurchaseErrorTrace(params),
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
      showDialogLoading: jest.fn(async () => undefined),
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
  onClose: () => Promise<void>;
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
    mockOneKeyUserId = 'user-a';
    mockPersistedOneKeyUserId = 'user-a';
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
      await act(async () => {
        await dialogOptions.onClose();
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

  it('reports clientError when a pre-purchase OneKeyLocalError is thrown', async () => {
    mockGetOfferings.mockResolvedValue({ current: { availablePackages: [] } });
    const { result } = renderHook(() => usePrimePaymentMethods());
    await waitFor(() => expect(result.current.isReady).toBe(true));

    await expect(
      act(async () => {
        await result.current.purchasePackageNative?.({
          subscriptionPeriod: 'P1Y',
        });
      }),
    ).rejects.toThrow(OneKeyLocalError);

    await waitFor(() =>
      expect(mockPrimeSubscribeFailed).toHaveBeenCalledWith(
        expect.objectContaining({
          paymentMethod: 'iap',
          subscriptionPeriod: 'P1Y',
          reason: 'clientError',
          errorMessage: 'Offering not found',
        }),
      ),
    );
  });

  it('does not start a purchase after the OneKey ID changes during offerings', async () => {
    let resolveOfferings: ((value: unknown) => void) | undefined;
    mockGetOfferings.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveOfferings = resolve;
        }),
    );
    const { result, rerender } = renderHook(() => usePrimePaymentMethods());
    await waitFor(() => expect(result.current.isReady).toBe(true));
    let purchase: Promise<unknown> | undefined;
    act(() => {
      purchase = result.current.purchasePackageNative?.({
        subscriptionPeriod: 'P1Y',
      });
    });
    await waitFor(() => expect(mockGetOfferings).toHaveBeenCalled());
    mockOneKeyUserId = 'user-b';
    rerender();
    await act(async () => {
      resolveOfferings?.({ current: { availablePackages: [mockOffering] } });
      await expect(purchase).rejects.toThrow('OneKey ID changed');
    });
    expect(mockPurchasePackage).not.toHaveBeenCalled();
    expect(mockDialogConfirm).not.toHaveBeenCalled();
  });

  it('does not project or announce a previous account purchase result', async () => {
    let resolvePurchase: ((value: unknown) => void) | undefined;
    mockPurchasePackage.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolvePurchase = resolve;
        }),
    );
    const { result, rerender } = renderHook(() => usePrimePaymentMethods());
    await waitFor(() => expect(result.current.isReady).toBe(true));
    let purchase: Promise<unknown> | undefined;
    act(() => {
      purchase = result.current.purchasePackageNative?.({
        subscriptionPeriod: 'P1Y',
      });
    });
    await waitFor(() => expect(mockPurchasePackage).toHaveBeenCalled());
    mockOneKeyUserId = 'user-b';
    rerender();
    await act(async () => {
      resolvePurchase?.({
        customerInfo: {
          managementURL: 'https://old-user.example.com',
          entitlements: { active: { Prime: { isActive: true } } },
        },
      });
      await expect(purchase).rejects.toThrow('OneKey ID changed');
    });
    expect(mockSetPrimePersistAtom).not.toHaveBeenCalled();
    expect(mockTryClaimKytIntro).not.toHaveBeenCalled();
    expect(mockDialogConfirm).not.toHaveBeenCalled();
  });

  it('does not project a previous account customer-info response', async () => {
    let resolveCustomerInfo: ((value: unknown) => void) | undefined;
    mockGetCustomerInfo.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveCustomerInfo = resolve;
        }),
    );
    const { result, rerender } = renderHook(() => usePrimePaymentMethods());
    await waitFor(() => expect(result.current.isReady).toBe(true));
    let customerInfo: Promise<unknown> | undefined;
    act(() => {
      customerInfo = result.current.getCustomerInfo();
    });
    await waitFor(() => expect(mockGetCustomerInfo).toHaveBeenCalled());
    mockOneKeyUserId = 'user-b';
    rerender();
    await act(async () => {
      resolveCustomerInfo?.({
        managementURL: 'https://old-user.example.com',
        entitlements: { active: {} },
      });
      await expect(customerInfo).rejects.toThrow('OneKey ID changed');
    });
    expect(mockSetPrimePersistAtom).not.toHaveBeenCalled();
  });

  it.each([true, false])(
    'checks live identity after unmount when accountChanged=%s',
    async (accountChanged) => {
      let resolvePurchase: ((value: unknown) => void) | undefined;
      mockPurchasePackage.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolvePurchase = resolve;
          }),
      );
      const { result, unmount } = renderHook(() => usePrimePaymentMethods());
      await waitFor(() => expect(result.current.isReady).toBe(true));
      let purchase: Promise<unknown> | undefined;
      act(() => {
        purchase = result.current.purchasePackageNative?.({
          subscriptionPeriod: 'P1Y',
        });
      });
      await waitFor(() => expect(mockPurchasePackage).toHaveBeenCalled());
      unmount();
      if (accountChanged) {
        mockPersistedOneKeyUserId = 'user-b';
      }
      const purchaseResult = {
        customerInfo: {
          managementURL: 'https://user-a.example.com',
          entitlements: { active: { Prime: { isActive: true } } },
        },
      };
      await act(async () => {
        resolvePurchase?.(purchaseResult);
        if (accountChanged) {
          await expect(purchase).rejects.toThrow('OneKey ID changed');
        } else {
          await expect(purchase).resolves.toBe(purchaseResult);
        }
      });
      expect(mockDialogConfirm).toHaveBeenCalledTimes(accountChanged ? 0 : 1);
      expect(mockTryClaimKytIntro).toHaveBeenCalledTimes(
        accountChanged ? 0 : 1,
      );
      if (!accountChanged) {
        const dialog = mockDialogConfirm.mock
          .calls[0][0] as ISuccessDialogOptions;
        mockPersistedOneKeyUserId = 'user-b';
        await act(async () => {
          await dialog.onClose();
        });
        expect(mockPurchaseSuccessListener).not.toHaveBeenCalled();
      }
    },
  );

  it('reports initialization failure without waiting indefinitely', async () => {
    mockConfigure.mockImplementationOnce(() => {
      throw new OneKeyLocalError('Store SDK unavailable');
    });
    const { result } = renderHook(() => usePrimePaymentMethods());
    await waitFor(() => expect(result.current.isReady).toBe(true));
    await expect(result.current.getPackagesNative?.()).rejects.toThrow(
      'Store SDK unavailable',
    );
    expect(mockGetOfferings).not.toHaveBeenCalled();
  });

  it('reports restore success even when user-info refresh fails', async () => {
    mockRestorePurchases.mockResolvedValue({
      entitlements: { active: { Prime: { isActive: true } } },
    });
    mockFetchPrimeUserInfo.mockRejectedValueOnce(
      new Error('prime user info unavailable'),
    );
    const { result } = renderHook(() => usePrimePaymentMethods());
    await waitFor(() => expect(result.current.isReady).toBe(true));

    await act(async () => {
      await result.current.restorePurchases?.();
    });

    expect(mockPrimeRestorePurchaseResult).toHaveBeenCalledWith({
      result: 'success',
    });
    expect(Toast.success).toHaveBeenCalled();
    expect(mockPrimeRestorePurchaseResult).not.toHaveBeenCalledWith({
      result: 'failed',
    });
    expect(mockPrimeRestorePurchaseErrorTrace).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: expect.stringContaining('user-info refresh failed'),
      }),
    );
  });
});

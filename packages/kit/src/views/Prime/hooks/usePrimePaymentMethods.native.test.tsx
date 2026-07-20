/** @jest-environment jsdom */

import { act, cleanup, renderHook, waitFor } from '@testing-library/react';

import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

import { usePrimePaymentMethods } from './usePrimePaymentMethods.native';

const mockConfigure = jest.fn<void, [unknown]>();
const mockGetAppUserID = jest.fn<Promise<string>, []>();
const mockGetOfferings = jest.fn<Promise<unknown>, []>();
const mockLogIn = jest.fn<Promise<void>, [string]>();
const mockPurchasePackage = jest.fn<Promise<unknown>, [unknown]>();
const mockSetMixpanelDistinctID = jest.fn<Promise<void>, [string]>();
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

jest.mock('./primePaymentUtils', () => ({
  __esModule: true,
  default: {
    extractNativeFreeTrial: jest.fn(),
    formatPriceString: jest.fn((value: number) => String(value)),
    normalizeNativePrice: jest.fn((value: number) => value),
    trackPrimeSubscriptionSuccess: (params: unknown) =>
      mockTrackPrimeSubscriptionSuccess(params),
  },
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
  });

  it.each([
    ['iOS', false, true],
    ['Google Play', true, false],
  ])(
    'emits after the success dialog closes for an active %s entitlement',
    async (_platform, isNativeAndroid, isNativeIOS) => {
      mockIsNativeAndroid = isNativeAndroid;
      mockIsNativeIOS = isNativeIOS;
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
      if (isNativeAndroid) {
        expect(mockIsGooglePlayAvailable).toHaveBeenCalledTimes(1);
      } else {
        expect(mockIsGooglePlayAvailable).not.toHaveBeenCalled();
      }
    },
  );

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
    // A cancelled purchase refreshes the server projection exactly once. The
    // rejection surfaces before the finally block's async tail settles, so
    // poll instead of asserting synchronously.
    await waitFor(() =>
      expect(mockFetchPrimeUserInfo).toHaveBeenCalledTimes(1),
    );
  });
});

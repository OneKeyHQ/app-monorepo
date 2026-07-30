/** @jest-environment jsdom */
/* cspell:ignore Infini */

import type { ReactElement, ReactNode } from 'react';

import { act, cleanup, render, renderHook } from '@testing-library/react';

import { ETranslations } from '@onekeyhq/shared/src/locale';

import { usePrimePurchaseCallback } from './PrimePurchaseDialog';

type IPrimeInfiniPaymentEntryGuard = {
  isLoggedIn: boolean;
  hasPendingPayment: boolean;
  onekeyUserId: string | undefined;
};

type IMockDialogConfig = {
  renderContent?: ReactNode;
};

type IMockDialogInstance = {
  close: () => Promise<void>;
};

const mockDialogShow = jest.fn<
  IMockDialogInstance,
  [config: IMockDialogConfig]
>();
const mockPaymentMethodDialogClose = jest.fn(async () => undefined);
const mockGetPrimeInfiniPaymentEntryGuard = jest.fn<
  Promise<IPrimeInfiniPaymentEntryGuard>,
  []
>();
const mockPurchaseByCrypto = jest.fn(async () => undefined);
const mockPurchasePackageWeb = jest.fn(async () => undefined);
const mockGooglePlayIsAvailable = jest.fn(async () => false);
const mockPlatformEnv = {
  isNativeAndroid: false,
  isNativeAndroidGooglePlay: false,
  isNativeIOS: false,
};
const mockListItem = jest.fn<
  null,
  [
    props: {
      subtitle?: string;
      testID?: string;
    },
  ]
>(() => null);
const mockShowPrimeInfiniPaymentErrorToast = jest.fn();
const mockLogPrimeInfiniPaymentFlow = jest.fn();

jest.mock('react-intl', () => ({
  useIntl: () => ({
    locale: 'en-US',
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/components', () => {
  function Passthrough({ children }: { children?: ReactNode }) {
    return children ?? null;
  }
  return {
    Dialog: {
      show: (config: IMockDialogConfig) => mockDialogShow(config),
    },
    Skeleton: () => null,
    Stack: Passthrough,
    YStack: Passthrough,
  };
});

jest.mock('@onekeyhq/kit/src/components/ListItem', () => ({
  ListItem: (props: { subtitle?: string; testID?: string }) =>
    mockListItem(props),
}));

jest.mock('@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth', () => ({
  useOneKeyAuth: () => ({
    supabaseUser: {
      email: 'user@example.com',
    },
    user: {
      onekeyUserId: 'user-1',
    },
  }),
}));

jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: () => ({
    result: undefined,
  }),
}));

jest.mock('@onekeyhq/shared/src/googlePlayService/googlePlayService', () => ({
  __esModule: true,
  default: {
    isAvailable: () => mockGooglePlayIsAvailable(),
  },
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    prime: {
      subscription: {
        primeSubscribeIntent: jest.fn(),
      },
    },
  },
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    get isNativeAndroid() {
      return mockPlatformEnv.isNativeAndroid;
    },
    get isNativeAndroidGooglePlay() {
      return mockPlatformEnv.isNativeAndroidGooglePlay;
    },
    get isNativeIOS() {
      return mockPlatformEnv.isNativeIOS;
    },
  },
}));

jest.mock('../../hooks/primeInfiniExternalCheckoutGuard', () => ({
  getPrimeInfiniPaymentEntryGuard: () => mockGetPrimeInfiniPaymentEntryGuard(),
}));

jest.mock('../../hooks/usePrimeInfiniPurchase', () => ({
  usePrimeInfiniPurchase: () => ({
    purchaseByCrypto: mockPurchaseByCrypto,
  }),
}));

jest.mock('../../hooks/usePrimePayment', () => ({
  usePrimePayment: () => ({
    purchasePackageWeb: mockPurchasePackageWeb,
  }),
}));

jest.mock('../../primeInfiniPaymentLogger', () => ({
  logPrimeInfiniPaymentFlow: (...args: unknown[]) => {
    mockLogPrimeInfiniPaymentFlow(...args);
  },
}));

jest.mock('../../primeInfiniPaymentError', () => ({
  showPrimeInfiniPaymentErrorToast: (...args: unknown[]) => {
    mockShowPrimeInfiniPaymentErrorToast(...args);
  },
}));

jest.mock('../../primePurchaseEligibility', () => ({
  ensurePrimePurchaseEligible: jest.fn(async () => true),
}));

jest.mock('../../primeSubscriptionPurchaseSuccess', () => ({
  finishPrimeSubscriptionPurchaseSuccess: jest.fn(async () => undefined),
  preparePrimeSubscriptionPurchaseSuccess: jest.fn(async () => undefined),
}));

jest.mock('./PrimeSubscriptionPlans', () => ({
  PrimeSubscriptionPlans: () => null,
}));

jest.mock('./usePurchasePackageWebview', () => ({
  usePurchasePackageWebview: () => jest.fn(async () => undefined),
}));

type IPaymentMethodDialogContent = ReactElement<{
  children: ReactElement<{
    freeTrial?: {
      periodIso: string;
      periodNumber: number;
      periodUnit: 'day' | 'week' | 'month' | 'year';
      source: 'native' | 'web';
    };
    onSelect: (method: 'webStripe' | 'crypto') => Promise<boolean>;
  }>;
}>;

describe('usePrimePurchaseCallback pending payment entry guard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPlatformEnv.isNativeAndroid = false;
    mockPlatformEnv.isNativeAndroidGooglePlay = false;
    mockPlatformEnv.isNativeIOS = false;
    mockGooglePlayIsAvailable.mockResolvedValue(false);
    mockDialogShow.mockReturnValue({
      close: mockPaymentMethodDialogClose,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('resumes the crypto flow before showing payment methods', async () => {
    mockGetPrimeInfiniPaymentEntryGuard.mockResolvedValue({
      isLoggedIn: true,
      hasPendingPayment: true,
      onekeyUserId: 'user-1',
    });
    const onPurchase = jest.fn(async () => undefined);
    const { result } = renderHook(() =>
      usePrimePurchaseCallback({ onPurchase }),
    );

    await act(async () => {
      await result.current.purchase({
        selectedSubscriptionPeriod: 'P1Y',
      });
    });

    expect(onPurchase).toHaveBeenCalledTimes(1);
    expect(mockPurchaseByCrypto).toHaveBeenCalledWith({
      selectedSubscriptionPeriod: 'P1Y',
      featureName: undefined,
    });
    expect(mockDialogShow).not.toHaveBeenCalled();
  });

  it('shows payment methods when no blocking payment exists', async () => {
    mockGetPrimeInfiniPaymentEntryGuard.mockResolvedValue({
      isLoggedIn: true,
      hasPendingPayment: false,
      onekeyUserId: 'user-1',
    });
    const { result } = renderHook(() => usePrimePurchaseCallback());
    const freeTrial = {
      periodIso: 'P3D',
      periodNumber: 3,
      periodUnit: 'day' as const,
      source: 'web' as const,
    };

    await act(async () => {
      await result.current.purchase({
        selectedSubscriptionPeriod: 'P1M',
        freeTrial,
      });
    });

    expect(mockDialogShow).toHaveBeenCalledTimes(1);
    expect(mockPurchaseByCrypto).not.toHaveBeenCalled();
    const dialogConfig = mockDialogShow.mock.calls[0][0] as {
      renderContent: IPaymentMethodDialogContent;
    };
    expect(dialogConfig.renderContent.props.children.props.freeTrial).toEqual(
      freeTrial,
    );
    render(dialogConfig.renderContent);
    expect(mockListItem).toHaveBeenCalledTimes(2);
    expect(
      mockListItem.mock.calls.find(
        ([props]) => props.testID === 'prime-pay-with-card',
      )?.[0].subtitle,
    ).toBe(ETranslations.prime_free_trial_included_days__desc);
    expect(
      mockListItem.mock.calls.find(
        ([props]) => props.testID === 'prime-pay-with-crypto',
      )?.[0].subtitle,
    ).toBe(ETranslations.prime_no_free_trial__desc);
  });

  it.each([
    {
      source: 'native' as const,
      trialMethodTestID: 'prime-payment-method-native',
      methodWithoutTrialTestID: 'prime-payment-method-webview',
    },
    {
      source: 'web' as const,
      trialMethodTestID: 'prime-payment-method-webview',
      methodWithoutTrialTestID: 'prime-payment-method-native',
    },
  ])(
    'shows a $source trial only on its matching Android payment method',
    async ({ source, trialMethodTestID, methodWithoutTrialTestID }) => {
      mockPlatformEnv.isNativeAndroid = true;
      mockGooglePlayIsAvailable.mockResolvedValue(true);
      mockGetPrimeInfiniPaymentEntryGuard.mockResolvedValue({
        isLoggedIn: true,
        hasPendingPayment: false,
        onekeyUserId: 'user-1',
      });
      const { result } = renderHook(() => usePrimePurchaseCallback());

      await act(async () => {
        await result.current.purchase({
          selectedSubscriptionPeriod: 'P1M',
          freeTrial: {
            periodIso: 'P3D',
            periodNumber: 3,
            periodUnit: 'day',
            source,
          },
        });
      });

      const dialogConfig = mockDialogShow.mock.calls[0][0] as {
        renderContent: IPaymentMethodDialogContent;
      };
      render(dialogConfig.renderContent);

      expect(
        mockListItem.mock.calls.find(
          ([props]) => props.testID === trialMethodTestID,
        )?.[0].subtitle,
      ).toBe(ETranslations.prime_free_trial_included_days__desc);
      expect(
        mockListItem.mock.calls.find(
          ([props]) => props.testID === methodWithoutTrialTestID,
        )?.[0].subtitle,
      ).toBeUndefined();
      expect(
        mockListItem.mock.calls.find(
          ([props]) => props.testID === 'prime-pay-with-crypto',
        )?.[0].subtitle,
      ).toBe(ETranslations.prime_no_free_trial__desc);
    },
  );

  it('blocks the purchase with a visible error when the guard request fails', async () => {
    const error = new Error('network down');
    mockGetPrimeInfiniPaymentEntryGuard.mockRejectedValue(error);
    const onPurchase = jest.fn(async () => undefined);
    const { result } = renderHook(() =>
      usePrimePurchaseCallback({ onPurchase }),
    );

    await act(async () => {
      await expect(
        result.current.purchase({
          selectedSubscriptionPeriod: 'P1Y',
        }),
      ).rejects.toBe(error);
    });

    expect(mockShowPrimeInfiniPaymentErrorToast).toHaveBeenCalledWith({
      error,
      fallbackMessage: 'global.failed',
    });
    expect(mockLogPrimeInfiniPaymentFlow).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: 'paymentEntryGuardFailed',
        error,
      }),
    );
    expect(mockDialogShow).not.toHaveBeenCalled();
    expect(mockPurchaseByCrypto).not.toHaveBeenCalled();
    expect(mockPurchasePackageWeb).not.toHaveBeenCalled();
    expect(onPurchase).not.toHaveBeenCalled();
  });

  it('surfaces a crypto payment launch error from the method picker', async () => {
    const error = new Error('wallet page failed');
    mockGetPrimeInfiniPaymentEntryGuard.mockResolvedValue({
      isLoggedIn: true,
      hasPendingPayment: false,
      onekeyUserId: 'user-1',
    });
    mockPurchaseByCrypto.mockRejectedValueOnce(error);
    const { result } = renderHook(() => usePrimePurchaseCallback());

    await act(async () => {
      await result.current.purchase({
        selectedSubscriptionPeriod: 'P1Y',
      });
    });

    const dialogConfig = mockDialogShow.mock.calls[0][0] as {
      renderContent: IPaymentMethodDialogContent;
    };
    const paymentMethodItems = dialogConfig.renderContent.props.children;

    await expect(paymentMethodItems.props.onSelect('crypto')).rejects.toBe(
      error,
    );
    expect(mockPurchaseByCrypto).toHaveBeenCalledTimes(1);
    expect(mockShowPrimeInfiniPaymentErrorToast).toHaveBeenCalledWith({
      error,
      fallbackMessage: 'global.failed',
    });
  });

  it('reroutes a payment method selection when a payment starts while the picker is open', async () => {
    mockGetPrimeInfiniPaymentEntryGuard
      .mockResolvedValueOnce({
        isLoggedIn: true,
        hasPendingPayment: false,
        onekeyUserId: 'user-1',
      })
      .mockResolvedValueOnce({
        isLoggedIn: true,
        hasPendingPayment: true,
        onekeyUserId: 'user-1',
      });
    const { result } = renderHook(() => usePrimePurchaseCallback());

    await act(async () => {
      await result.current.purchase({
        selectedSubscriptionPeriod: 'P1Y',
      });
    });

    const dialogConfig = mockDialogShow.mock.calls[0][0] as {
      renderContent: IPaymentMethodDialogContent;
    };
    const paymentMethodItems = dialogConfig.renderContent.props.children;

    await act(async () => {
      await paymentMethodItems.props.onSelect('webStripe');
    });

    expect(mockPaymentMethodDialogClose).toHaveBeenCalledTimes(1);
    expect(mockPurchaseByCrypto).toHaveBeenCalledWith({
      selectedSubscriptionPeriod: 'P1Y',
      featureName: undefined,
    });
    expect(mockPurchasePackageWeb).not.toHaveBeenCalled();
  });
});

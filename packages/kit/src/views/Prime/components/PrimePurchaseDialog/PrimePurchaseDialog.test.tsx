/** @jest-environment jsdom */
/* cspell:ignore Infini */

import type { ReactElement, ReactNode } from 'react';

import { act, cleanup, render, renderHook } from '@testing-library/react';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IPrimeInfiniPendingPaymentSession } from '@onekeyhq/shared/types/prime/primeTypes';

import {
  PrimePurchaseDialog,
  usePrimePurchaseCallback,
} from './PrimePurchaseDialog';

type IPrimeInfiniPaymentEntryGuard = {
  isLoggedIn: boolean;
  hasPendingPayment: boolean;
  onekeyUserId: string | undefined;
  pendingSubscriptionPeriod?: 'P1M' | 'P1Y';
};

type IMockDialogConfig = {
  title?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  onClose?: () => void;
  renderContent?: ReactNode;
};

type IMockDialogInstance = {
  close: () => Promise<void>;
};

type IMockDialogFooterProps = {
  confirmButtonProps?: {
    disabled?: boolean;
  };
  onConfirm?: () => Promise<void> | undefined;
};

const mockDialogShow = jest.fn<
  IMockDialogInstance,
  [config: IMockDialogConfig]
>();
const mockDialogFooter = jest.fn<null, [props: IMockDialogFooterProps]>(
  () => null,
);
const mockPaymentMethodDialogClose = jest.fn(async () => undefined);
const mockGetPrimeInfiniPaymentEntryGuard = jest.fn<
  Promise<IPrimeInfiniPaymentEntryGuard>,
  []
>();
const mockPurchaseByCrypto = jest.fn(async () => undefined);
const mockShowPrimeInfiniWaitingDialog = jest.fn<void, unknown[]>();
const mockPurchasePackageNative = jest.fn(async () => undefined);
const mockPendingSession: IPrimeInfiniPendingPaymentSession = {
  schemaVersion: 2,
  asset: {
    key: 'ETHEREUM:USDC:evm--1:0xa0b8',
    chain: 'ETHEREUM',
    token: 'USDC',
    networkId: 'evm--1',
    contractAddress: '0xa0b8',
  },
  baseline: { onekeyUserId: 'user-1', wasPrimeActive: false },
  plan: 'monthly',
  selectedSubscriptionPeriod: 'P1M',
  payerAccountId: 'account-1',
  payerAddress: '0xpayer',
  paymentCacheKey: {
    bindingId: 'binding-1',
    paymentId: 'payment-1',
    networkId: 'evm--1',
    contractAddress: '0xa0b8',
    onekeyUserId: 'user-1',
    plan: 'monthly',
    payerAccountId: 'account-1',
    payerAddress: '0xpayer',
  },
  payment: {
    paymentId: 'payment-1',
    address: '0xrecipient',
    chain: 'ETHEREUM',
    token: 'USDC',
    amountDue: '29.99',
    amountConfirmed: '29.99',
    status: 'confirmed',
    expiresAt: Date.now() + 60_000,
  },
  sendStarted: true,
  updatedAt: Date.now(),
};
const mockGetPrimeInfiniPendingPaymentContext = jest.fn<
  Promise<{
    isLoggedIn: boolean;
    onekeyUserId: string | undefined;
    pendingPaymentSession: IPrimeInfiniPendingPaymentSession | undefined;
  }>,
  []
>();
const mockGetLocalUserInfo = jest.fn<
  Promise<{ isLoggedIn: boolean; onekeyUserId: string }>,
  []
>();
const mockSupersedePaymentSession = jest.fn<
  Promise<IPrimeInfiniPendingPaymentSession | undefined>,
  [
    params: {
      onekeyUserId: string;
      expectedPaymentCacheIdentity: IPrimeInfiniPendingPaymentSession['paymentCacheKey'];
      latestPayment: IPrimeInfiniPendingPaymentSession['payment'];
    },
  ]
>();
let mockPendingChoice: 'replace' | 'resume' | 'cancel' = 'resume';
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
      onPress?: () => Promise<void>;
      subtitle?: string;
      testID?: string;
    },
  ]
>(() => null);
const mockShowPrimeInfiniPaymentErrorToast = jest.fn();
const mockLogPrimeInfiniPaymentFlow = jest.fn();
let mockPackagesResult:
  | {
      currencyCode?: string;
      freeTrial?: {
        periodIso: string;
        periodNumber: number;
        periodUnit: 'day' | 'week' | 'month' | 'year';
        source: 'native' | 'web';
      };
      subscriptionPeriod: 'P1M' | 'P1Y';
    }[]
  | undefined;

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    servicePrime: { getLocalUserInfo: () => mockGetLocalUserInfo() },
    simpleDb: {
      prime: {
        supersedeInfiniPendingPaymentSession: (
          ...args: Parameters<typeof mockSupersedePaymentSession>
        ) => mockSupersedePaymentSession(...args),
      },
    },
  },
}));

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
      Footer: (props: IMockDialogFooterProps) => mockDialogFooter(props),
    },
    Skeleton: () => null,
    Stack: Passthrough,
    YStack: Passthrough,
  };
});

jest.mock('@onekeyhq/kit/src/components/ListItem', () => ({
  ListItem: (props: {
    onPress?: () => Promise<void>;
    subtitle?: string;
    testID?: string;
  }) => mockListItem(props),
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
    result: mockPackagesResult,
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
  getPrimeInfiniPendingPaymentContext: () =>
    mockGetPrimeInfiniPendingPaymentContext(),
}));

jest.mock('../../hooks/usePrimeInfiniPurchase', () => ({
  usePrimeInfiniPurchase: () => ({
    purchaseByCrypto: mockPurchaseByCrypto,
  }),
}));

jest.mock('../PrimeInfiniWaitingDialog', () => ({
  showPrimeInfiniWaitingDialog: (...args: unknown[]) =>
    mockShowPrimeInfiniWaitingDialog(...args),
}));

jest.mock('../../hooks/usePrimePayment', () => ({
  usePrimePayment: () => ({
    purchasePackageWeb: mockPurchasePackageWeb,
    purchasePackageNative: mockPurchasePackageNative,
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
    mockPackagesResult = undefined;
    mockGooglePlayIsAvailable.mockResolvedValue(false);
    mockPendingChoice = 'resume';
    mockGetPrimeInfiniPendingPaymentContext.mockResolvedValue({
      isLoggedIn: true,
      onekeyUserId: 'user-1',
      pendingPaymentSession: mockPendingSession,
    });
    mockGetLocalUserInfo.mockResolvedValue({
      isLoggedIn: true,
      onekeyUserId: 'user-1',
    });
    mockSupersedePaymentSession.mockResolvedValue(mockPendingSession);
    mockDialogShow.mockImplementation((config) => {
      if (config.title === ETranslations.prime_unfinished_payment__title) {
        if (mockPendingChoice === 'replace') config.onConfirm?.();
        if (mockPendingChoice === 'resume') config.onCancel?.();
        config.onClose?.();
      }
      return { close: mockPaymentMethodDialogClose };
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('resumes the crypto flow when the user chooses to keep waiting', async () => {
    mockGetPrimeInfiniPaymentEntryGuard.mockResolvedValue({
      isLoggedIn: true,
      hasPendingPayment: true,
      onekeyUserId: 'user-1',
      pendingSubscriptionPeriod: 'P1M',
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
      selectedSubscriptionPeriod: 'P1M',
      featureName: undefined,
      createNewPayment: false,
    });
    expect(mockDialogShow).toHaveBeenCalledTimes(1);
    expect(mockSupersedePaymentSession).not.toHaveBeenCalled();
  });

  it('archives a paid but unresolved invoice and opens payment methods after explicit consent', async () => {
    mockPendingChoice = 'replace';
    mockGetPrimeInfiniPaymentEntryGuard.mockResolvedValue({
      isLoggedIn: true,
      hasPendingPayment: true,
      onekeyUserId: 'user-1',
    });
    const { result } = renderHook(() => usePrimePurchaseCallback());
    await act(async () => {
      await result.current.purchase({ selectedSubscriptionPeriod: 'P1Y' });
    });
    expect(mockSupersedePaymentSession).toHaveBeenCalledWith({
      onekeyUserId: 'user-1',
      expectedPaymentCacheIdentity: mockPendingSession.paymentCacheKey,
      latestPayment: mockPendingSession.payment,
    });
    expect(mockDialogShow).toHaveBeenCalledTimes(2);
    expect(mockDialogShow.mock.calls[1][0].renderContent).toBeDefined();
    expect(mockPurchaseByCrypto).not.toHaveBeenCalled();
  });

  it('offers a new purchase from the stored order when the entry refresh fails', async () => {
    mockPendingChoice = 'replace';
    mockGetPrimeInfiniPaymentEntryGuard.mockRejectedValueOnce(
      new Error('invoice unavailable'),
    );
    const { result } = renderHook(() => usePrimePurchaseCallback());
    await act(async () => {
      await result.current.purchase({ selectedSubscriptionPeriod: 'P1M' });
    });
    expect(mockSupersedePaymentSession).toHaveBeenCalledTimes(1);
    expect(mockDialogShow).toHaveBeenCalledTimes(2);
    expect(mockShowPrimeInfiniPaymentErrorToast).not.toHaveBeenCalled();
  });

  it.each([false, true])(
    'restores Google Play crypto payments in the waiting dialog (refresh failed: %s)',
    async (refreshFailed) => {
      mockPlatformEnv.isNativeAndroidGooglePlay = true;
      if (refreshFailed) {
        mockGetPrimeInfiniPaymentEntryGuard.mockRejectedValueOnce(
          new Error('invoice unavailable'),
        );
      } else {
        mockGetPrimeInfiniPaymentEntryGuard.mockResolvedValue({
          isLoggedIn: true,
          hasPendingPayment: true,
          onekeyUserId: 'user-1',
          pendingSubscriptionPeriod: 'P1M',
        });
      }
      const onPurchase = jest.fn(async () => undefined);
      const { result } = renderHook(() =>
        usePrimePurchaseCallback({ onPurchase }),
      );

      await act(async () => {
        await result.current.purchase({ selectedSubscriptionPeriod: 'P1Y' });
      });

      expect(onPurchase).toHaveBeenCalledTimes(1);
      expect(mockShowPrimeInfiniWaitingDialog).toHaveBeenCalledWith({
        context: {
          checkoutType: 'internalWallet',
          session: { ...mockPendingSession, featureName: undefined },
        },
      });
      expect(mockPurchaseByCrypto).not.toHaveBeenCalled();
      expect(mockPurchasePackageNative).not.toHaveBeenCalled();
      expect(mockPurchasePackageWeb).not.toHaveBeenCalled();
      expect(mockSupersedePaymentSession).not.toHaveBeenCalled();
    },
  );

  it('keeps the iOS pending-payment cancel action without opening crypto recovery', async () => {
    mockPlatformEnv.isNativeIOS = true;
    mockGetPrimeInfiniPaymentEntryGuard.mockResolvedValue({
      isLoggedIn: true,
      hasPendingPayment: true,
      onekeyUserId: 'user-1',
    });
    const { result } = renderHook(() => usePrimePurchaseCallback());
    await act(async () => {
      await result.current.purchase({ selectedSubscriptionPeriod: 'P1Y' });
    });
    expect(mockShowPrimeInfiniWaitingDialog).not.toHaveBeenCalled();
    expect(mockPurchaseByCrypto).not.toHaveBeenCalled();
    expect(mockPurchasePackageNative).not.toHaveBeenCalled();
    expect(mockSupersedePaymentSession).not.toHaveBeenCalled();
  });

  it('continues to Google Play after consent without opening the unsupported crypto page', async () => {
    mockPendingChoice = 'replace';
    mockPlatformEnv.isNativeAndroidGooglePlay = true;
    mockGetPrimeInfiniPaymentEntryGuard.mockResolvedValue({
      isLoggedIn: true,
      hasPendingPayment: true,
      onekeyUserId: 'user-1',
    });
    const { result } = renderHook(() => usePrimePurchaseCallback());
    await act(async () => {
      await result.current.purchase({ selectedSubscriptionPeriod: 'P1Y' });
    });
    expect(mockSupersedePaymentSession).toHaveBeenCalledTimes(1);
    expect(mockPurchasePackageNative).toHaveBeenCalledWith({
      subscriptionPeriod: 'P1Y',
      featureName: undefined,
    });
    expect(mockPurchaseByCrypto).not.toHaveBeenCalled();
  });

  it('leaves the stored order alone when the warning is dismissed', async () => {
    mockPendingChoice = 'cancel';
    mockGetPrimeInfiniPaymentEntryGuard.mockResolvedValue({
      isLoggedIn: true,
      hasPendingPayment: true,
      onekeyUserId: 'user-1',
    });
    const { result } = renderHook(() => usePrimePurchaseCallback());
    await act(async () => {
      await result.current.purchase({ selectedSubscriptionPeriod: 'P1M' });
    });
    expect(mockSupersedePaymentSession).not.toHaveBeenCalled();
    expect(mockPurchaseByCrypto).not.toHaveBeenCalled();
    expect(mockDialogShow).toHaveBeenCalledTimes(1);
  });

  it('does not apply consent to a different signed-in user', async () => {
    mockPendingChoice = 'replace';
    mockGetPrimeInfiniPaymentEntryGuard.mockResolvedValue({
      isLoggedIn: true,
      hasPendingPayment: true,
      onekeyUserId: 'user-1',
    });
    mockGetLocalUserInfo.mockResolvedValueOnce({
      isLoggedIn: true,
      onekeyUserId: 'user-2',
    });
    const { result } = renderHook(() => usePrimePurchaseCallback());
    await act(async () => {
      await expect(
        result.current.purchase({ selectedSubscriptionPeriod: 'P1M' }),
      ).rejects.toThrow('Infini purchase user changed');
    });
    expect(mockSupersedePaymentSession).not.toHaveBeenCalled();
    expect(mockDialogShow).toHaveBeenCalledTimes(1);
  });

  it.each(['changed', 'storage failure'] as const)(
    'does not lose the old order when archival reports %s',
    async (failure) => {
      mockPendingChoice = 'replace';
      mockGetPrimeInfiniPaymentEntryGuard.mockResolvedValue({
        isLoggedIn: true,
        hasPendingPayment: true,
        onekeyUserId: 'user-1',
      });
      if (failure === 'changed')
        mockSupersedePaymentSession.mockResolvedValueOnce(undefined);
      else
        mockSupersedePaymentSession.mockRejectedValueOnce(
          new Error('storage failure'),
        );
      const { result } = renderHook(() => usePrimePurchaseCallback());
      await act(async () => {
        await expect(
          result.current.purchase({ selectedSubscriptionPeriod: 'P1M' }),
        ).rejects.toThrow();
      });
      expect(mockDialogShow).toHaveBeenCalledTimes(1);
      expect(mockPurchaseByCrypto).not.toHaveBeenCalled();
    },
  );

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
      name: 'an empty package list',
      packages: [],
    },
    {
      name: 'no package for the default yearly period',
      packages: [
        {
          subscriptionPeriod: 'P1M' as const,
          currencyCode: 'USD',
        },
      ],
    },
  ])('disables purchase for $name', async ({ packages }) => {
    mockPackagesResult = packages;

    render(<PrimePurchaseDialog onPurchase={jest.fn(async () => undefined)} />);

    const footerProps =
      mockDialogFooter.mock.calls[mockDialogFooter.mock.calls.length - 1][0];
    expect(footerProps.confirmButtonProps?.disabled).toBe(true);

    await act(async () => {
      await footerProps.onConfirm?.();
    });

    expect(mockGetPrimeInfiniPaymentEntryGuard).not.toHaveBeenCalled();
    expect(mockDialogShow).not.toHaveBeenCalled();
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
    mockGetPrimeInfiniPendingPaymentContext.mockResolvedValueOnce({
      isLoggedIn: true,
      onekeyUserId: 'user-1',
      pendingPaymentSession: undefined,
    });
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
      createNewPayment: false,
    });
    expect(mockPurchasePackageWeb).not.toHaveBeenCalled();
  });

  it('starts a payment method only once for same-tick presses', async () => {
    mockGetPrimeInfiniPaymentEntryGuard.mockResolvedValue({
      isLoggedIn: true,
      hasPendingPayment: false,
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
    render(dialogConfig.renderContent);
    const cardMethod = mockListItem.mock.calls.find(
      ([props]) => props.testID === 'prime-pay-with-card',
    )?.[0];
    expect(cardMethod?.onPress).toBeDefined();

    await act(async () => {
      const firstPress = cardMethod?.onPress?.();
      const secondPress = cardMethod?.onPress?.();
      await Promise.all([firstPress, secondPress]);
    });

    expect(mockPaymentMethodDialogClose).toHaveBeenCalledTimes(1);
    expect(mockPurchasePackageWeb).toHaveBeenCalledTimes(1);
  });
});

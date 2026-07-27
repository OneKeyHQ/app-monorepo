/** @jest-environment jsdom */
/* cspell:ignore Infini */

import type { ReactElement, ReactNode } from 'react';

import { act, cleanup, renderHook } from '@testing-library/react';

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
  ListItem: () => null,
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
    isAvailable: jest.fn(async () => false),
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
    isNativeAndroid: false,
    isNativeAndroidGooglePlay: false,
    isNativeIOS: false,
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
  logPrimeInfiniPaymentFlow: jest.fn(),
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
    onSelect: (method: 'webStripe') => Promise<boolean>;
  }>;
}>;

describe('usePrimePurchaseCallback pending payment entry guard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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

    await act(async () => {
      await result.current.purchase({
        selectedSubscriptionPeriod: 'P1M',
      });
    });

    expect(mockDialogShow).toHaveBeenCalledTimes(1);
    expect(mockPurchaseByCrypto).not.toHaveBeenCalled();
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

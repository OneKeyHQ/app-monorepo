/** @jest-environment jsdom */
/* cspell:ignore Infini */
/* eslint-disable @typescript-eslint/no-unsafe-return */

import { act, cleanup, renderHook } from '@testing-library/react';

import { EModalRoutes } from '@onekeyhq/shared/src/routes/modal';
import { EPrimePages } from '@onekeyhq/shared/src/routes/prime';

import {
  isPrimeInfiniExternalCheckoutInFlight,
  usePrimeInfiniPurchase,
} from './usePrimeInfiniPurchase';

const mockPush = jest.fn();
const mockPushModal = jest.fn();
const mockIsLoggedIn = jest.fn<Promise<boolean>, []>();
const mockApiGetInfiniPurchaseStatusSnapshot = jest.fn();
const mockApiGetInfiniCheckoutUrl = jest.fn();
const mockGetPrimeInfiniExternalCheckoutGuard = jest.fn();

jest.mock('react-intl', () => ({
  useIntl: () => ({
    locale: 'en-US',
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/components', () => ({
  Toast: {
    error: jest.fn(),
    message: jest.fn(),
  },
}));

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    servicePrime: {
      isLoggedIn: () => mockIsLoggedIn(),
      apiGetInfiniPurchaseStatusSnapshot: (...args: unknown[]) =>
        mockApiGetInfiniPurchaseStatusSnapshot(...args),
      apiGetInfiniCheckoutUrl: (...args: unknown[]) =>
        mockApiGetInfiniCheckoutUrl(...args),
    },
  },
}));

jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({
    push: mockPush,
    pushModal: mockPushModal,
  }),
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  usePrimePersistAtom: () => [{}],
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    prime: {
      subscription: {
        primeCryptoPaymentFlow: jest.fn(),
        primeSubscribeIntent: jest.fn(),
      },
    },
  },
}));

jest.mock('@onekeyhq/shared/src/utils/openUrlUtils', () => ({
  __esModule: true,
  default: {
    openUrlExternal: jest.fn(),
  },
}));

jest.mock('../components/PrimeInfiniWaitingDialog', () => ({
  showPrimeInfiniWaitingDialog: jest.fn(),
}));

jest.mock('./primeInfiniExternalCheckoutGuard', () => ({
  getPrimeInfiniExternalCheckoutGuard: (...args: unknown[]) =>
    mockGetPrimeInfiniExternalCheckoutGuard(...args),
}));

describe('usePrimeInfiniPurchase internal wallet route', () => {
  afterEach(() => {
    cleanup();
    jest.clearAllMocks();
  });

  it('opens the Prime payment route in a separate modal', async () => {
    mockIsLoggedIn.mockResolvedValue(true);
    const { result } = renderHook(() => usePrimeInfiniPurchase());

    await act(async () => {
      await result.current.purchaseByCrypto({
        selectedSubscriptionPeriod: 'P1Y',
      });
    });

    expect(mockPush).not.toHaveBeenCalled();
    expect(mockPushModal).toHaveBeenCalledTimes(1);
    expect(mockPushModal).toHaveBeenCalledWith(EModalRoutes.PrimeModal, {
      screen: EPrimePages.PrimeInfiniPayment,
      params: {
        selectedSubscriptionPeriod: 'P1Y',
        featureName: undefined,
        createNewPayment: true,
      },
    });
  });

  it('does not push the payment page when the Prime session is logged out', async () => {
    mockIsLoggedIn.mockResolvedValue(false);
    const { result } = renderHook(() => usePrimeInfiniPurchase());

    await act(async () => {
      await result.current.purchaseByCrypto({
        selectedSubscriptionPeriod: 'P1M',
      });
    });

    expect(mockPushModal).not.toHaveBeenCalled();
  });

  it('reports that external checkout did not open when logged out', async () => {
    mockIsLoggedIn.mockResolvedValue(false);
    const { result } = renderHook(() => usePrimeInfiniPurchase());
    let didOpenCheckout: boolean | undefined;

    await act(async () => {
      didOpenCheckout = await result.current.purchaseByExternalCheckout({
        selectedSubscriptionPeriod: 'P1M',
      });
    });

    expect(didOpenCheckout).toBe(false);
  });

  it('holds the shared external guard while retiring a prepared payment', async () => {
    mockIsLoggedIn.mockResolvedValue(true);
    const beforeCheckout = jest.fn(async () => {
      expect(isPrimeInfiniExternalCheckoutInFlight()).toBe(true);
      return false;
    });
    const { result } = renderHook(() => usePrimeInfiniPurchase());
    let didOpenCheckout: boolean | undefined;

    await act(async () => {
      didOpenCheckout = await result.current.purchaseByExternalCheckout({
        selectedSubscriptionPeriod: 'P1M',
        beforeCheckout,
      });
    });

    expect(beforeCheckout).toHaveBeenCalledTimes(1);
    expect(didOpenCheckout).toBe(false);
    expect(isPrimeInfiniExternalCheckoutInFlight()).toBe(false);
  });

  it('blocks external checkout when the fresh server snapshot is already Prime', async () => {
    mockIsLoggedIn.mockResolvedValue(true);
    mockGetPrimeInfiniExternalCheckoutGuard.mockResolvedValue({
      isLoggedIn: true,
      hasPendingPayment: false,
      onekeyUserId: 'user-1',
    });
    mockApiGetInfiniPurchaseStatusSnapshot.mockResolvedValue({
      onekeyUserId: 'user-1',
      primeSubscription: {
        isActive: true,
      },
    });
    const { result } = renderHook(() => usePrimeInfiniPurchase());
    let didOpenCheckout: boolean | undefined;

    await act(async () => {
      didOpenCheckout = await result.current.purchaseByExternalCheckout({
        selectedSubscriptionPeriod: 'P1M',
      });
    });

    expect(didOpenCheckout).toBe(false);
    expect(mockApiGetInfiniCheckoutUrl).not.toHaveBeenCalled();
  });

  it('deduplicates concurrent attempts while login verification is pending', async () => {
    let resolveLogin: ((isLoggedIn: boolean) => void) | undefined;
    mockIsLoggedIn.mockReturnValue(
      new Promise<boolean>((resolve) => {
        resolveLogin = resolve;
      }),
    );
    const { result } = renderHook(() => usePrimeInfiniPurchase());

    await act(async () => {
      const firstAttempt = result.current.purchaseByCrypto({
        selectedSubscriptionPeriod: 'P1Y',
      });
      const secondAttempt = result.current.purchaseByCrypto({
        selectedSubscriptionPeriod: 'P1Y',
      });
      resolveLogin?.(true);
      await Promise.all([firstAttempt, secondAttempt]);
    });

    expect(mockPushModal).toHaveBeenCalledTimes(1);
  });
});

/** @jest-environment jsdom */
/* cspell:ignore Infini */
/* eslint-disable @typescript-eslint/no-unsafe-return */

import { act, cleanup, renderHook } from '@testing-library/react';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { EModalRoutes } from '@onekeyhq/shared/src/routes/modal';
import { EPrimePages } from '@onekeyhq/shared/src/routes/prime';
import { EPrimeAuthSessionSource } from '@onekeyhq/shared/types/prime/primeTypes';

import {
  isPrimeInfiniExternalCheckoutInFlight,
  usePrimeInfiniPurchase,
} from './usePrimeInfiniPurchase';

import type { showPrimeInfiniWaitingDialog } from '../components/PrimeInfiniWaitingDialog';

const mockPush = jest.fn();
const mockPushModal = jest.fn();
const mockIsLoggedIn = jest.fn<Promise<boolean>, []>();
const mockApiGetInfiniPurchaseStatusSnapshot = jest.fn();
const mockApiGetInfiniCheckoutUrl = jest.fn();
const mockGetPrimeInfiniExternalCheckoutGuard = jest.fn();
const mockOpenUrlExternal = jest.fn();
const mockShowPrimeInfiniWaitingDialog = jest.fn();
const mockCloseWaitingDialog = jest.fn();
const mockGetInfiniCheckoutAuthContext = jest.fn();
const mockIsInfiniCheckoutAuthContextCurrent = jest.fn();
const mockWaitingDelay = jest.fn();
const checkoutAuthContext = {
  onekeyUserId: 'user-1',
  authSessionSource: EPrimeAuthSessionSource.KeylessOAuth,
  authStateGeneration: 3,
};

function createDeferred<T = void>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

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
      getInfiniCheckoutAuthContext: () => mockGetInfiniCheckoutAuthContext(),
      isInfiniCheckoutAuthContextCurrent: (...args: unknown[]) =>
        mockIsInfiniCheckoutAuthContextCurrent(...args),
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
        primeCryptoPaymentError: jest.fn(),
        primeCryptoPaymentFlow: jest.fn(),
        primeSubscribeIntent: jest.fn(),
      },
    },
  },
}));

jest.mock('@onekeyhq/shared/src/utils/openUrlUtils', () => ({
  __esModule: true,
  default: {
    openUrlExternal: (...args: unknown[]) => mockOpenUrlExternal(...args),
  },
}));

jest.mock('@onekeyhq/shared/src/utils/timerUtils', () => ({
  __esModule: true,
  default: {
    ...jest.requireActual<
      typeof import('@onekeyhq/shared/src/utils/timerUtils')
    >('@onekeyhq/shared/src/utils/timerUtils').default,
    setTimeoutPromised: (...args: unknown[]) => mockWaitingDelay(...args),
  },
}));

jest.mock('../components/PrimeInfiniWaitingDialog', () => ({
  showPrimeInfiniWaitingDialog: (...args: unknown[]) =>
    mockShowPrimeInfiniWaitingDialog(...args),
}));

jest.mock('./primeInfiniExternalCheckoutGuard', () => ({
  getPrimeInfiniExternalCheckoutGuard: (...args: unknown[]) =>
    mockGetPrimeInfiniExternalCheckoutGuard(...args),
}));

describe('usePrimeInfiniPurchase internal wallet route', () => {
  beforeEach(() => {
    mockGetInfiniCheckoutAuthContext.mockResolvedValue(checkoutAuthContext);
    mockIsInfiniCheckoutAuthContextCurrent.mockResolvedValue(true);
    mockWaitingDelay.mockResolvedValue(undefined);
    mockCloseWaitingDialog.mockResolvedValue(undefined);
    mockShowPrimeInfiniWaitingDialog.mockImplementation(() => ({
      close: mockCloseWaitingDialog,
    }));
  });

  afterEach(() => {
    cleanup();
    jest.clearAllMocks();
  });

  it('opens the Prime payment route in a separate modal', async () => {
    mockIsLoggedIn.mockResolvedValue(true);
    const { result } = renderHook(() =>
      usePrimeInfiniPurchase({ networkId: 'sol--101' }),
    );

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
        flowId: expect.any(String),
        selectedSubscriptionPeriod: 'P1Y',
        featureName: undefined,
        createNewPayment: true,
        networkId: 'sol--101',
      },
    });
  });

  it('restores an existing payment without replacing it', async () => {
    mockIsLoggedIn.mockResolvedValue(true);
    const { result } = renderHook(() => usePrimeInfiniPurchase());

    await act(async () => {
      await result.current.purchaseByCrypto({
        selectedSubscriptionPeriod: 'P1M',
        createNewPayment: false,
      });
    });

    expect(mockPushModal).toHaveBeenCalledWith(EModalRoutes.PrimeModal, {
      screen: EPrimePages.PrimeInfiniPayment,
      params: expect.objectContaining({
        selectedSubscriptionPeriod: 'P1M',
        createNewPayment: false,
      }),
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

  it('propagates the original external checkout guard error', async () => {
    mockIsLoggedIn.mockResolvedValue(true);
    const originalError = new Error('Infini guard request rejected');
    mockGetPrimeInfiniExternalCheckoutGuard.mockRejectedValue(originalError);
    const { result } = renderHook(() => usePrimeInfiniPurchase());

    await expect(
      act(async () =>
        result.current.purchaseByExternalCheckout({
          selectedSubscriptionPeriod: 'P1M',
        }),
      ),
    ).rejects.toBe(originalError);
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

  it('shows the waiting dialog after closing the payment modal and before opening external checkout', async () => {
    mockIsLoggedIn.mockResolvedValue(true);
    mockGetPrimeInfiniExternalCheckoutGuard.mockResolvedValue({
      isLoggedIn: true,
      hasPendingPayment: false,
      onekeyUserId: 'user-1',
    });
    mockApiGetInfiniPurchaseStatusSnapshot.mockResolvedValue({
      onekeyUserId: 'user-1',
      primeSubscription: {
        isActive: false,
      },
      infiniSubscription: {
        subscriptionId: 'existing-subscription',
        status: 'active',
        plan: 'monthly',
      },
    });
    mockApiGetInfiniCheckoutUrl.mockResolvedValue({
      checkoutUrl: 'https://checkout.example.com/payment',
    });
    const callOrder: string[] = [];
    const beforeOpenCheckout = jest.fn(async () => {
      callOrder.push('close');
    });
    mockShowPrimeInfiniWaitingDialog.mockImplementation(() => {
      callOrder.push('waiting');
      return { close: mockCloseWaitingDialog };
    });
    mockOpenUrlExternal.mockImplementation(() => {
      callOrder.push('open');
    });
    const { result } = renderHook(() => usePrimeInfiniPurchase());

    await act(async () => {
      await result.current.purchaseByExternalCheckout({
        selectedSubscriptionPeriod: 'P1M',
        beforeOpenCheckout,
      });
    });

    expect(beforeOpenCheckout).toHaveBeenCalledTimes(1);
    expect(mockShowPrimeInfiniWaitingDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({
          baselineInfiniSubscriptionId: 'existing-subscription',
        }),
      }),
    );
    expect(mockOpenUrlExternal).toHaveBeenCalledTimes(1);
    expect(callOrder).toEqual(['close', 'waiting', 'open']);
  });

  describe('external checkout account binding', () => {
    let waitingDialogProps: Parameters<typeof showPrimeInfiniWaitingDialog>[0];

    beforeEach(() => {
      mockIsLoggedIn.mockResolvedValue(true);
      mockGetPrimeInfiniExternalCheckoutGuard.mockResolvedValue({
        isLoggedIn: true,
        hasPendingPayment: false,
        onekeyUserId: 'user-1',
      });
      mockApiGetInfiniPurchaseStatusSnapshot.mockResolvedValue({
        onekeyUserId: 'user-1',
        primeSubscription: { isActive: false },
      });
      mockApiGetInfiniCheckoutUrl.mockResolvedValue({
        checkoutUrl: 'https://checkout.example.com/user-1',
      });
      mockShowPrimeInfiniWaitingDialog.mockImplementation(
        (props: typeof waitingDialogProps) => {
          waitingDialogProps = props;
          return { close: mockCloseWaitingDialog };
        },
      );
    });

    it('pins checkout creation to the auth context captured before callbacks', async () => {
      const { result } = renderHook(() => usePrimeInfiniPurchase());
      await act(async () => {
        await result.current.purchaseByExternalCheckout({
          selectedSubscriptionPeriod: 'P1M',
        });
      });
      expect(mockApiGetInfiniCheckoutUrl).toHaveBeenCalledWith(
        expect.objectContaining({
          expectedOneKeyUserId: 'user-1',
          authContext: checkoutAuthContext,
        }),
      );
    });

    it('does not create a checkout for an account selected during the preparation callback', async () => {
      const { result } = renderHook(() => usePrimeInfiniPurchase());
      await act(async () => {
        expect(
          await result.current.purchaseByExternalCheckout({
            selectedSubscriptionPeriod: 'P1M',
            beforeCheckout: async () => {
              mockGetPrimeInfiniExternalCheckoutGuard.mockResolvedValue({
                isLoggedIn: true,
                hasPendingPayment: false,
                onekeyUserId: 'user-2',
              });
              return true;
            },
          }),
        ).toBe(false);
      });
      expect(mockApiGetInfiniCheckoutUrl).not.toHaveBeenCalled();
      expect(mockOpenUrlExternal).not.toHaveBeenCalled();
    });

    it.each(['beforeOpenCheckout', 'waitingDelay'] as const)(
      'does not open a checkout invalidated during %s',
      async (boundary) => {
        const invalidateAuth = async () => {
          mockIsInfiniCheckoutAuthContextCurrent.mockResolvedValue(false);
        };
        if (boundary === 'waitingDelay') {
          mockWaitingDelay.mockImplementationOnce(invalidateAuth);
        }
        const { result } = renderHook(() => usePrimeInfiniPurchase());
        await act(async () => {
          expect(
            await result.current.purchaseByExternalCheckout({
              selectedSubscriptionPeriod: 'P1M',
              beforeOpenCheckout:
                boundary === 'beforeOpenCheckout' ? invalidateAuth : undefined,
            }),
          ).toBe(false);
        });
        expect(mockOpenUrlExternal).not.toHaveBeenCalled();
        if (mockShowPrimeInfiniWaitingDialog.mock.calls.length) {
          expect(mockCloseWaitingDialog).toHaveBeenCalled();
        }
      },
    );

    it('cancels opening when the waiting dialog is closed during the delay', async () => {
      mockWaitingDelay.mockImplementationOnce(async () => {
        waitingDialogProps.onCloseRequested?.();
      });
      const { result } = renderHook(() => usePrimeInfiniPurchase());
      await act(async () => {
        expect(
          await result.current.purchaseByExternalCheckout({
            selectedSubscriptionPeriod: 'P1M',
          }),
        ).toBe(false);
      });
      expect(mockOpenUrlExternal).not.toHaveBeenCalled();
      expect(isPrimeInfiniExternalCheckoutInFlight()).toBe(false);
    });

    it('rechecks cancellation after the final background validation returns', async () => {
      const validationStarted = createDeferred();
      const validationResult = createDeferred<boolean>();
      mockIsInfiniCheckoutAuthContextCurrent
        .mockResolvedValueOnce(true)
        .mockImplementationOnce(() => {
          validationStarted.resolve();
          return validationResult.promise;
        });
      const { result } = renderHook(() => usePrimeInfiniPurchase());
      await act(async () => {
        const attempt = result.current.purchaseByExternalCheckout({
          selectedSubscriptionPeriod: 'P1M',
        });
        await validationStarted.promise;
        waitingDialogProps.onCloseRequested?.();
        validationResult.resolve(true);
        expect(await attempt).toBe(false);
      });
      expect(mockOpenUrlExternal).not.toHaveBeenCalled();
    });

    it('does not let a cancelled attempt release or reopen a newer checkout', async () => {
      const firstDelayStarted = createDeferred();
      const secondDelayStarted = createDeferred();
      const firstDelay = createDeferred();
      const secondDelay = createDeferred();
      mockWaitingDelay
        .mockImplementationOnce(() => {
          firstDelayStarted.resolve();
          return firstDelay.promise;
        })
        .mockImplementationOnce(() => {
          secondDelayStarted.resolve();
          return secondDelay.promise;
        });
      const { result } = renderHook(() => usePrimeInfiniPurchase());
      await act(async () => {
        const first = result.current.purchaseByExternalCheckout({
          selectedSubscriptionPeriod: 'P1M',
        });
        await firstDelayStarted.promise;
        const oldContext = waitingDialogProps.context;
        waitingDialogProps.onCloseRequested?.();
        const second = result.current.purchaseByExternalCheckout({
          selectedSubscriptionPeriod: 'P1Y',
        });
        await secondDelayStarted.promise;
        firstDelay.resolve();
        expect(await first).toBe(false);
        expect(isPrimeInfiniExternalCheckoutInFlight()).toBe(true);
        if (oldContext.checkoutType !== 'externalWallet') {
          throw new OneKeyLocalError('Expected external checkout context');
        }
        expect(await oldContext.validateCheckout()).toBe(false);
        secondDelay.resolve();
        expect(await second).toBe(true);
      });
      expect(mockOpenUrlExternal).toHaveBeenCalledTimes(1);
      expect(isPrimeInfiniExternalCheckoutInFlight()).toBe(false);
    });

    it('revalidates the captured identity when the waiting dialog reopens checkout', async () => {
      const { result } = renderHook(() => usePrimeInfiniPurchase());
      await act(async () => {
        await result.current.purchaseByExternalCheckout({
          selectedSubscriptionPeriod: 'P1M',
        });
      });
      mockIsInfiniCheckoutAuthContextCurrent.mockResolvedValue(false);
      expect(waitingDialogProps.context.checkoutType).toBe('externalWallet');
      if (waitingDialogProps.context.checkoutType !== 'externalWallet') {
        throw new OneKeyLocalError('Expected external checkout context');
      }
      expect(await waitingDialogProps.context.validateCheckout()).toBe(false);
      expect(mockCloseWaitingDialog).toHaveBeenCalled();
      mockIsInfiniCheckoutAuthContextCurrent.mockResolvedValue(true);
      expect(await waitingDialogProps.context.validateCheckout()).toBe(false);
    });
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

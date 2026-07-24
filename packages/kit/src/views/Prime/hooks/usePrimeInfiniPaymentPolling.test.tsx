/**
 * @jest-environment jsdom
 */
/* cspell:ignore Infini infini */

import { act, renderHook, waitFor } from '@testing-library/react-native';

import type { IPrimeInfiniPayment } from '@onekeyhq/shared/types/prime/primeTypes';

import { usePrimeInfiniPaymentPolling } from './usePrimeInfiniPaymentPolling';

let visibilityHandler: ((visible: boolean) => void) | undefined;
let routeFocused = true;

const globalMockBag = globalThis as typeof globalThis & {
  __primeInfiniPollingService?: {
    apiGetInfiniPayment: jest.Mock;
    apiGetInfiniPurchaseStatusSnapshot: jest.Mock;
  };
};

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => {
  const mockServicePrime = {
    apiGetInfiniPayment: jest.fn(),
    apiGetInfiniPurchaseStatusSnapshot: jest.fn(),
  };
  (globalThis as any).__primeInfiniPollingService = mockServicePrime;
  return {
    __esModule: true,
    default: { servicePrime: mockServicePrime },
  };
});

jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocused: () => routeFocused,
}));

jest.mock('@onekeyhq/shared/src/utils/appVisibility', () => ({
  getCurrentVisibilityState: () => true,
  onVisibilityStateChange: (handler: (visible: boolean) => void) => {
    visibilityHandler = handler;
    return () => undefined;
  },
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    prime: {
      subscription: {
        primeCryptoPaymentFlow: jest.fn(),
      },
    },
  },
}));

const servicePrime = globalMockBag.__primeInfiniPollingService!;

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function flushPollingMicrotasks() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function advancePollingTimers(ms: number) {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
  await flushPollingMicrotasks();
}

function buildPayment(paymentId: string): IPrimeInfiniPayment {
  return {
    paymentId,
    address: '0x1234',
    chain: 'ETHEREUM',
    token: 'USDC',
    amountDue: '29.99',
    amountConfirmed: '0',
    expiresAt: Date.now() + 60_000,
    status: 'pending',
    infiniStatus: 'created',
  };
}

const baseline = { onekeyUserId: 'user-1', wasPrimeActive: false };
const asset = {
  key: 'ETHEREUM:USDC:evm--1:0xa0b8',
  chain: 'ETHEREUM',
  token: 'USDC',
  networkId: 'evm--1',
  contractAddress: '0xa0b8',
};

describe('usePrimeInfiniPaymentPolling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    visibilityHandler = undefined;
    routeFocused = true;
    servicePrime.apiGetInfiniPurchaseStatusSnapshot.mockResolvedValue({
      onekeyUserId: baseline.onekeyUserId,
      primeSubscription: undefined,
      infiniSubscription: undefined,
    });
  });

  it('coalesces concurrent refresh signals into one follow-up request', async () => {
    const firstRequest = createDeferred<IPrimeInfiniPayment>();
    const payment = buildPayment('payment-a');
    servicePrime.apiGetInfiniPayment
      .mockReturnValueOnce(firstRequest.promise)
      .mockResolvedValue(payment);

    const { result, unmount } = renderHook(() =>
      usePrimeInfiniPaymentPolling({
        payment,
        asset,
        baseline,
        enabled: true,
        onSuccess: jest.fn(),
        onTerminal: jest.fn(),
        pollIntervalMs: 60_000,
      }),
    );

    await waitFor(() => {
      expect(servicePrime.apiGetInfiniPayment).toHaveBeenCalledTimes(1);
    });

    act(() => {
      result.current.refresh();
      result.current.refresh();
      visibilityHandler?.(true);
    });
    expect(servicePrime.apiGetInfiniPayment).toHaveBeenCalledTimes(1);

    await act(async () => {
      firstRequest.resolve(payment);
      await firstRequest.promise;
    });

    await waitFor(() => {
      expect(servicePrime.apiGetInfiniPayment).toHaveBeenCalledTimes(2);
    });
    unmount();
  });

  it('binds the purchase status snapshot to the baseline user', async () => {
    const payment = buildPayment('payment-a');
    const renewalBaseline = {
      ...baseline,
      wasPrimeActive: true,
      primeExpiresAt: Date.now() + 60_000,
      infiniPeriodEnd: Date.now() + 30_000,
    };
    servicePrime.apiGetInfiniPayment.mockResolvedValue(payment);

    const { unmount } = renderHook(() =>
      usePrimeInfiniPaymentPolling({
        payment,
        asset,
        baseline: renewalBaseline,
        enabled: true,
        onSuccess: jest.fn(),
        onTerminal: jest.fn(),
        pollIntervalMs: 60_000,
      }),
    );

    await waitFor(() => {
      expect(
        servicePrime.apiGetInfiniPurchaseStatusSnapshot,
      ).toHaveBeenCalledWith({
        expectedOneKeyUserId: renewalBaseline.onekeyUserId,
      });
    });
    unmount();
  });

  it('drops a stale response after the payment identity changes', async () => {
    const paymentA = buildPayment('payment-a');
    const paymentB = buildPayment('payment-b');
    const requestA = createDeferred<IPrimeInfiniPayment>();
    const requestB = createDeferred<IPrimeInfiniPayment>();
    servicePrime.apiGetInfiniPayment.mockImplementation(
      ({ paymentId }: { paymentId: string }) =>
        paymentId === paymentA.paymentId ? requestA.promise : requestB.promise,
    );

    const { result, rerender, unmount } = renderHook(
      ({ payment }: { payment: IPrimeInfiniPayment }) =>
        usePrimeInfiniPaymentPolling({
          payment,
          asset,
          baseline,
          enabled: true,
          onSuccess: jest.fn(),
          onTerminal: jest.fn(),
          pollIntervalMs: 60_000,
        }),
      { initialProps: { payment: paymentA } },
    );

    await waitFor(() => {
      expect(servicePrime.apiGetInfiniPayment).toHaveBeenCalledWith({
        paymentId: paymentA.paymentId,
        expectedOneKeyUserId: baseline.onekeyUserId,
      });
    });
    rerender({ payment: paymentB });
    await waitFor(() => {
      expect(servicePrime.apiGetInfiniPayment).toHaveBeenCalledWith({
        paymentId: paymentB.paymentId,
        expectedOneKeyUserId: baseline.onekeyUserId,
      });
    });

    await act(async () => {
      requestB.resolve(paymentB);
      await requestB.promise;
    });
    expect(result.current.latestPayment?.paymentId).toBe(paymentB.paymentId);

    await act(async () => {
      requestA.resolve({ ...paymentA, amountConfirmed: paymentA.amountDue });
      await requestA.promise;
    });
    expect(result.current.latestPayment?.paymentId).toBe(paymentB.paymentId);
    unmount();
  });

  it('keeps observed payment progress across a regressing query response', async () => {
    const payment = buildPayment('payment-a');
    servicePrime.apiGetInfiniPayment
      .mockResolvedValueOnce({
        ...payment,
        amountConfirming: '0.01',
      })
      .mockResolvedValue(payment);

    const { result, unmount } = renderHook(() =>
      usePrimeInfiniPaymentPolling({
        payment,
        asset,
        baseline,
        enabled: true,
        onSuccess: jest.fn(),
        onTerminal: jest.fn(),
        pollIntervalMs: 60_000,
      }),
    );

    await waitFor(() => {
      expect(result.current.latestPayment?.amountConfirming).toBe('0.01');
    });
    act(() => {
      result.current.refresh();
    });
    await waitFor(() => {
      expect(servicePrime.apiGetInfiniPayment).toHaveBeenCalledTimes(2);
      expect(result.current.latestPayment?.amountConfirming).toBe('0.01');
    });
    unmount();
  });

  it('ignores a query response that mutates frozen transfer terms', async () => {
    const payment = buildPayment('payment-a');
    const onTerminal = jest.fn();
    servicePrime.apiGetInfiniPayment.mockResolvedValue({
      ...payment,
      amountDue: '1',
      expiresAt: Date.now() - 1,
      status: 'expired',
    });

    const { result, unmount } = renderHook(() =>
      usePrimeInfiniPaymentPolling({
        payment,
        asset,
        baseline,
        enabled: true,
        onSuccess: jest.fn(),
        onTerminal,
        pollIntervalMs: 60_000,
      }),
    );

    await waitFor(() => {
      expect(result.current.hasError).toBe(true);
    });
    expect(result.current.latestPayment).toEqual(payment);
    expect(onTerminal).not.toHaveBeenCalled();
    unmount();
  });

  it('stops at confirmed subscription state and invokes success once', async () => {
    const payment = {
      ...buildPayment('payment-a'),
      amountConfirmed: '29.99',
    };
    const onSuccess = jest.fn();
    servicePrime.apiGetInfiniPayment.mockResolvedValue(payment);
    servicePrime.apiGetInfiniPurchaseStatusSnapshot.mockResolvedValue({
      onekeyUserId: baseline.onekeyUserId,
      primeSubscription: { isActive: true, expiresAt: Date.now() + 60_000 },
      infiniSubscription: undefined,
    });

    const { result, unmount } = renderHook(() =>
      usePrimeInfiniPaymentPolling({
        payment,
        asset,
        baseline,
        enabled: true,
        onSuccess,
        onTerminal: jest.fn(),
        pollIntervalMs: 60_000,
      }),
    );

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledTimes(1);
    });
    act(() => {
      result.current.refresh();
      visibilityHandler?.(true);
    });
    expect(servicePrime.apiGetInfiniPayment).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('does not attribute a Prime activation to a pending payment', async () => {
    const payment = buildPayment('payment-a');
    const onSuccess = jest.fn();
    servicePrime.apiGetInfiniPayment.mockResolvedValue(payment);
    servicePrime.apiGetInfiniPurchaseStatusSnapshot.mockResolvedValue({
      onekeyUserId: baseline.onekeyUserId,
      primeSubscription: { isActive: true, expiresAt: Date.now() + 60_000 },
      infiniSubscription: undefined,
    });

    const { unmount } = renderHook(() =>
      usePrimeInfiniPaymentPolling({
        payment,
        asset,
        baseline,
        enabled: true,
        onSuccess,
        onTerminal: jest.fn(),
        pollIntervalMs: 60_000,
      }),
    );

    await waitFor(() => {
      expect(servicePrime.apiGetInfiniPayment).toHaveBeenCalledTimes(1);
    });
    expect(onSuccess).not.toHaveBeenCalled();
    unmount();
  });

  it('keeps polling a confirmed payment until the subscription advances', async () => {
    const payment = {
      ...buildPayment('payment-a'),
      amountConfirmed: '29.99',
    };
    const onSuccess = jest.fn();
    servicePrime.apiGetInfiniPayment.mockResolvedValue(payment);

    const { result, unmount } = renderHook(() =>
      usePrimeInfiniPaymentPolling({
        payment,
        asset,
        baseline,
        enabled: true,
        onSuccess,
        onTerminal: jest.fn(),
        pollIntervalMs: 60_000,
      }),
    );

    await waitFor(() => {
      expect(result.current.outcome).toBe('confirmed');
    });
    expect(onSuccess).not.toHaveBeenCalled();
    unmount();
  });

  it('keeps polling an expired invoice while funds are confirming', async () => {
    const payment = {
      ...buildPayment('payment-a'),
      amountConfirming: '0.01',
      expiresAt: Date.now() - 1,
    };
    const onTerminal = jest.fn();
    servicePrime.apiGetInfiniPayment.mockResolvedValue(payment);

    const { result, unmount } = renderHook(() =>
      usePrimeInfiniPaymentPolling({
        payment,
        asset,
        baseline,
        enabled: true,
        onSuccess: jest.fn(),
        onTerminal,
        pollIntervalMs: 60_000,
      }),
    );

    await waitFor(() => {
      expect(result.current.outcome).toBe('pending');
    });
    expect(servicePrime.apiGetInfiniPayment).toHaveBeenCalledTimes(1);
    expect(onTerminal).not.toHaveBeenCalled();
    unmount();
  });

  it.each(['expired', 'failed'] as const)(
    'terminates an explicitly %s payment even while funds are still confirming',
    async (status) => {
      const payment = {
        ...buildPayment('payment-a'),
        amountConfirming: '0.01',
        status,
      };
      const onTerminal = jest.fn();
      servicePrime.apiGetInfiniPayment.mockResolvedValue(payment);

      const { result, unmount } = renderHook(() =>
        usePrimeInfiniPaymentPolling({
          payment,
          asset,
          baseline,
          enabled: true,
          onSuccess: jest.fn(),
          onTerminal,
          pollIntervalMs: 60_000,
        }),
      );

      await waitFor(() => {
        expect(onTerminal).toHaveBeenCalledWith(status);
      });
      expect(result.current.outcome).toBe(status);
      unmount();
    },
  );

  it('terminates a locally expired partial payment without a confirming amount', async () => {
    const payment = {
      ...buildPayment('payment-a'),
      amountConfirmed: '0.01',
      amountConfirming: '0',
      expiresAt: Date.now() - 1,
    };
    const onTerminal = jest.fn();
    servicePrime.apiGetInfiniPayment.mockResolvedValue(payment);

    const { result, unmount } = renderHook(() =>
      usePrimeInfiniPaymentPolling({
        payment,
        asset,
        baseline,
        enabled: true,
        onSuccess: jest.fn(),
        onTerminal,
        pollIntervalMs: 60_000,
      }),
    );

    await waitFor(() => {
      expect(onTerminal).toHaveBeenCalledWith('expired');
    });
    expect(result.current.outcome).toBe('expired');
    unmount();
  });

  it.each(['expired', 'failed'] as const)(
    'terminates an explicitly %s partial payment without a confirming amount',
    async (status) => {
      const payment = {
        ...buildPayment('payment-a'),
        amountConfirmed: '0.01',
        amountConfirming: '0',
        status,
      };
      const onTerminal = jest.fn();
      servicePrime.apiGetInfiniPayment.mockResolvedValue(payment);

      const { result, unmount } = renderHook(() =>
        usePrimeInfiniPaymentPolling({
          payment,
          asset,
          baseline,
          enabled: true,
          onSuccess: jest.fn(),
          onTerminal,
          pollIntervalMs: 60_000,
        }),
      );

      await waitFor(() => {
        expect(onTerminal).toHaveBeenCalledWith(status);
      });
      expect(result.current.outcome).toBe(status);
      unmount();
    },
  );

  it('does not derive a terminal outcome from stale payment data after a query error', async () => {
    const payment = {
      ...buildPayment('payment-a'),
      expiresAt: Date.now() - 1,
    };
    const onTerminal = jest.fn();
    servicePrime.apiGetInfiniPayment.mockRejectedValue(
      new Error('temporary query error'),
    );

    const { unmount } = renderHook(() =>
      usePrimeInfiniPaymentPolling({
        payment,
        asset,
        baseline,
        enabled: true,
        onSuccess: jest.fn(),
        onTerminal,
        pollIntervalMs: 60_000,
      }),
    );

    await waitFor(() => {
      expect(servicePrime.apiGetInfiniPayment).toHaveBeenCalledTimes(1);
    });
    expect(onTerminal).not.toHaveBeenCalled();
    unmount();
  });

  it('does not complete from a stale confirmed payment when its fresh query fails', async () => {
    const payment = {
      ...buildPayment('payment-a'),
      amountConfirmed: '29.99',
    };
    const onSuccess = jest.fn();
    servicePrime.apiGetInfiniPayment.mockRejectedValue(
      new Error('temporary query error'),
    );
    servicePrime.apiGetInfiniPurchaseStatusSnapshot.mockResolvedValue({
      onekeyUserId: baseline.onekeyUserId,
      primeSubscription: { isActive: true, expiresAt: Date.now() + 60_000 },
      infiniSubscription: undefined,
    });

    const { unmount } = renderHook(() =>
      usePrimeInfiniPaymentPolling({
        payment,
        asset,
        baseline,
        enabled: true,
        onSuccess,
        onTerminal: jest.fn(),
        pollIntervalMs: 60_000,
      }),
    );

    await waitFor(() => {
      expect(servicePrime.apiGetInfiniPayment).toHaveBeenCalledTimes(1);
    });
    expect(onSuccess).not.toHaveBeenCalled();
    unmount();
  });

  it('retries completion after the success side effect rejects', async () => {
    const payment = {
      ...buildPayment('payment-a'),
      amountConfirmed: '29.99',
    };
    const onSuccess = jest
      .fn()
      .mockRejectedValueOnce(new Error('temporary success side-effect error'))
      .mockResolvedValue(undefined);
    servicePrime.apiGetInfiniPayment.mockResolvedValue(payment);
    servicePrime.apiGetInfiniPurchaseStatusSnapshot.mockResolvedValue({
      onekeyUserId: baseline.onekeyUserId,
      primeSubscription: { isActive: true, expiresAt: Date.now() + 60_000 },
      infiniSubscription: undefined,
    });

    const { result, unmount } = renderHook(() =>
      usePrimeInfiniPaymentPolling({
        payment,
        asset,
        baseline,
        enabled: true,
        onSuccess,
        onTerminal: jest.fn(),
        pollIntervalMs: 60_000,
      }),
    );

    await waitFor(() => {
      expect(result.current.hasError).toBe(true);
      expect(result.current.isPolling).toBe(false);
    });
    act(() => {
      result.current.refresh();
    });
    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledTimes(2);
    });
    unmount();
  });

  it('backs off payment request failures at 1x, 2x, 4x, and 6x before resetting after success', async () => {
    jest.useFakeTimers();
    try {
      const payment = buildPayment('payment-a');
      servicePrime.apiGetInfiniPayment
        .mockRejectedValueOnce(new Error('request failure 1'))
        .mockRejectedValueOnce(new Error('request failure 2'))
        .mockRejectedValueOnce(new Error('request failure 3'))
        .mockRejectedValueOnce(new Error('request failure 4'))
        .mockRejectedValueOnce(new Error('request failure 5'))
        .mockResolvedValue(payment);

      const { result, unmount } = renderHook(() =>
        usePrimeInfiniPaymentPolling({
          payment,
          asset,
          baseline,
          enabled: true,
          onSuccess: jest.fn(),
          onTerminal: jest.fn(),
          pollIntervalMs: 100,
        }),
      );

      await flushPollingMicrotasks();
      expect(servicePrime.apiGetInfiniPayment).toHaveBeenCalledTimes(1);
      expect(result.current.hasError).toBe(true);

      await advancePollingTimers(99);
      expect(servicePrime.apiGetInfiniPayment).toHaveBeenCalledTimes(1);
      await advancePollingTimers(1);
      expect(servicePrime.apiGetInfiniPayment).toHaveBeenCalledTimes(2);

      await advancePollingTimers(199);
      expect(servicePrime.apiGetInfiniPayment).toHaveBeenCalledTimes(2);
      await advancePollingTimers(1);
      expect(servicePrime.apiGetInfiniPayment).toHaveBeenCalledTimes(3);

      await advancePollingTimers(400);
      expect(servicePrime.apiGetInfiniPayment).toHaveBeenCalledTimes(4);
      await advancePollingTimers(600);
      expect(servicePrime.apiGetInfiniPayment).toHaveBeenCalledTimes(5);

      await advancePollingTimers(599);
      expect(servicePrime.apiGetInfiniPayment).toHaveBeenCalledTimes(5);
      await advancePollingTimers(1);
      expect(servicePrime.apiGetInfiniPayment).toHaveBeenCalledTimes(6);
      expect(result.current.hasError).toBe(false);

      await advancePollingTimers(99);
      expect(servicePrime.apiGetInfiniPayment).toHaveBeenCalledTimes(6);
      await advancePollingTimers(1);
      expect(servicePrime.apiGetInfiniPayment).toHaveBeenCalledTimes(7);
      unmount();
    } finally {
      jest.clearAllTimers();
      jest.useRealTimers();
    }
  });

  it('backs off subscription check failures and resets after a successful check', async () => {
    jest.useFakeTimers();
    try {
      const payment = buildPayment('payment-a');
      servicePrime.apiGetInfiniPayment.mockResolvedValue(payment);
      servicePrime.apiGetInfiniPurchaseStatusSnapshot
        .mockRejectedValueOnce(new Error('subscription check failure 1'))
        .mockRejectedValueOnce(new Error('subscription check failure 2'))
        .mockResolvedValue({
          onekeyUserId: baseline.onekeyUserId,
          primeSubscription: undefined,
          infiniSubscription: undefined,
        });

      const { result, unmount } = renderHook(() =>
        usePrimeInfiniPaymentPolling({
          payment,
          asset,
          baseline,
          enabled: true,
          onSuccess: jest.fn(),
          onTerminal: jest.fn(),
          pollIntervalMs: 50,
        }),
      );

      await flushPollingMicrotasks();
      expect(
        servicePrime.apiGetInfiniPurchaseStatusSnapshot,
      ).toHaveBeenCalledTimes(1);
      expect(result.current.hasError).toBe(true);

      await advancePollingTimers(50);
      expect(
        servicePrime.apiGetInfiniPurchaseStatusSnapshot,
      ).toHaveBeenCalledTimes(2);
      await advancePollingTimers(99);
      expect(
        servicePrime.apiGetInfiniPurchaseStatusSnapshot,
      ).toHaveBeenCalledTimes(2);
      await advancePollingTimers(1);
      expect(
        servicePrime.apiGetInfiniPurchaseStatusSnapshot,
      ).toHaveBeenCalledTimes(3);
      expect(result.current.hasError).toBe(false);

      await advancePollingTimers(49);
      expect(
        servicePrime.apiGetInfiniPurchaseStatusSnapshot,
      ).toHaveBeenCalledTimes(3);
      await advancePollingTimers(1);
      expect(
        servicePrime.apiGetInfiniPurchaseStatusSnapshot,
      ).toHaveBeenCalledTimes(4);
      unmount();
    } finally {
      jest.clearAllTimers();
      jest.useRealTimers();
    }
  });
});

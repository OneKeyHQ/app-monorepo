/**
 * @jest-environment jsdom
 */

import { act, renderHook } from '@testing-library/react-native';

import { EWcPayStatus } from '@onekeyhq/shared/src/walletConnect/payTypes';
import type {
  IWcPayAmount,
  IWcPayConfirmResult,
} from '@onekeyhq/shared/src/walletConnect/payTypes';

import {
  DEFAULT_POLL_MS,
  MAX_POLL_COUNT,
  useWcPayResultPolling,
} from '../useWcPayResultPolling';

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => {
  const mockServiceWalletConnectPay = {
    confirmPayment: jest.fn(),
  };
  (globalThis as any).__wcPayResultPollingService = mockServiceWalletConnectPay;
  return {
    __esModule: true,
    default: { serviceWalletConnectPay: mockServiceWalletConnectPay },
  };
});

const globalMockBag = globalThis as typeof globalThis & {
  __wcPayResultPollingService?: { confirmPayment: jest.Mock };
};
const serviceWalletConnectPay = globalMockBag.__wcPayResultPollingService!;

const PAYMENT_ID = 'payment-1';
const OPTION_ID = 'option-1';
const SIGNATURES = ['0xsig'];

function processingResult(
  overrides: Partial<IWcPayConfirmResult> = {},
): IWcPayConfirmResult {
  return {
    status: EWcPayStatus.Processing,
    isFinal: false,
    ...overrides,
  };
}

const OPTION_AMOUNT: IWcPayAmount = {
  unit: 'usdc',
  value: '1000000',
  display: { assetSymbol: 'USDC', assetName: 'USD Coin', decimals: 6 },
};

function succeededResult(
  overrides: Partial<IWcPayConfirmResult> = {},
): IWcPayConfirmResult {
  return {
    status: EWcPayStatus.Succeeded,
    isFinal: true,
    info: { txId: '0xtx', optionAmount: OPTION_AMOUNT },
    ...overrides,
  };
}

async function flushMicrotasks() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function advanceTimers(ms: number) {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
  await flushMicrotasks();
}

describe('useWcPayResultPolling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('never calls confirmPayment while disabled', async () => {
    const initialResult = processingResult();
    const { unmount } = renderHook(() =>
      useWcPayResultPolling({
        paymentId: PAYMENT_ID,
        optionId: OPTION_ID,
        signatures: SIGNATURES,
        initialResult,
        enabled: false,
      }),
    );

    await advanceTimers(DEFAULT_POLL_MS * 5);
    expect(serviceWalletConnectPay.confirmPayment).not.toHaveBeenCalled();
    unmount();
  });

  it('starts polling fresh when enabled flips from false to true, and does not re-enter on an unchanged true', async () => {
    const initialResult = processingResult({ pollInMs: 100 });
    serviceWalletConnectPay.confirmPayment.mockResolvedValue(
      processingResult({ pollInMs: 100 }),
    );

    const { rerender, unmount } = renderHook(
      ({ enabled }: { enabled: boolean }) =>
        useWcPayResultPolling({
          paymentId: PAYMENT_ID,
          optionId: OPTION_ID,
          signatures: SIGNATURES,
          initialResult,
          enabled,
        }),
      { initialProps: { enabled: false } },
    );

    await advanceTimers(1000);
    expect(serviceWalletConnectPay.confirmPayment).not.toHaveBeenCalled();

    rerender({ enabled: true });
    await advanceTimers(100);
    expect(serviceWalletConnectPay.confirmPayment).toHaveBeenCalledTimes(1);

    // re-rendering with the same `enabled: true` value must not restart the
    // loop (no extra immediate request)
    rerender({ enabled: true });
    expect(serviceWalletConnectPay.confirmPayment).toHaveBeenCalledTimes(1);

    await advanceTimers(100);
    expect(serviceWalletConnectPay.confirmPayment).toHaveBeenCalledTimes(2);
    unmount();
  });

  it('never polls when the initial result is already final', async () => {
    const initialResult = succeededResult();
    const { result, unmount } = renderHook(() =>
      useWcPayResultPolling({
        paymentId: PAYMENT_ID,
        optionId: OPTION_ID,
        signatures: SIGNATURES,
        initialResult,
        enabled: true,
      }),
    );

    await advanceTimers(DEFAULT_POLL_MS * 5);
    expect(serviceWalletConnectPay.confirmPayment).not.toHaveBeenCalled();
    expect(result.current.result).toBe(initialResult);
    expect(result.current.pollExhausted).toBe(false);
    unmount();
  });

  it('schedules the next poll using the response pollInMs when not final', async () => {
    const initialResult = processingResult({ pollInMs: 1000 });
    const secondResult = processingResult({ pollInMs: 5000 });
    serviceWalletConnectPay.confirmPayment.mockResolvedValueOnce(secondResult);

    const { result, unmount } = renderHook(() =>
      useWcPayResultPolling({
        paymentId: PAYMENT_ID,
        optionId: OPTION_ID,
        signatures: SIGNATURES,
        initialResult,
        enabled: true,
      }),
    );

    // first poll fires after the initial result's pollInMs
    await advanceTimers(999);
    expect(serviceWalletConnectPay.confirmPayment).not.toHaveBeenCalled();
    await advanceTimers(1);
    expect(serviceWalletConnectPay.confirmPayment).toHaveBeenCalledTimes(1);
    expect(serviceWalletConnectPay.confirmPayment).toHaveBeenCalledWith({
      paymentId: PAYMENT_ID,
      optionId: OPTION_ID,
      signatures: SIGNATURES,
    });
    expect(result.current.result).toBe(secondResult);

    // next poll should wait for the SECOND result's pollInMs, not the default
    await advanceTimers(4999);
    expect(serviceWalletConnectPay.confirmPayment).toHaveBeenCalledTimes(1);
    await advanceTimers(1);
    expect(serviceWalletConnectPay.confirmPayment).toHaveBeenCalledTimes(2);
    unmount();
  });

  it('falls back to DEFAULT_POLL_MS when pollInMs is absent', async () => {
    const initialResult = processingResult();
    serviceWalletConnectPay.confirmPayment.mockResolvedValue(
      processingResult(),
    );

    renderHook(() =>
      useWcPayResultPolling({
        paymentId: PAYMENT_ID,
        optionId: OPTION_ID,
        signatures: SIGNATURES,
        initialResult,
        enabled: true,
      }),
    );

    await advanceTimers(DEFAULT_POLL_MS - 1);
    expect(serviceWalletConnectPay.confirmPayment).not.toHaveBeenCalled();
    await advanceTimers(1);
    expect(serviceWalletConnectPay.confirmPayment).toHaveBeenCalledTimes(1);
  });

  it('re-submits the same signatures on every poll and stops once final', async () => {
    const initialResult = processingResult({ pollInMs: 100 });
    const finalResult = succeededResult();
    serviceWalletConnectPay.confirmPayment.mockResolvedValueOnce(finalResult);

    const { result, unmount } = renderHook(() =>
      useWcPayResultPolling({
        paymentId: PAYMENT_ID,
        optionId: OPTION_ID,
        signatures: SIGNATURES,
        initialResult,
        enabled: true,
      }),
    );

    await advanceTimers(100);
    expect(serviceWalletConnectPay.confirmPayment).toHaveBeenCalledTimes(1);
    expect(serviceWalletConnectPay.confirmPayment).toHaveBeenCalledWith({
      paymentId: PAYMENT_ID,
      optionId: OPTION_ID,
      signatures: SIGNATURES,
    });
    expect(result.current.result).toBe(finalResult);

    // no further timers should be scheduled once final
    await advanceTimers(DEFAULT_POLL_MS * 10);
    expect(serviceWalletConnectPay.confirmPayment).toHaveBeenCalledTimes(1);
    expect(result.current.pollExhausted).toBe(false);
    unmount();
  });

  it('does not restart polling when signatures is re-created with identical content', async () => {
    const initialResult = processingResult({ pollInMs: 100 });
    serviceWalletConnectPay.confirmPayment.mockResolvedValue(
      processingResult({ pollInMs: 100 }),
    );

    const { rerender, unmount } = renderHook(
      ({ signatures }: { signatures: string[] }) =>
        useWcPayResultPolling({
          paymentId: PAYMENT_ID,
          optionId: OPTION_ID,
          signatures,
          initialResult,
          enabled: true,
        }),
      { initialProps: { signatures: [...SIGNATURES] } },
    );

    // advance partway into the first poll interval, then re-render with a
    // new array instance that carries the same content
    await advanceTimers(50);
    expect(serviceWalletConnectPay.confirmPayment).not.toHaveBeenCalled();
    rerender({ signatures: [...SIGNATURES] });
    // an identity-equal re-render must not reset or re-arm the timer
    expect(serviceWalletConnectPay.confirmPayment).not.toHaveBeenCalled();

    // the original schedule still lands at the original 100ms mark, not a
    // fresh 100ms counted from the re-render
    await advanceTimers(50);
    expect(serviceWalletConnectPay.confirmPayment).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('resets pollExhausted and result when the request identity changes after exhaustion', async () => {
    const initialResult = processingResult({ pollInMs: 10 });
    serviceWalletConnectPay.confirmPayment.mockResolvedValue(
      processingResult({ pollInMs: 10 }),
    );

    const { result, rerender, unmount } = renderHook(
      (props: {
        optionId: string;
        signatures: string[];
        initialResult: IWcPayConfirmResult;
      }) =>
        useWcPayResultPolling({
          paymentId: PAYMENT_ID,
          optionId: props.optionId,
          signatures: props.signatures,
          initialResult: props.initialResult,
          enabled: true,
        }),
      {
        initialProps: {
          optionId: OPTION_ID,
          signatures: SIGNATURES,
          initialResult,
        },
      },
    );

    await advanceTimers(10 * (MAX_POLL_COUNT + 1));
    expect(result.current.pollExhausted).toBe(true);
    expect(serviceWalletConnectPay.confirmPayment).toHaveBeenCalledTimes(
      MAX_POLL_COUNT,
    );

    const retryInitialResult = processingResult({ pollInMs: 10 });
    rerender({
      optionId: 'option-2',
      signatures: ['0xnewsig'],
      initialResult: retryInitialResult,
    });

    // the reset happens synchronously at render time, before any new timer
    // has a chance to fire
    expect(result.current.pollExhausted).toBe(false);
    expect(result.current.result).toBe(retryInitialResult);

    await advanceTimers(10);
    expect(serviceWalletConnectPay.confirmPayment).toHaveBeenCalledTimes(
      MAX_POLL_COUNT + 1,
    );
    expect(serviceWalletConnectPay.confirmPayment).toHaveBeenLastCalledWith({
      paymentId: PAYMENT_ID,
      optionId: 'option-2',
      signatures: ['0xnewsig'],
    });
    unmount();
  });

  it('retries after DEFAULT_POLL_MS when confirmPayment rejects', async () => {
    const initialResult = processingResult({ pollInMs: 100 });
    serviceWalletConnectPay.confirmPayment
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValue(processingResult({ pollInMs: 100 }));

    renderHook(() =>
      useWcPayResultPolling({
        paymentId: PAYMENT_ID,
        optionId: OPTION_ID,
        signatures: SIGNATURES,
        initialResult,
        enabled: true,
      }),
    );

    await advanceTimers(100);
    expect(serviceWalletConnectPay.confirmPayment).toHaveBeenCalledTimes(1);

    // the rejection reschedules using DEFAULT_POLL_MS, not the last pollInMs
    await advanceTimers(DEFAULT_POLL_MS - 1);
    expect(serviceWalletConnectPay.confirmPayment).toHaveBeenCalledTimes(1);
    await advanceTimers(1);
    expect(serviceWalletConnectPay.confirmPayment).toHaveBeenCalledTimes(2);
  });

  it('sets pollExhausted after MAX_POLL_COUNT polls without a final result, and stops', async () => {
    const initialResult = processingResult({ pollInMs: 10 });
    serviceWalletConnectPay.confirmPayment.mockResolvedValue(
      processingResult({ pollInMs: 10 }),
    );

    const { result, unmount } = renderHook(() =>
      useWcPayResultPolling({
        paymentId: PAYMENT_ID,
        optionId: OPTION_ID,
        signatures: SIGNATURES,
        initialResult,
        enabled: true,
      }),
    );

    // MAX_POLL_COUNT polls, each spaced 10ms apart, plus one more interval
    // for the (MAX_POLL_COUNT + 1)th timer to observe the count and exhaust
    // without issuing another request
    await advanceTimers(10 * (MAX_POLL_COUNT + 1));
    expect(serviceWalletConnectPay.confirmPayment).toHaveBeenCalledTimes(
      MAX_POLL_COUNT,
    );
    expect(result.current.pollExhausted).toBe(true);
    // status must not be faked to Failed
    expect(result.current.result.status).toBe(EWcPayStatus.Processing);
    expect(result.current.result.isFinal).toBe(false);

    // no further calls beyond MAX_POLL_COUNT
    await advanceTimers(10 * 5);
    expect(serviceWalletConnectPay.confirmPayment).toHaveBeenCalledTimes(
      MAX_POLL_COUNT,
    );
    unmount();
  });

  it('does not update state or poll again after unmounting mid-flight', async () => {
    let resolveConfirm: ((value: IWcPayConfirmResult) => void) | undefined;
    const pending = new Promise<IWcPayConfirmResult>((resolvePromise) => {
      resolveConfirm = resolvePromise;
    });
    const initialResult = processingResult({ pollInMs: 10 });
    serviceWalletConnectPay.confirmPayment.mockReturnValueOnce(pending);

    const { unmount } = renderHook(() =>
      useWcPayResultPolling({
        paymentId: PAYMENT_ID,
        optionId: OPTION_ID,
        signatures: SIGNATURES,
        initialResult,
        enabled: true,
      }),
    );

    await advanceTimers(10);
    expect(serviceWalletConnectPay.confirmPayment).toHaveBeenCalledTimes(1);

    unmount();

    // resolve the in-flight request after unmount; the hook must not
    // schedule another timer or throw from a setState-after-unmount
    await act(async () => {
      resolveConfirm?.(succeededResult());
      await pending;
    });
    await flushMicrotasks();

    await advanceTimers(DEFAULT_POLL_MS * 5);
    expect(serviceWalletConnectPay.confirmPayment).toHaveBeenCalledTimes(1);
  });
});

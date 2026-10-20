/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';

import type { IPrimeWebCheckoutPendingSession } from '@onekeyhq/shared/types/prime/primeTypes';

import { usePrimeWebCheckoutRecovery } from './usePrimeWebCheckoutRecovery';

import type {
  checkPrimeWebCheckout,
  settlePrimeWebCheckout,
} from './primeWebCheckout';
import type { IPrimeWebCheckoutResult } from './primeWebCheckoutResult';

const mockSessions = new Map<string, IPrimeWebCheckoutPendingSession>();
const mockReturnListeners = new Set<() => void>();
const mockVisibilityListeners = new Set<(visible: boolean) => void>();
const mockGetPending = jest.fn<
  Promise<IPrimeWebCheckoutPendingSession | undefined>,
  [{ onekeyUserId: string }]
>();
const mockCheck = jest.fn<
  ReturnType<typeof checkPrimeWebCheckout>,
  Parameters<typeof checkPrimeWebCheckout>
>();
const mockSettle = jest.fn<
  ReturnType<typeof settlePrimeWebCheckout>,
  Parameters<typeof settlePrimeWebCheckout>
>();
const mockIsUserCurrent = jest.fn(async () => true);
const mockIsInitiator = jest.fn(async () => true);
const mockIsMonitored = jest.fn(() => false);
const mockToast = jest.fn<void, []>();
const mockFinish = jest.fn<Promise<void>, unknown[]>(async () => undefined);
const mockLog = jest.fn<void, unknown[]>();

jest.mock('react-intl', () => ({ useIntl: () => ({ locale: 'en-US' }) }));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    simpleDb: {
      prime: {
        getWebCheckoutPendingSession: (params: { onekeyUserId: string }) =>
          mockGetPending(params),
      },
    },
  },
}));
jest.mock('@onekeyhq/shared/src/utils/appVisibility', () => ({
  getCurrentVisibilityState: () => true,
  onVisibilityStateChange: (listener: (visible: boolean) => void) => {
    mockVisibilityListeners.add(listener);
    return () => mockVisibilityListeners.delete(listener);
  },
}));
jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: { PrimeWebCheckoutReturned: 'PrimeWebCheckoutReturned' },
  appEventBus: {
    on: (_event: string, listener: () => void) => {
      mockReturnListeners.add(listener);
    },
    off: (_event: string, listener: () => void) => {
      mockReturnListeners.delete(listener);
    },
  },
}));
jest.mock('./primeWebCheckout', () => ({
  getPrimeWebCheckoutPlatform: () => 'extension',
  isPrimeWebCheckoutMonitored: () => mockIsMonitored(),
  isPrimeWebCheckoutUserCurrent: () => mockIsUserCurrent(),
  isPrimeWebCheckoutInitiatorSurface: () => mockIsInitiator(),
  checkPrimeWebCheckout: (
    ...params: Parameters<typeof checkPrimeWebCheckout>
  ) => mockCheck(...params),
  settlePrimeWebCheckout: (
    ...params: Parameters<typeof settlePrimeWebCheckout>
  ) => mockSettle(...params),
  showPrimeWebCheckoutSuccessToast: () => mockToast(),
  finishPrimeWebCheckoutSuccess: (...params: unknown[]) =>
    mockFinish(...params),
  logPrimeWebCheckoutSessionFlow: (...params: unknown[]) => mockLog(...params),
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function sessionFor(onekeyUserId = 'user-1'): IPrimeWebCheckoutPendingSession {
  return {
    checkoutId: `checkout-${onekeyUserId}`,
    onekeyUserId,
    subscriptionPeriod: 'P1Y',
    packageId: '$rc_annual',
    offeringId: 'Sandbox_testing',
    amount: 99,
    currency: 'USD',
    isSandbox: true,
    platform: 'extension',
    checkoutUrl: `https://pay.rev.cat/sandbox/test/${onekeyUserId}`,
    startedAt: Date.now(),
  };
}

const successResult: IPrimeWebCheckoutResult = {
  status: 'succeeded',
  entitlement: {
    isActive: true,
    store: 'rc_billing',
    latestPurchaseDate: new Date(),
    isSandbox: true,
    periodType: 'normal',
    productIdentifier: 'prime_yearly',
  },
};

async function returnFromCheckout(count = 1) {
  await act(async () => {
    for (let i = 0; i < count; i += 1) {
      mockReturnListeners.forEach((listener) => listener());
    }
  });
}

async function mountRecovery() {
  const hook = renderHook(
    (onekeyUserId: string) =>
      usePrimeWebCheckoutRecovery({ enabled: true, onekeyUserId }),
    { initialProps: 'user-1' },
  );
  await act(async () => undefined);
  return hook;
}

describe('hosted checkout recovery return signals', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-10-20T14:00:00Z'));
    mockSessions.clear();
    mockSessions.set('user-1', sessionFor());
    mockReturnListeners.clear();
    mockVisibilityListeners.clear();
    mockGetPending.mockImplementation(async ({ onekeyUserId }) =>
      mockSessions.get(onekeyUserId),
    );
    mockCheck.mockResolvedValue({ status: 'pending' });
    mockIsUserCurrent.mockResolvedValue(true);
    mockIsInitiator.mockResolvedValue(true);
    mockIsMonitored.mockReturnValue(false);
    mockSettle.mockImplementation(async ({ session }) => {
      mockSessions.delete(session.onekeyUserId);
      return {
        outcome: 'succeeded',
        successPayload: { onekeyUserId: session.onekeyUserId },
      };
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('coalesces returns during an entitlement request into one fresh check and settles once', async () => {
    const initial = deferred<IPrimeWebCheckoutResult>();
    mockCheck
      .mockReturnValueOnce(initial.promise)
      .mockResolvedValueOnce(successResult);
    await mountRecovery();

    await returnFromCheckout(3);
    expect(mockCheck).toHaveBeenCalledTimes(1);
    await act(async () => initial.resolve({ status: 'pending' }));

    expect(mockCheck).toHaveBeenCalledTimes(2);
    expect(mockSettle).toHaveBeenCalledTimes(1);
    expect(mockToast).toHaveBeenCalledTimes(1);
    expect(mockFinish).toHaveBeenCalledWith({ onekeyUserId: 'user-1' });
    await returnFromCheckout();
    expect(mockSettle).toHaveBeenCalledTimes(1);
    expect(mockToast).toHaveBeenCalledTimes(1);
  });

  it('preserves a return while the initial pending-session read is unresolved', async () => {
    const read = deferred<IPrimeWebCheckoutPendingSession | undefined>();
    mockGetPending.mockReturnValueOnce(read.promise);
    mockCheck
      .mockResolvedValueOnce({ status: 'pending' })
      .mockResolvedValueOnce(successResult);
    await mountRecovery();
    await returnFromCheckout();
    await act(async () => read.resolve(sessionFor()));

    expect(mockCheck).toHaveBeenCalledTimes(2);
    expect(mockFinish).toHaveBeenCalledTimes(1);
  });

  it('runs the queued check after a failed entitlement request', async () => {
    const initial = deferred<IPrimeWebCheckoutResult>();
    mockCheck
      .mockReturnValueOnce(initial.promise)
      .mockResolvedValueOnce(successResult);
    await mountRecovery();
    await returnFromCheckout();
    await act(async () => initial.reject(new Error('request unavailable')));

    expect(mockCheck).toHaveBeenCalledTimes(2);
    expect(mockFinish).toHaveBeenCalledTimes(1);
  });

  it('runs the queued check after a failed pending-session read', async () => {
    const read = deferred<IPrimeWebCheckoutPendingSession | undefined>();
    mockGetPending.mockReturnValueOnce(read.promise);
    mockCheck.mockResolvedValueOnce(successResult);
    await mountRecovery();
    await returnFromCheckout();
    await act(async () => read.reject(new Error('background unavailable')));

    expect(mockGetPending).toHaveBeenCalledTimes(2);
    expect(mockFinish).toHaveBeenCalledTimes(1);
  });

  it('does not keep retrying when the one queued check is still pending', async () => {
    const initial = deferred<IPrimeWebCheckoutResult>();
    mockCheck.mockReturnValueOnce(initial.promise);
    await mountRecovery();
    await returnFromCheckout(5);
    await act(async () => initial.resolve({ status: 'pending' }));
    await act(async () => jest.advanceTimersByTime(120_000));

    expect(mockCheck).toHaveBeenCalledTimes(2);
    expect(mockSettle).not.toHaveBeenCalled();
  });

  it('also preserves a new return received during the follow-up check', async () => {
    const initial = deferred<IPrimeWebCheckoutResult>();
    const followUp = deferred<IPrimeWebCheckoutResult>();
    mockCheck
      .mockReturnValueOnce(initial.promise)
      .mockReturnValueOnce(followUp.promise)
      .mockResolvedValueOnce(successResult);
    await mountRecovery();
    await returnFromCheckout();
    await act(async () => initial.resolve({ status: 'pending' }));
    await returnFromCheckout(3);
    await act(async () => followUp.resolve({ status: 'pending' }));

    expect(mockCheck).toHaveBeenCalledTimes(3);
    expect(mockSettle).toHaveBeenCalledTimes(1);
  });

  it('does not settle again when the first check already completed the checkout', async () => {
    const initial = deferred<IPrimeWebCheckoutResult>();
    mockCheck.mockReturnValueOnce(initial.promise);
    await mountRecovery();
    await returnFromCheckout(3);
    await act(async () => initial.resolve(successResult));

    expect(mockCheck).toHaveBeenCalledTimes(1);
    expect(mockSettle).toHaveBeenCalledTimes(1);
    expect(mockFinish).toHaveBeenCalledTimes(1);
  });

  it('keeps the initiator-surface guard on the queued return check', async () => {
    const initial = deferred<IPrimeWebCheckoutResult>();
    mockCheck.mockReturnValueOnce(initial.promise);
    mockIsInitiator.mockResolvedValue(false);
    await mountRecovery();
    await returnFromCheckout();
    await act(async () => initial.resolve({ status: 'pending' }));

    expect(mockGetPending).toHaveBeenCalledTimes(2);
    expect(mockIsInitiator).toHaveBeenCalledTimes(1);
    expect(mockCheck).toHaveBeenCalledTimes(1);
  });

  it('does not take settlement ownership from a live waiting dialog', async () => {
    mockIsMonitored.mockReturnValue(true);
    await mountRecovery();
    await returnFromCheckout();

    expect(mockCheck).not.toHaveBeenCalled();
    expect(mockSettle).not.toHaveBeenCalled();
  });

  it('cancels queued work and late results when the recovery hook unmounts', async () => {
    const initial = deferred<IPrimeWebCheckoutResult>();
    mockCheck.mockReturnValueOnce(initial.promise);
    const { unmount } = await mountRecovery();
    await returnFromCheckout();
    unmount();
    await act(async () => initial.resolve(successResult));

    expect(mockGetPending).toHaveBeenCalledTimes(1);
    expect(mockSettle).not.toHaveBeenCalled();
    expect(mockToast).not.toHaveBeenCalled();
    expect(mockReturnListeners.size).toBe(0);
    expect(mockVisibilityListeners.size).toBe(0);
  });

  it('keeps queued work scoped to the account that received the return', async () => {
    const initial = deferred<IPrimeWebCheckoutResult>();
    mockCheck.mockReturnValueOnce(initial.promise);
    mockSessions.set('user-2', sessionFor('user-2'));
    const { rerender } = await mountRecovery();
    await returnFromCheckout();
    rerender('user-2');
    await act(async () => initial.resolve(successResult));

    expect(mockGetPending.mock.calls).toEqual([
      [{ onekeyUserId: 'user-1' }],
      [{ onekeyUserId: 'user-2' }],
    ]);
    expect(mockCheck).toHaveBeenLastCalledWith(sessionFor('user-2'));
    expect(mockSettle).not.toHaveBeenCalled();
    expect(mockToast).not.toHaveBeenCalled();
  });

  it('drops a follow-up result after switching accounts', async () => {
    const initial = deferred<IPrimeWebCheckoutResult>();
    const followUp = deferred<IPrimeWebCheckoutResult>();
    mockCheck
      .mockReturnValueOnce(initial.promise)
      .mockReturnValueOnce(followUp.promise);
    mockSessions.set('user-2', sessionFor('user-2'));
    const { rerender } = await mountRecovery();
    await returnFromCheckout();
    await act(async () => initial.resolve({ status: 'pending' }));
    rerender('user-2');
    await act(async () => followUp.resolve(successResult));

    expect(mockGetPending).toHaveBeenCalledTimes(3);
    expect(mockCheck).toHaveBeenLastCalledWith(sessionFor('user-2'));
    expect(mockSettle).not.toHaveBeenCalled();
    expect(mockFinish).not.toHaveBeenCalled();
  });

  it('cancels a queued request when the account changes during its identity check', async () => {
    const initial = deferred<IPrimeWebCheckoutResult>();
    const identity = deferred<boolean>();
    mockCheck.mockReturnValueOnce(initial.promise);
    mockIsUserCurrent
      .mockResolvedValueOnce(true)
      .mockReturnValueOnce(identity.promise);
    const { rerender } = await mountRecovery();
    await returnFromCheckout();
    await act(async () => initial.resolve({ status: 'pending' }));
    rerender('user-2');
    await act(async () => identity.resolve(true));

    expect(mockCheck).toHaveBeenCalledTimes(1);
    expect(mockSettle).not.toHaveBeenCalled();
    expect(mockFinish).not.toHaveBeenCalled();
  });

  it('does not display stale success when the account changes during settlement', async () => {
    const settlement =
      deferred<Awaited<ReturnType<typeof settlePrimeWebCheckout>>>();
    mockCheck.mockResolvedValueOnce(successResult);
    mockSettle.mockReturnValueOnce(settlement.promise);
    mockSessions.set('user-2', sessionFor('user-2'));
    const { rerender } = await mountRecovery();
    await returnFromCheckout();
    rerender('user-2');
    await act(async () =>
      settlement.resolve({
        outcome: 'succeeded',
        successPayload: { onekeyUserId: 'user-1' },
      }),
    );

    expect(mockToast).not.toHaveBeenCalled();
    expect(mockFinish).not.toHaveBeenCalled();
    expect(mockGetPending).toHaveBeenCalledTimes(2);
  });

  it('checks the background account again before reporting settlement success', async () => {
    const settlement =
      deferred<Awaited<ReturnType<typeof settlePrimeWebCheckout>>>();
    mockCheck.mockResolvedValueOnce(successResult);
    mockSettle.mockReturnValueOnce(settlement.promise);
    await mountRecovery();
    mockIsUserCurrent.mockResolvedValue(false);
    await act(async () =>
      settlement.resolve({
        outcome: 'succeeded',
        successPayload: { onekeyUserId: 'user-1' },
      }),
    );

    expect(mockToast).not.toHaveBeenCalled();
    expect(mockFinish).not.toHaveBeenCalled();
  });
});

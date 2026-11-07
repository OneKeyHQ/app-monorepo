/** @jest-environment jsdom */
/* eslint-disable import/first */

import { act, renderHook } from '@testing-library/react';

let mockFailedListener: ((event: IOnramperEvent) => void) | undefined;
// A mock client skips the session mint; a real one mints, then initializes.
let mockIsMockClient = true;
const mockFetchOnramperSession = jest.fn<Promise<IOnramperSession>, []>();
const mockInitialize = jest.fn<Promise<void>, []>();
const mockGetCheckoutRequirements = jest.fn<
  Promise<{ button: string; quote: IOnramperQuote }>,
  []
>();
const mockLog = new Map<string, jest.Mock>();

jest.mock('@onekeyhq/shared/src/locale/appLocale', () => ({
  appLocale: {
    getLocale: () => 'en-US',
    // Message ids stand in for copy: these tests check which line is shown.
    intl: { formatMessage: ({ id }: { id: string }) => id },
  },
}));

jest.mock('@onekeyhq/shared/src/storage/appStorage', () => ({
  __esModule: true,
  default: {
    syncStorage: { getBoolean: () => undefined, set: () => {} },
  },
}));

jest.mock('@onekeyhq/shared/src/modules3rdParty/onramper', () => ({
  ...jest.requireActual<
    typeof import('@onekeyhq/shared/src/modules3rdParty/onramper/utils')
  >('@onekeyhq/shared/src/modules3rdParty/onramper/utils'),
  ONRAMPER_EVENT_NAMES: ['failed'],
  getOnramperConfig: () => ({}),
  createOnramperClient: () => ({
    isMock: mockIsMockClient,
    initialize: () => mockInitialize(),
    getCheckoutRequirements: () => mockGetCheckoutRequirements(),
    addEventListener: (
      _name: string,
      listener: (event: IOnramperEvent) => void,
    ) => {
      mockFailedListener = listener;
      return () => {};
    },
    addStateListener: () => () => {},
    reset: async () => {},
    signOut: async () => {},
    destroy: () => {},
  }),
}));

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceFiatCrypto: {
      fetchOnramperSession: () => mockFetchOnramperSession(),
    },
  },
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  __esModule: true,
  defaultLogger: {
    fiatCrypto: {
      onramper: new Proxy(
        {},
        {
          get: (_target, key: string) => {
            if (!mockLog.has(key)) {
              mockLog.set(key, jest.fn());
            }
            return mockLog.get(key);
          },
        },
      ),
    },
  },
}));

import type {
  IOnramperEvent,
  IOnramperQuote,
  IOnramperSession,
} from '@onekeyhq/shared/src/modules3rdParty/onramper';

import { EBuyActionState } from './types';
import { useOnramperCheckout } from './useOnramperCheckout';

const BUTTON_STYLE = {
  backgroundColor: '#000000',
  foregroundColor: '#ffffff',
  borderRadius: 8,
};

const QUOTE: IOnramperQuote = {
  quoteId: 'quote',
  ramp: 'coinbase',
  rate: 0.0004,
  payout: 0.02,
  paymentMethod: 'applepay',
  networkFee: 0.1,
  transactionFee: 0.1,
};

const QUOTE_DEBOUNCE_MS = 400;
// Back-off before init attempt 2 and 3, and before the one quote retry.
const INIT_RETRY_1_MS = 1000;
const INIT_RETRY_2_MS = 2000;
const QUOTE_RETRY_MS = 1000;
const SLOW_HINT_MS = 8000;

// The session was minted under a key other than the one the build carries.
const SESSION_REJECTED = {
  code: 'initializationFailed',
  message: 'SDK initialization failed: BFFRecoveryError.sdkSessionRejected',
};

const NEVER = () => new Promise<never>(() => {});

async function renderCheckout({ amount = 50 }: { amount?: number } = {}) {
  const rendered = renderHook(
    (props: { amount: number }) =>
      useOnramperCheckout({
        amount: props.amount,
        isAmountValid: props.amount > 0,
        source: 'usd',
        destination: 'eth',
        network: 'ethereum',
        address: '0x0',
        buttonStyle: BUTTON_STYLE,
        onCompleted: () => {},
      }),
    { initialProps: { amount } },
  );
  // Let the first init attempt settle.
  await act(async () => {});
  return rendered;
}

// Runs the timers due within `ms` and lets the promises they start settle.
async function advance(ms: number) {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
}

function publishFailed(event: IOnramperEvent) {
  act(() => mockFailedListener?.({ type: 'failed', ...event }));
}

function logged(event: string): unknown[] {
  return (mockLog.get(event)?.mock.calls ?? []).map(
    (call: unknown[]) => call[0],
  );
}

beforeEach(() => {
  jest.useFakeTimers();
  mockLog.clear();
  mockFailedListener = undefined;
  mockIsMockClient = true;
  mockFetchOnramperSession.mockReset();
  mockFetchOnramperSession.mockResolvedValue({
    sessionId: 'session',
    sessionToken: 'token',
  });
  mockInitialize.mockReset();
  mockInitialize.mockResolvedValue(undefined);
  mockGetCheckoutRequirements.mockReset();
  mockGetCheckoutRequirements.mockResolvedValue({
    button: 'button',
    quote: QUOTE,
  });
});

afterEach(() => {
  // The unmount defers the client teardown on a timer.
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

describe('useOnramperCheckout init recovery', () => {
  beforeEach(() => {
    mockIsMockClient = false;
  });

  it('recovers from a failed session mint without leaving the page', async () => {
    mockFetchOnramperSession
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({ sessionId: 'session', sessionToken: 'token' });
    const { result } = await renderCheckout();

    // Still preparing: the failure is not shown while a retry is pending.
    expect(result.current.actionState).toBe(EBuyActionState.Preparing);
    expect(result.current.errorMessage).toBeUndefined();

    await advance(INIT_RETRY_1_MS);
    expect(mockFetchOnramperSession).toHaveBeenCalledTimes(2);
    await advance(QUOTE_DEBOUNCE_MS);

    expect(result.current.actionState).toBe(EBuyActionState.Ready);
    expect(result.current.canRetryInit).toBe(false);
    // The logs tell a retried init from a first-try one.
    expect(logged('sessionMintFailed')).toEqual([
      expect.objectContaining({ attempt: 1, retryInMs: INIT_RETRY_1_MS }),
    ]);
    expect(logged('clientInitialized')).toEqual([
      expect.objectContaining({ attempt: 2 }),
    ]);
  });

  it('recovers from a failed initialize with a fresh session', async () => {
    mockInitialize
      .mockRejectedValueOnce({ code: 'initializationFailed' })
      .mockResolvedValueOnce(undefined);
    const { result } = await renderCheckout();
    expect(result.current.actionState).toBe(EBuyActionState.Preparing);

    await advance(INIT_RETRY_1_MS);
    await advance(QUOTE_DEBOUNCE_MS);

    expect(mockFetchOnramperSession).toHaveBeenCalledTimes(2);
    expect(mockInitialize).toHaveBeenCalledTimes(2);
    expect(result.current.actionState).toBe(EBuyActionState.Ready);
  });

  it('gives up after three attempts and offers the web widget with a retry', async () => {
    mockFetchOnramperSession.mockRejectedValue(new Error('Network error'));
    const { result } = await renderCheckout();

    await advance(INIT_RETRY_1_MS);
    expect(result.current.actionState).toBe(EBuyActionState.Preparing);
    await advance(INIT_RETRY_2_MS);

    expect(mockFetchOnramperSession).toHaveBeenCalledTimes(3);
    expect(result.current.actionState).toBe(EBuyActionState.WebFallback);
    expect(result.current.canRetryInit).toBe(true);
    expect(result.current.errorMessage).toContain('buy_error_service__msg');
    expect(logged('sessionMintFailed')[2]).toEqual(
      expect.objectContaining({ attempt: 3, retryInMs: undefined }),
    );

    // Nothing keeps retrying behind the fallback.
    await advance(60_000);
    expect(mockFetchOnramperSession).toHaveBeenCalledTimes(3);
  });

  it('initializes again in place when the user retries from the fallback', async () => {
    mockFetchOnramperSession.mockRejectedValue(new Error('Network error'));
    const { result } = await renderCheckout();
    await advance(INIT_RETRY_1_MS);
    await advance(INIT_RETRY_2_MS);
    expect(result.current.actionState).toBe(EBuyActionState.WebFallback);

    mockFetchOnramperSession.mockResolvedValue({
      sessionId: 'session',
      sessionToken: 'token',
    });
    await act(async () => {
      result.current.retryInit();
    });

    expect(result.current.canRetryInit).toBe(false);
    expect(result.current.errorMessage).toBeUndefined();
    expect(logged('initRetryPressed')).toHaveLength(1);

    await advance(QUOTE_DEBOUNCE_MS);
    expect(result.current.actionState).toBe(EBuyActionState.Ready);
  });

  it('does not retry on its own when the backend rejects the session for this build', async () => {
    mockInitialize.mockRejectedValue(SESSION_REJECTED);
    const { result } = await renderCheckout();

    expect(result.current.actionState).toBe(EBuyActionState.WebFallback);
    // The user may still try: a retry is cheap and a new session is minted.
    expect(result.current.canRetryInit).toBe(true);

    await advance(60_000);
    expect(mockFetchOnramperSession).toHaveBeenCalledTimes(1);
  });

  it('offers no retry for a structural init failure', async () => {
    mockInitialize.mockRejectedValue({ code: 'deviceBlocked' });
    const { result } = await renderCheckout();

    expect(result.current.actionState).toBe(EBuyActionState.WebFallback);
    expect(result.current.canRetryInit).toBe(false);

    await advance(60_000);
    expect(mockFetchOnramperSession).toHaveBeenCalledTimes(1);
  });

  // The SDK also publishes a `failed` event for an init failure, before or
  // after initialize() rejects; it used to replace the fallback with a Retry
  // button that could not re-initialize.
  it('lets the init path, not the SDK failed event, decide what an init failure shows', async () => {
    mockInitialize.mockRejectedValue(SESSION_REJECTED);
    const { result } = await renderCheckout();
    expect(result.current.actionState).toBe(EBuyActionState.WebFallback);

    publishFailed({
      errorCode: 'initializationFailed',
      message: SESSION_REJECTED.message,
    });

    expect(result.current.actionState).toBe(EBuyActionState.WebFallback);
    expect(result.current.canRetryInit).toBe(true);
  });

  it('keeps preparing when the SDK failed event lands during a pending retry', async () => {
    mockInitialize
      .mockRejectedValueOnce({ code: 'initializationFailed' })
      .mockResolvedValueOnce(undefined);
    const { result } = await renderCheckout();

    publishFailed({ errorCode: 'initializationFailed' });
    expect(result.current.actionState).toBe(EBuyActionState.Preparing);
    expect(result.current.errorMessage).toBeUndefined();
  });

  it('stops retrying once the page is closed', async () => {
    mockFetchOnramperSession.mockRejectedValue(new Error('Network error'));
    const { unmount } = await renderCheckout();

    unmount();
    await advance(60_000);

    expect(mockFetchOnramperSession).toHaveBeenCalledTimes(1);
  });
});

describe('useOnramperCheckout quote retry', () => {
  it('retries a transient quote failure once without showing it', async () => {
    mockGetCheckoutRequirements
      .mockRejectedValueOnce({ code: 'temporaryFailure', message: '50001' })
      .mockResolvedValueOnce({ button: 'button', quote: QUOTE });
    const { result } = await renderCheckout();

    await advance(QUOTE_DEBOUNCE_MS);
    expect(result.current.actionState).toBe(EBuyActionState.Preparing);
    expect(result.current.errorMessage).toBeUndefined();

    await advance(QUOTE_RETRY_MS);
    expect(mockGetCheckoutRequirements).toHaveBeenCalledTimes(2);
    expect(result.current.actionState).toBe(EBuyActionState.Ready);
    expect(logged('quoteFailed')).toEqual([
      expect.objectContaining({ attempt: 1, retryInMs: QUOTE_RETRY_MS }),
    ]);
    expect(logged('quoteResolved')).toEqual([
      expect.objectContaining({ attempt: 2 }),
    ]);
  });

  it('shows the failure when the retry fails too', async () => {
    mockGetCheckoutRequirements.mockRejectedValue({
      code: 'temporaryFailure',
      message: '50001',
    });
    const { result } = await renderCheckout();

    await advance(QUOTE_DEBOUNCE_MS);
    await advance(QUOTE_RETRY_MS);

    expect(result.current.actionState).toBe(EBuyActionState.RetryableError);
    expect(result.current.errorCode).toBe('temporaryFailure');

    await advance(60_000);
    expect(mockGetCheckoutRequirements).toHaveBeenCalledTimes(2);
  });

  it('shows a quote the provider cannot give right away', async () => {
    mockGetCheckoutRequirements.mockRejectedValue({
      code: 'quoteUnavailable',
      message: '40003',
    });
    const { result } = await renderCheckout();

    await advance(QUOTE_DEBOUNCE_MS);

    expect(result.current.actionState).toBe(EBuyActionState.RetryableError);
    expect(result.current.errorCode).toBe('quoteUnavailable');
    expect(mockGetCheckoutRequirements).toHaveBeenCalledTimes(1);
  });

  it('drops the pending retry when the amount changes', async () => {
    mockGetCheckoutRequirements
      .mockRejectedValueOnce({ code: 'networkError', message: 'offline' })
      .mockResolvedValueOnce({ button: 'button', quote: QUOTE });
    const { result, rerender } = await renderCheckout();
    await advance(QUOTE_DEBOUNCE_MS);
    expect(mockGetCheckoutRequirements).toHaveBeenCalledTimes(1);

    rerender({ amount: 100 });
    await advance(QUOTE_DEBOUNCE_MS);
    await advance(QUOTE_RETRY_MS);

    // One request for the new amount; the old amount is not asked again.
    expect(mockGetCheckoutRequirements).toHaveBeenCalledTimes(2);
    expect(result.current.actionState).toBe(EBuyActionState.Ready);
  });
});

describe('useOnramperCheckout slow wait', () => {
  it('says it is still working when init keeps the user waiting', async () => {
    mockIsMockClient = false;
    mockFetchOnramperSession.mockImplementation(NEVER);
    const { result } = await renderCheckout();

    await advance(SLOW_HINT_MS - 1);
    expect(result.current.isTakingLong).toBe(false);

    await advance(1);
    expect(result.current.isTakingLong).toBe(true);
    expect(logged('waitingHintShown')).toEqual([
      expect.objectContaining({ stage: 'init' }),
    ]);
  });

  it('says so for a slow quote and stops once the quote lands', async () => {
    let resolveQuote:
      | ((value: { button: string; quote: IOnramperQuote }) => void)
      | undefined;
    mockGetCheckoutRequirements.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveQuote = resolve;
        }),
    );
    const { result } = await renderCheckout();

    await advance(SLOW_HINT_MS);
    expect(result.current.isTakingLong).toBe(true);
    expect(logged('waitingHintShown')).toEqual([
      expect.objectContaining({ stage: 'quote' }),
    ]);

    await act(async () => {
      resolveQuote?.({ button: 'button', quote: QUOTE });
    });
    expect(result.current.actionState).toBe(EBuyActionState.Ready);
    expect(result.current.isTakingLong).toBe(false);
  });

  // Entering the page with an amount, the user watches one wait: the init,
  // then the first quote. The request going out must not take the line away.
  it('keeps saying so while a slow init hands over to its first quote', async () => {
    mockIsMockClient = false;
    mockFetchOnramperSession.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(
            () => resolve({ sessionId: 'session', sessionToken: 'token' }),
            SLOW_HINT_MS + 1000,
          );
        }),
    );
    mockGetCheckoutRequirements.mockImplementation(NEVER);
    const { result } = await renderCheckout();

    await advance(SLOW_HINT_MS);
    expect(result.current.isTakingLong).toBe(true);

    // The init completes, then the debounced first request goes out.
    await advance(1000);
    await advance(QUOTE_DEBOUNCE_MS);
    expect(mockGetCheckoutRequirements).toHaveBeenCalledTimes(1);
    expect(result.current.actionState).toBe(EBuyActionState.Preparing);
    expect(result.current.isTakingLong).toBe(true);
  });

  it('keeps quiet while there is no amount to wait for', async () => {
    mockIsMockClient = false;
    mockFetchOnramperSession.mockImplementation(NEVER);
    const { result } = await renderCheckout({ amount: 0 });

    await advance(SLOW_HINT_MS * 2);

    expect(result.current.isTakingLong).toBe(false);
  });

  it('counts from the latest quote request, not from the first keystroke', async () => {
    mockGetCheckoutRequirements.mockImplementation(NEVER);
    const { result, rerender } = await renderCheckout();

    await advance(SLOW_HINT_MS - 1000);
    rerender({ amount: 100 });
    await advance(SLOW_HINT_MS - 1000);
    expect(result.current.isTakingLong).toBe(false);

    await advance(1000);
    expect(result.current.isTakingLong).toBe(true);
  });

  it('keeps counting through the retries of a slow init', async () => {
    mockIsMockClient = false;
    mockFetchOnramperSession.mockRejectedValue(new Error('Network error'));
    mockInitialize.mockImplementation(NEVER);
    mockFetchOnramperSession
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValue({ sessionId: 'session', sessionToken: 'token' });
    const { result } = await renderCheckout();

    await advance(INIT_RETRY_1_MS);
    await advance(SLOW_HINT_MS - INIT_RETRY_1_MS);

    expect(result.current.isTakingLong).toBe(true);
  });
});

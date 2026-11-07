/** @jest-environment jsdom */
/* eslint-disable import/first */

import { act, renderHook } from '@testing-library/react';

const mockStore = new Map<string, boolean>();
let mockStateListener: ((state: IOnramperState) => void) | undefined;
let mockFailedListener: ((event: IOnramperEvent) => void) | undefined;
const mockSignOut = jest.fn<Promise<void>, []>();
// A mock client skips the session mint; a real one mints, then initializes.
let mockIsMockClient = true;
const mockFetchOnramperSession = jest.fn<Promise<IOnramperSession>, []>();
const mockInitialize = jest.fn<Promise<void>, []>();
const mockGetCheckoutRequirements = jest.fn<
  Promise<{ button: string; quote: IOnramperQuote }>,
  []
>();

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
    syncStorage: {
      getBoolean: (key: string) => mockStore.get(key),
      set: (key: string, value: boolean) => {
        mockStore.set(key, value);
      },
    },
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
    addStateListener: (listener: (state: IOnramperState) => void) => {
      mockStateListener = listener;
      return () => {};
    },
    reset: async () => {},
    signOut: mockSignOut,
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
      onramper: new Proxy({}, { get: () => () => undefined }),
    },
  },
}));

import type {
  IOnramperEvent,
  IOnramperQuote,
  IOnramperSession,
  IOnramperState,
} from '@onekeyhq/shared/src/modules3rdParty/onramper';
import { EAppSyncStorageKeys } from '@onekeyhq/shared/src/storage/syncStorageKeys';

import { EBuyActionState } from './types';
import { useOnramperCheckout } from './useOnramperCheckout';

const KEY = EAppSyncStorageKeys.onekey_onramper_id_signed_in;

const BUTTON_STYLE = {
  backgroundColor: '#000000',
  foregroundColor: '#ffffff',
  borderRadius: 8,
};

async function renderCheckout({ amount = 0 }: { amount?: number } = {}) {
  const rendered = renderHook(() =>
    useOnramperCheckout({
      amount,
      isAmountValid: amount > 0,
      source: 'usd',
      destination: 'eth',
      network: 'ethereum',
      address: '0x0',
      buttonStyle: BUTTON_STYLE,
      onCompleted: () => {},
    }),
  );
  // Let the client initialize.
  await act(async () => {});
  return rendered;
}

function publishState(state: IOnramperState) {
  act(() => mockStateListener?.(state));
}

function publishFailed(event: IOnramperEvent) {
  act(() => mockFailedListener?.({ type: 'failed', ...event }));
}

// A checkout prepared for a user the SDK holds no login for.
const LOGIN_FROM_NOTHING: IOnramperState = {
  kind: 'requireLogin',
  requirementTypes: ['tos', 'user_info'],
  hasVerifiedUserInfo: false,
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

// Runs the timers due within `ms` and lets the promises they start settle.
async function advance(ms: number) {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
}

const QUOTE_DEBOUNCE_MS = 400;
// refreshQuote defers the SDK reset past the unmount frames.
const REFRESH_DEFER_MS = 64;
// A transient quote failure is retried once after this back-off.
const QUOTE_RETRY_MS = 1000;

// A failed init is retried twice (1 s, then 2 s) before the page gives up.
async function exhaustInitRetries() {
  await advance(1000);
  await advance(2000);
}

beforeEach(() => {
  jest.useFakeTimers();
  mockStore.clear();
  mockStateListener = undefined;
  mockFailedListener = undefined;
  mockSignOut.mockReset();
  mockSignOut.mockResolvedValue(undefined);
  mockIsMockClient = true;
  mockFetchOnramperSession.mockReset();
  mockFetchOnramperSession.mockResolvedValue({
    sessionId: 'session',
    sessionToken: 'token',
  });
  mockInitialize.mockReset();
  mockInitialize.mockResolvedValue(undefined);
  mockGetCheckoutRequirements.mockReset();
});

afterEach(() => {
  // The unmount defers the client teardown on a timer.
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

describe('useOnramperCheckout OnramperID login state', () => {
  it('does not offer sign-out while the login is unknown and nothing failed', async () => {
    const { result } = await renderCheckout();
    expect(result.current.canSignOut).toBe(false);
  });

  it('starts from the login remembered on this install', async () => {
    mockStore.set(KEY, true);
    const { result } = await renderCheckout();
    expect(result.current.canSignOut).toBe(true);
  });

  it('follows the prepared checkout and remembers it', async () => {
    const { result } = await renderCheckout();

    publishState({ kind: 'checkoutPreparing' });
    expect(result.current.canSignOut).toBe(false);

    publishState({ kind: 'readyToCheckout' });
    expect(result.current.canSignOut).toBe(true);
    expect(mockStore.get(KEY)).toBe(true);

    // Re-quoting and a failure say nothing about the login.
    publishState({ kind: 'checkoutPreparing' });
    publishState({ kind: 'failed' });
    expect(result.current.canSignOut).toBe(true);

    // Neither does a login that only re-verifies the known user.
    publishState({
      kind: 'requireLogin',
      requirementTypes: ['reverification'],
    });
    expect(result.current.canSignOut).toBe(true);

    publishState(LOGIN_FROM_NOTHING);
    expect(result.current.canSignOut).toBe(false);
    expect(mockStore.get(KEY)).toBe(false);
  });

  // The checkout was prepared as a login from nothing, so that is all a
  // prepared checkout ever said; the login then happens inside the button.
  it('learns a login made through the checkout button, and keeps it when the payment fails', async () => {
    mockGetCheckoutRequirements.mockResolvedValueOnce({
      button: 'button-1',
      quote: QUOTE,
    });
    const { result } = await renderCheckout({ amount: 50 });
    await advance(QUOTE_DEBOUNCE_MS);
    publishState(LOGIN_FROM_NOTHING);
    expect(result.current.actionState).toBe(EBuyActionState.Ready);
    expect(result.current.canSignOut).toBe(false);

    // Opening the OnramperID flow is not a login yet.
    publishState({ kind: 'authenticating' });
    expect(result.current.canSignOut).toBe(false);

    publishState({ kind: 'finalizing' });
    expect(result.current.canSignOut).toBe(true);
    expect(mockStore.get(KEY)).toBe(true);

    publishState({ kind: 'failed', errorCode: 'paymentFailed' });
    publishFailed({ errorCode: 'paymentFailed', message: 'declined' });

    expect(result.current.actionState).toBe(EBuyActionState.RetryableError);
    expect(result.current.canSignOut).toBe(true);
    expect(mockStore.get(KEY)).toBe(true);
  });

  it('stays signed out when the login made through the button is abandoned', async () => {
    mockGetCheckoutRequirements
      .mockResolvedValueOnce({ button: 'button-1', quote: QUOTE })
      .mockResolvedValueOnce({ button: 'button-2', quote: QUOTE });
    const { result } = await renderCheckout({ amount: 50 });
    await advance(QUOTE_DEBOUNCE_MS);
    publishState(LOGIN_FROM_NOTHING);

    publishState({ kind: 'authenticating' });
    publishState({ kind: 'failed', errorCode: 'oidcFlowCancelled' });
    publishFailed({ errorCode: 'oidcFlowCancelled' });

    // Closing the sign-in is not a failure: no error, a fresh checkout instead
    // of the spent one.
    expect(result.current.actionState).toBe(EBuyActionState.Preparing);
    expect(result.current.errorMessage).toBeUndefined();
    expect(result.current.nativeButton).toBeNull();
    expect(result.current.canSignOut).toBe(false);
    expect(mockStore.get(KEY)).toBe(false);

    await advance(REFRESH_DEFER_MS);
    await advance(QUOTE_DEBOUNCE_MS);
    expect(result.current.actionState).toBe(EBuyActionState.Ready);
    expect(result.current.nativeButton).toBe('button-2');
  });

  it('re-prepares once after an expired quote, then shows the error if it repeats', async () => {
    mockGetCheckoutRequirements
      .mockResolvedValueOnce({ button: 'button-1', quote: QUOTE })
      .mockResolvedValueOnce({ button: 'button-2', quote: QUOTE })
      .mockResolvedValueOnce({ button: 'button-3', quote: QUOTE });
    const { result } = await renderCheckout({ amount: 50 });
    await advance(QUOTE_DEBOUNCE_MS);
    expect(result.current.nativeButton).toBe('button-1');

    // Tapped after the intent expired: nothing for the user to decide.
    publishFailed({ errorCode: 'intentInvalidated' });
    expect(result.current.actionState).toBe(EBuyActionState.Preparing);
    expect(result.current.errorMessage).toBeUndefined();

    await advance(REFRESH_DEFER_MS);
    await advance(QUOTE_DEBOUNCE_MS);
    expect(result.current.actionState).toBe(EBuyActionState.Ready);
    expect(result.current.nativeButton).toBe('button-2');

    // A landed quote re-arms the quiet recovery.
    publishFailed({ errorCode: 'intentAlreadyConsumed' });
    expect(result.current.actionState).toBe(EBuyActionState.Preparing);

    await advance(REFRESH_DEFER_MS);
    await advance(QUOTE_DEBOUNCE_MS);
    expect(result.current.nativeButton).toBe('button-3');
  });

  it('shows the error when a self-healing failure repeats before any quote lands', async () => {
    mockGetCheckoutRequirements
      .mockResolvedValueOnce({ button: 'button-1', quote: QUOTE })
      .mockRejectedValueOnce({ code: 'invalidState', message: 'busy' });
    const { result } = await renderCheckout({ amount: 50 });
    await advance(QUOTE_DEBOUNCE_MS);

    publishFailed({ errorCode: 'invalidStateTransition' });
    expect(result.current.actionState).toBe(EBuyActionState.Preparing);

    await advance(REFRESH_DEFER_MS);
    await advance(QUOTE_DEBOUNCE_MS);
    expect(result.current.actionState).toBe(EBuyActionState.RetryableError);
    expect(result.current.errorMessage).toBeDefined();
  });

  it('signs out once the SDK dropped the login', async () => {
    mockStore.set(KEY, true);
    const { result } = await renderCheckout();

    await act(() => result.current.signOut());

    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(result.current.canSignOut).toBe(false);
    expect(mockStore.get(KEY)).toBe(false);
  });

  it('keeps the login when the sign-out fails', async () => {
    mockStore.set(KEY, true);
    mockSignOut.mockRejectedValue(new Error('clientDestroyed'));
    const { result } = await renderCheckout();

    await act(async () => {
      await expect(result.current.signOut()).rejects.toThrow('clientDestroyed');
    });

    expect(result.current.canSignOut).toBe(true);
    expect(mockStore.get(KEY)).toBe(true);
  });
});

// No login was ever reported on this install: a fresh one, or one that signed
// in on a build that did not record it. The Keychain may hold a login, and a
// failure leaves no prepared checkout to say so.
describe('useOnramperCheckout sign-out with an unknown login', () => {
  it('offers sign-out when the session mint fails', async () => {
    mockIsMockClient = false;
    mockFetchOnramperSession.mockRejectedValue(new Error('mint failed'));
    const { result } = await renderCheckout({ amount: 50 });
    await exhaustInitRetries();

    expect(result.current.actionState).toBe(EBuyActionState.WebFallback);
    expect(result.current.canSignOut).toBe(true);

    // One sign-out settles it: the action is not left to be pressed again.
    await act(() => result.current.signOut());

    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(result.current.canSignOut).toBe(false);
    expect(mockStore.get(KEY)).toBe(false);
    expect(result.current.actionState).toBe(EBuyActionState.WebFallback);
  });

  it('offers sign-out when the client fails to initialize', async () => {
    mockIsMockClient = false;
    mockInitialize.mockRejectedValue({ code: 'initializationFailed' });
    const { result } = await renderCheckout({ amount: 50 });
    await exhaustInitRetries();

    expect(result.current.actionState).toBe(EBuyActionState.WebFallback);
    expect(result.current.canSignOut).toBe(true);
  });

  it('offers sign-out when the first quote fails, until a checkout reports the login', async () => {
    mockGetCheckoutRequirements
      .mockRejectedValueOnce({ code: 'networkError', message: 'offline' })
      .mockRejectedValueOnce({ code: 'networkError', message: 'offline' })
      .mockResolvedValueOnce({ button: 'button-1', quote: QUOTE });
    const { result } = await renderCheckout({ amount: 50 });
    expect(result.current.canSignOut).toBe(false);

    // The quote and its one automatic retry both fail.
    await advance(QUOTE_DEBOUNCE_MS);
    await advance(QUOTE_RETRY_MS);
    expect(result.current.actionState).toBe(EBuyActionState.RetryableError);
    expect(result.current.canSignOut).toBe(true);

    act(() => {
      result.current.retry();
    });
    await advance(REFRESH_DEFER_MS);
    await advance(QUOTE_DEBOUNCE_MS);
    publishState(LOGIN_FROM_NOTHING);

    expect(result.current.actionState).toBe(EBuyActionState.Ready);
    expect(result.current.canSignOut).toBe(false);
  });

  it('keeps sign-out hidden on a failure once the login is known to be gone', async () => {
    mockStore.set(KEY, false);
    mockIsMockClient = false;
    mockFetchOnramperSession.mockRejectedValue(new Error('mint failed'));
    const { result } = await renderCheckout({ amount: 50 });
    await exhaustInitRetries();

    expect(result.current.actionState).toBe(EBuyActionState.WebFallback);
    expect(result.current.canSignOut).toBe(false);
  });
});

// signOut() makes the SDK discard its prepared checkout: the mounted button
// stops responding and a quote still in flight rejects.
describe('useOnramperCheckout sign-out', () => {
  it('prepares a new checkout in place of the one the SDK discarded', async () => {
    mockGetCheckoutRequirements
      .mockResolvedValueOnce({ button: 'button-1', quote: QUOTE })
      .mockResolvedValueOnce({ button: 'button-2', quote: QUOTE });
    const { result } = await renderCheckout({ amount: 50 });
    await advance(QUOTE_DEBOUNCE_MS);
    expect(result.current.actionState).toBe(EBuyActionState.Ready);
    expect(result.current.nativeButton).toBe('button-1');

    await act(() => result.current.signOut());

    // The dead button is gone at once, not left for a tap to find out.
    expect(result.current.nativeButton).toBeNull();
    expect(result.current.actionState).toBe(EBuyActionState.Preparing);

    await advance(REFRESH_DEFER_MS);
    await advance(QUOTE_DEBOUNCE_MS);
    expect(mockGetCheckoutRequirements).toHaveBeenCalledTimes(2);
    expect(result.current.actionState).toBe(EBuyActionState.Ready);
    expect(result.current.nativeButton).toBe('button-2');
  });

  it('does not report the quote the sign-out made obsolete as an error', async () => {
    let rejectObsolete: ((error: unknown) => void) | undefined;
    mockGetCheckoutRequirements
      .mockImplementationOnce(
        () =>
          new Promise((_resolve, reject) => {
            rejectObsolete = reject;
          }),
      )
      .mockResolvedValueOnce({ button: 'button-2', quote: QUOTE });
    const { result } = await renderCheckout({ amount: 50 });
    await advance(QUOTE_DEBOUNCE_MS);
    expect(mockGetCheckoutRequirements).toHaveBeenCalledTimes(1);

    await act(() => result.current.signOut());
    await act(async () => {
      rejectObsolete?.({ code: 'intentInvalidated', message: 'obsolete' });
    });

    expect(result.current.actionState).toBe(EBuyActionState.Preparing);
    expect(result.current.errorMessage).toBeUndefined();

    await advance(REFRESH_DEFER_MS);
    await advance(QUOTE_DEBOUNCE_MS);
    expect(result.current.actionState).toBe(EBuyActionState.Ready);
    expect(result.current.nativeButton).toBe('button-2');
  });

  // The SDK discards the prepared checkout when signOut is called, not when
  // it succeeds.
  it('prepares a new checkout even when the sign-out fails', async () => {
    mockGetCheckoutRequirements
      .mockResolvedValueOnce({ button: 'button-1', quote: QUOTE })
      .mockResolvedValueOnce({ button: 'button-2', quote: QUOTE });
    mockSignOut.mockRejectedValue(new Error('notInitialized'));
    const { result } = await renderCheckout({ amount: 50 });
    await advance(QUOTE_DEBOUNCE_MS);

    await act(async () => {
      await expect(result.current.signOut()).rejects.toThrow('notInitialized');
    });
    await advance(REFRESH_DEFER_MS);
    await advance(QUOTE_DEBOUNCE_MS);

    expect(result.current.nativeButton).toBe('button-2');
  });
});

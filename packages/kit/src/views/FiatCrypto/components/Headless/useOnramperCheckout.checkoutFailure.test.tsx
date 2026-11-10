/** @jest-environment jsdom */
/* eslint-disable import/first */

import { act, renderHook } from '@testing-library/react';

const mockListeners = new Map<string, (event: IOnramperEvent) => void>();
const mockCheckoutFailed = jest.fn();

jest.mock('@onekeyhq/shared/src/locale/appLocale', () => ({
  appLocale: {
    getLocale: () => 'en-US',
    // Message ids stand in for copy: these tests check which line is shown.
    intl: { formatMessage: ({ id }: { id: string }) => id },
  },
}));

jest.mock('@onekeyhq/shared/src/modules3rdParty/onramper', () => ({
  ...jest.requireActual<
    typeof import('@onekeyhq/shared/src/modules3rdParty/onramper/utils')
  >('@onekeyhq/shared/src/modules3rdParty/onramper/utils'),
  ONRAMPER_EVENT_NAMES: [
    'renderingStarted',
    'providerReady',
    'providerError',
    'failed',
  ],
  getOnramperConfig: () => ({}),
  createOnramperClient: () => ({
    // Skips the session mint; the checkout event stream is what is under test.
    isMock: true,
    initialize: async () => {},
    addEventListener: (
      name: string,
      listener: (event: IOnramperEvent) => void,
    ) => {
      mockListeners.set(name, listener);
      return () => {};
    },
    addStateListener: () => () => {},
    reset: async () => {},
    destroy: () => {},
  }),
}));

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  __esModule: true,
  defaultLogger: {
    fiatCrypto: {
      onramper: new Proxy(
        {},
        {
          get: (_target, key) =>
            key === 'checkoutFailed' ? mockCheckoutFailed : () => undefined,
        },
      ),
    },
  },
}));

import type {
  IOnramperEvent,
  IOnramperEventName,
} from '@onekeyhq/shared/src/modules3rdParty/onramper';

import { EBuyActionState } from './types';
import { useOnramperCheckout } from './useOnramperCheckout';

const BUTTON_STYLE = {
  backgroundColor: '#000000',
  foregroundColor: '#ffffff',
  borderRadius: 8,
};

// Coinbase's payment-page event for a failed payment authorization, as the
// SDK forwards it in `providerError.reason`.
const COMMIT_ERROR = 'onramp_api.commit_error';

async function renderCheckout() {
  const onCheckoutAbandoned = jest.fn();
  const rendered = renderHook(() =>
    useOnramperCheckout({
      // No amount: the quote loop stays idle, only checkout events run.
      amount: 0,
      isAmountValid: false,
      source: 'usd',
      destination: 'eth',
      network: 'ethereum',
      address: '0x0',
      buttonStyle: BUTTON_STYLE,
      onCompleted: () => {},
      onCheckoutAbandoned,
    }),
  );
  // Let the client initialize.
  await act(async () => {});
  return { ...rendered, onCheckoutAbandoned };
}

function emit(name: IOnramperEventName, event: IOnramperEvent) {
  act(() => mockListeners.get(name)?.({ type: name, ...event }));
}

beforeEach(() => {
  jest.useFakeTimers();
  mockListeners.clear();
  mockCheckoutFailed.mockReset();
});

afterEach(() => {
  // retry() and the unmount both defer SDK calls on timers.
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

describe('useOnramperCheckout checkout failures', () => {
  it('reports a Coinbase commit error as a failed payment, not an unknown outcome', async () => {
    const { result, onCheckoutAbandoned } = await renderCheckout();

    emit('providerError', { transactionId: 'tx1', reason: COMMIT_ERROR });
    emit('failed', {
      transactionId: 'tx1',
      errorCode: 'providerFailed',
      message: 'Payment authorization failed. Please try again.',
    });

    expect(onCheckoutAbandoned).toHaveBeenCalledTimes(1);
    expect(onCheckoutAbandoned).toHaveBeenCalledWith(
      'tx1',
      'authorizationFailed',
    );
    expect(result.current.actionState).toBe(EBuyActionState.RetryableError);
    expect(result.current.errorCode).toBe('paymentFailed');
    expect(result.current.errorMessage).toContain(
      'buy_error_payment_failed__msg',
    );
    // A definite failure: the user may retry in place.
    expect(result.current.unknownOutcomeTransactionId).toBeUndefined();
    // The log keeps what the SDK said, plus the page reason behind it.
    expect(mockCheckoutFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCode: 'providerFailed',
        providerReason: COMMIT_ERROR,
        transactionId: 'tx1',
      }),
    );
  });

  it('keeps a provider failure with no page reason as outcome unknown and names its order', async () => {
    const { result, onCheckoutAbandoned } = await renderCheckout();

    emit('failed', {
      transactionId: 'tx2',
      errorCode: 'providerFailed',
      message: 'We could not confirm your payment status.',
    });

    expect(onCheckoutAbandoned).toHaveBeenCalledWith('tx2', 'providerFailed');
    expect(result.current.actionState).toBe(EBuyActionState.RetryableError);
    expect(result.current.errorCode).toBe('providerFailed');
    expect(result.current.errorMessage).toContain(
      'buy_error_payment_unknown__msg',
    );
    expect(result.current.unknownOutcomeTransactionId).toBe('tx2');
    expect(mockCheckoutFailed.mock.calls[0][0].providerReason).toBeUndefined();
  });

  it('does not carry a commit error over to another transaction', async () => {
    const { result, onCheckoutAbandoned } = await renderCheckout();

    emit('providerError', { transactionId: 'tx1', reason: COMMIT_ERROR });
    emit('failed', { transactionId: 'tx2', errorCode: 'providerFailed' });

    expect(onCheckoutAbandoned).toHaveBeenCalledWith('tx2', 'providerFailed');
    expect(result.current.unknownOutcomeTransactionId).toBe('tx2');
  });

  it('uses a commit error once: a later failure of the same transaction is judged on its own', async () => {
    const { onCheckoutAbandoned } = await renderCheckout();

    emit('providerError', { transactionId: 'tx1', reason: COMMIT_ERROR });
    emit('failed', { transactionId: 'tx1', errorCode: 'providerFailed' });
    emit('failed', { transactionId: 'tx1', errorCode: 'providerFailed' });

    expect(onCheckoutAbandoned.mock.calls).toEqual([
      ['tx1', 'authorizationFailed'],
      ['tx1', 'providerFailed'],
    ]);
  });

  it('names no order for an ordinary failure', async () => {
    const { result, onCheckoutAbandoned } = await renderCheckout();

    emit('failed', { transactionId: 'tx3', errorCode: 'networkError' });

    expect(onCheckoutAbandoned).toHaveBeenCalledWith('tx3', 'failed');
    expect(result.current.errorCode).toBe('networkError');
    expect(result.current.unknownOutcomeTransactionId).toBeUndefined();
  });

  it('stops naming the unknown-outcome order once the user moves on', async () => {
    const { result } = await renderCheckout();

    emit('failed', { transactionId: 'tx2', errorCode: 'providerFailed' });
    expect(result.current.unknownOutcomeTransactionId).toBe('tx2');

    act(() => result.current.refreshQuote());
    expect(result.current.unknownOutcomeTransactionId).toBeUndefined();

    // The checkout it left is spent: a late failure of it is logged, not
    // shown over whatever the page prepares next.
    emit('failed', { transactionId: 'tx2', errorCode: 'networkError' });
    expect(result.current.actionState).toBe(EBuyActionState.Preparing);
    expect(result.current.unknownOutcomeTransactionId).toBeUndefined();
  });

  // The payment may have gone through, and nothing a later failure of the
  // same checkout says can settle that: it must not bring the one-tap retry
  // back, nor replace the copy that sends the user to the order.
  it('keeps sending the user to the order when another failure of the same checkout follows', async () => {
    const { result } = await renderCheckout();

    emit('failed', { transactionId: 'tx2', errorCode: 'providerFailed' });
    emit('failed', {
      transactionId: 'tx2',
      errorCode: 'sessionExpirationHandlerFailed',
    });

    expect(result.current.actionState).toBe(EBuyActionState.RetryableError);
    expect(result.current.unknownOutcomeTransactionId).toBe('tx2');
    expect(result.current.errorCode).toBe('providerFailed');
    expect(result.current.errorMessage).toContain(
      'buy_error_payment_unknown__msg',
    );
    // Logged, and marked as not shown.
    expect(mockCheckoutFailed).toHaveBeenLastCalledWith(
      expect.objectContaining({
        errorCode: 'sessionExpirationHandlerFailed',
        stale: true,
      }),
    );
  });

  it('keeps sending the user to the order when a structural failure follows in the same tick', async () => {
    const { result } = await renderCheckout();

    act(() => {
      mockListeners.get('failed')?.({
        type: 'failed',
        transactionId: 'tx2',
        errorCode: 'providerFailed',
      });
      mockListeners.get('failed')?.({
        type: 'failed',
        transactionId: 'tx2',
        errorCode: 'deviceBlocked',
      });
    });

    expect(result.current.actionState).toBe(EBuyActionState.RetryableError);
    expect(result.current.unknownOutcomeTransactionId).toBe('tx2');
  });

  // OK-66774, device-observed on Paybis: the web view failed on an SSL error
  // before the page came up, and the SDK filed it under "outcome unknown".
  it('reports a payment page that never loaded as a plain failure the user can retry', async () => {
    const { result, onCheckoutAbandoned } = await renderCheckout();

    emit('renderingStarted', { transactionId: 'tx4', renderType: 'webview' });
    emit('failed', {
      transactionId: 'tx4',
      errorCode: 'providerFailed',
      supportCode: 'providerFailed:NSURLErrorDomain/-1200',
    });

    // The service drops the record: no order is left as Processing.
    expect(onCheckoutAbandoned).toHaveBeenCalledTimes(1);
    expect(onCheckoutAbandoned).toHaveBeenCalledWith('tx4', 'pageLoadFailed');
    expect(result.current.actionState).toBe(EBuyActionState.RetryableError);
    expect(result.current.errorCode).toBe('webviewLoadFailed');
    expect(result.current.errorMessage).toContain(
      'buy_error_payment_page__msg',
    );
    expect(result.current.unknownOutcomeTransactionId).toBeUndefined();
    // The log keeps what the SDK said, plus what the verdict was based on.
    expect(mockCheckoutFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCode: 'providerFailed',
        abandonReason: 'pageLoadFailed',
        renderType: 'webview',
        paymentSurfaceReached: false,
        transactionId: 'tx4',
      }),
    );
  });

  it('keeps the outcome unknown when the payment page had come up before the failure', async () => {
    const { result, onCheckoutAbandoned } = await renderCheckout();

    emit('renderingStarted', { transactionId: 'tx5', renderType: 'webview' });
    emit('providerReady', { transactionId: 'tx5' });
    emit('failed', { transactionId: 'tx5', errorCode: 'providerFailed' });

    expect(onCheckoutAbandoned).toHaveBeenCalledWith('tx5', 'providerFailed');
    expect(result.current.errorCode).toBe('providerFailed');
    expect(result.current.unknownOutcomeTransactionId).toBe('tx5');
    expect(mockCheckoutFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        abandonReason: 'providerFailed',
        paymentSurfaceReached: true,
      }),
    );
  });

  it('does not carry the progress of one transaction over to the next', async () => {
    const { result, onCheckoutAbandoned } = await renderCheckout();

    // tx6 came up; tx7 only started rendering.
    emit('renderingStarted', { transactionId: 'tx6', renderType: 'webview' });
    emit('providerReady', { transactionId: 'tx6' });
    emit('renderingStarted', { transactionId: 'tx7', renderType: 'webview' });
    emit('failed', { transactionId: 'tx7', errorCode: 'providerFailed' });

    expect(onCheckoutAbandoned).toHaveBeenCalledWith('tx7', 'pageLoadFailed');
    expect(result.current.unknownOutcomeTransactionId).toBeUndefined();
  });
});

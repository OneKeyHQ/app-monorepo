/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';

import type {
  IOnramperEvent,
  IOnramperEventListener,
  IOnramperEventName,
} from '@onekeyhq/shared/src/modules3rdParty/onramper';
import { acquireReplayPause } from '@onekeyhq/shared/src/modules3rdParty/posthog/replayGate';

import { useOnramperCheckout } from './useOnramperCheckout';

const mockListeners = new Map<IOnramperEventName, IOnramperEventListener>();
const mockReleasePause = jest.fn();

jest.mock('@onekeyhq/shared/src/modules3rdParty/onramper', () => {
  const actual = jest.requireActual<
    typeof import('@onekeyhq/shared/src/modules3rdParty/onramper')
  >('@onekeyhq/shared/src/modules3rdParty/onramper');
  return {
    ...actual,
    getOnramperConfig: () => ({
      apiKey: '',
      clientId: '',
      environment: 'development',
    }),
    createOnramperClient: () => ({
      isMock: true,
      initialize: () => Promise.resolve(),
      getCheckoutRequirements: () => new Promise(() => {}),
      addEventListener: (
        name: IOnramperEventName,
        listener: IOnramperEventListener,
      ) => {
        mockListeners.set(name, listener);
        return () => mockListeners.delete(name);
      },
      addStateListener: () => () => {},
      reset: () => Promise.resolve(),
      signOut: () => Promise.resolve(),
      destroy: () => {},
    }),
  };
});

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceFiatCrypto: {
      fetchOnramperSession: jest.fn(),
    },
  },
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => {
  const noop = () => {};
  const deepNoop: unknown = new Proxy(noop, {
    get: () => deepNoop,
    apply: () => undefined,
  });
  return { defaultLogger: deepNoop };
});

jest.mock('@onekeyhq/shared/src/modules3rdParty/posthog/replayGate', () => ({
  acquireReplayPause: jest.fn(() => mockReleasePause),
}));

const mockAcquireReplayPause = acquireReplayPause as jest.Mock;

const emit = (name: IOnramperEventName, event: IOnramperEvent = {}) => {
  act(() => {
    mockListeners.get(name)?.({ type: name, ...event });
  });
};

const renderCheckout = async () => {
  const result = renderHook(() =>
    useOnramperCheckout({
      amount: 0,
      isAmountValid: false,
      source: 'usd',
      destination: 'usdt_ethereum',
      network: 'ethereum',
      address: undefined,
      buttonStyle: {
        backgroundColor: '#000000',
        foregroundColor: '#ffffff',
        borderRadius: 12,
      },
      onCompleted: jest.fn(),
    }),
  );
  // Let the mock client finish initializing.
  await act(async () => {
    await Promise.resolve();
  });
  return result;
};

describe('useOnramperCheckout session replay pause', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockListeners.clear();
  });

  it('pauses once for the provider UI and resumes when the checkout ends', async () => {
    await renderCheckout();
    expect(mockListeners.size).toBeGreaterThan(0);
    expect(mockAcquireReplayPause).not.toHaveBeenCalled();

    emit('checkoutStarted');
    emit('loginRequired');
    emit('renderingStarted');
    emit('providerReady');
    expect(mockAcquireReplayPause).toHaveBeenCalledTimes(1);
    expect(mockAcquireReplayPause).toHaveBeenCalledWith('onramperCheckout');

    emit('paymentCancelled');
    emit('providerError');
    expect(mockReleasePause).not.toHaveBeenCalled();

    emit('cancelled', { transactionId: 'tx-1' });
    expect(mockReleasePause).toHaveBeenCalledTimes(1);

    emit('challengeStarted');
    expect(mockAcquireReplayPause).toHaveBeenCalledTimes(2);
    emit('paymentPending', { transactionId: 'tx-2' });
    expect(mockReleasePause).toHaveBeenCalledTimes(2);
  });

  it('does not pause for quote-only events', async () => {
    await renderCheckout();
    emit('readyToCheckout');
    emit('requirementSatisfied');
    emit('checkoutFinalized');
    expect(mockAcquireReplayPause).not.toHaveBeenCalled();
  });

  it('releases a pending pause when the page unmounts', async () => {
    const { unmount } = await renderCheckout();
    emit('customerOnboardingRequired');
    expect(mockAcquireReplayPause).toHaveBeenCalledTimes(1);
    unmount();
    expect(mockReleasePause).toHaveBeenCalledTimes(1);
  });
});

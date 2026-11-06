/** @jest-environment jsdom */
/* eslint-disable import/first */

import { act, renderHook } from '@testing-library/react';

const mockStore = new Map<string, boolean>();
let mockStateListener: ((state: IOnramperState) => void) | undefined;
const mockSignOut = jest.fn<Promise<void>, []>();

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
  ONRAMPER_EVENT_NAMES: [],
  getOnramperConfig: () => ({}),
  createOnramperClient: () => ({
    // Skips the session mint; the state stream below is what is under test.
    isMock: true,
    initialize: async () => {},
    getCheckoutRequirements: jest.fn(),
    addEventListener: () => () => {},
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
  default: {},
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  __esModule: true,
  defaultLogger: {
    fiatCrypto: {
      onramper: new Proxy({}, { get: () => () => undefined }),
    },
  },
}));

import type { IOnramperState } from '@onekeyhq/shared/src/modules3rdParty/onramper';
import { EAppSyncStorageKeys } from '@onekeyhq/shared/src/storage/syncStorageKeys';

import { useOnramperCheckout } from './useOnramperCheckout';

const KEY = EAppSyncStorageKeys.onekey_onramper_id_signed_in;

const BUTTON_STYLE = {
  backgroundColor: '#000000',
  foregroundColor: '#ffffff',
  borderRadius: 8,
};

async function renderCheckout() {
  const rendered = renderHook(() =>
    useOnramperCheckout({
      amount: 0,
      isAmountValid: false,
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

// A checkout prepared for a user the SDK holds no login for.
const LOGIN_FROM_NOTHING: IOnramperState = {
  kind: 'requireLogin',
  requirementTypes: ['tos', 'user_info'],
  hasVerifiedUserInfo: false,
};

describe('useOnramperCheckout OnramperID login state', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockStore.clear();
    mockStateListener = undefined;
    mockSignOut.mockReset();
    mockSignOut.mockResolvedValue(undefined);
  });

  afterEach(() => {
    // The unmount defers the client teardown on a timer.
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('starts signed out when no login was ever reported', async () => {
    const { result } = await renderCheckout();
    expect(result.current.isSignedIn).toBe(false);
  });

  it('starts from the login remembered on this install', async () => {
    mockStore.set(KEY, true);
    const { result } = await renderCheckout();
    expect(result.current.isSignedIn).toBe(true);
  });

  it('follows the prepared checkout and remembers it', async () => {
    const { result } = await renderCheckout();

    publishState({ kind: 'checkoutPreparing' });
    expect(result.current.isSignedIn).toBe(false);

    publishState({ kind: 'readyToCheckout' });
    expect(result.current.isSignedIn).toBe(true);
    expect(mockStore.get(KEY)).toBe(true);

    // Re-quoting and paying say nothing about the login.
    publishState({ kind: 'checkoutPreparing' });
    publishState({ kind: 'finalizing' });
    publishState({ kind: 'failed' });
    expect(result.current.isSignedIn).toBe(true);

    // Neither does a login that only re-verifies the known user.
    publishState({
      kind: 'requireLogin',
      requirementTypes: ['reverification'],
    });
    expect(result.current.isSignedIn).toBe(true);

    publishState(LOGIN_FROM_NOTHING);
    expect(result.current.isSignedIn).toBe(false);
    expect(mockStore.get(KEY)).toBe(false);
  });

  it('signs out once the SDK dropped the login', async () => {
    mockStore.set(KEY, true);
    const { result } = await renderCheckout();

    await act(() => result.current.signOut());

    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(result.current.isSignedIn).toBe(false);
    expect(mockStore.get(KEY)).toBe(false);
  });

  it('keeps the login when the sign-out fails', async () => {
    mockStore.set(KEY, true);
    mockSignOut.mockRejectedValue(new Error('clientDestroyed'));
    const { result } = await renderCheckout();

    await act(async () => {
      await expect(result.current.signOut()).rejects.toThrow('clientDestroyed');
    });

    expect(result.current.isSignedIn).toBe(true);
    expect(mockStore.get(KEY)).toBe(true);
  });
});

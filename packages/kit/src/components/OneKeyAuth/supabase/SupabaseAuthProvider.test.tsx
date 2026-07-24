/** @jest-environment jsdom */
/* eslint-disable import/first, import-js/order */

import type { Session } from '@supabase/supabase-js';

const mockLegacySession = {
  access_token: 'legacy-access-token',
  refresh_token: 'legacy-refresh-token',
  user: {
    id: 'legacy-user',
    email: 'legacy@example.com',
  },
} as Session;
const mockKeylessSession = {
  access_token: 'keyless-access-token',
  refresh_token: 'keyless-refresh-token',
  user: {
    id: 'keyless-user',
    email: 'keyless@example.com',
  },
} as Session;

const mockGetAuthSessionSource = jest.fn<Promise<unknown>, []>();
const mockStorageGetItem = jest.fn<Promise<string | null>, [string]>();
const mockLegacyGetSession = jest.fn<
  Promise<{ data: { session: Session | null }; error: null }>,
  []
>();
const mockKeylessGetSession = jest.fn<
  Promise<{ data: { session: Session | null }; error: null }>,
  []
>();
const mockLegacyUnsubscribe = jest.fn();
const mockKeylessUnsubscribe = jest.fn();
const mockLegacyOnAuthStateChange = jest.fn(() => ({
  data: {
    subscription: {
      unsubscribe: mockLegacyUnsubscribe,
    },
  },
}));
const mockKeylessOnAuthStateChange = jest.fn(() => ({
  data: {
    subscription: {
      unsubscribe: mockKeylessUnsubscribe,
    },
  },
}));
let mockIsTokenRefreshRuntime = false;

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    simpleDb: {
      prime: {
        getAuthSessionSource: () => mockGetAuthSessionSource(),
      },
    },
  },
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms/prime', () => ({
  usePrimePersistAtom: () => [{ isLoggedIn: true }, jest.fn()],
}));

jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: {
    PrimeAuthSessionSourceCommitted: 'PrimeAuthSessionSourceCommitted',
    KeylessAuthSessionCleared: 'KeylessAuthSessionCleared',
    PrimeLoginInvalidToken: 'PrimeLoginInvalidToken',
  },
  appEventBus: {
    on: jest.fn(),
    off: jest.fn(),
  },
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    app: {
      appUpdate: {
        log: jest.fn(),
      },
    },
  },
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isWeb: false,
    isNativeMainThread: true,
    enableNativeBackgroundThread: true,
  },
}));

jest.mock('@onekeyhq/shared/src/storage/SupabaseStorage/consts', () => ({
  getSupabaseAuthSessionKey: () => 'legacy-session-key',
  getKeylessSupabaseAuthSessionKey: () => 'keyless-session-key',
}));

jest.mock('@onekeyhq/shared/src/utils/supabaseClientUtils', () => ({
  getSupabaseClient: () => ({
    client: {
      auth: {
        getSession: () => mockLegacyGetSession(),
        onAuthStateChange: mockLegacyOnAuthStateChange,
      },
    },
    storage: {
      getItem: (key: string) => mockStorageGetItem(key),
    },
  }),
  getKeylessSupabaseClient: () => ({
    client: {
      auth: {
        getSession: () => mockKeylessGetSession(),
        onAuthStateChange: mockKeylessOnAuthStateChange,
      },
    },
  }),
  isSupabaseTokenRefreshRuntime: () => mockIsTokenRefreshRuntime,
}));

import { render, screen, waitFor } from '@testing-library/react';

import { EPrimeAuthSessionSource } from '@onekeyhq/shared/types/prime/primeTypes';

import { useSupabaseAuthContext } from './SupabaseAuthContext';
import SupabaseAuthProvider from './SupabaseAuthProvider';

function SessionProbe() {
  const { session, isLoading, isLoggedIn } = useSupabaseAuthContext();
  return (
    <div data-testid="session-probe">
      {`${String(isLoading)}:${String(isLoggedIn)}:${
        session?.user.email ?? 'none'
      }`}
    </div>
  );
}

describe('SupabaseAuthProvider runtime subscriptions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsTokenRefreshRuntime = false;
    mockGetAuthSessionSource.mockResolvedValue(
      EPrimeAuthSessionSource.LegacyEmailSupabase,
    );
    mockStorageGetItem.mockImplementation(async (key: string) => {
      if (key === 'legacy-session-key') {
        return JSON.stringify(mockLegacySession);
      }
      if (key === 'keyless-session-key') {
        return JSON.stringify(mockKeylessSession);
      }
      return null;
    });
    mockLegacyGetSession.mockResolvedValue({
      data: { session: mockLegacySession },
      error: null,
    });
    mockKeylessGetSession.mockResolvedValue({
      data: { session: mockKeylessSession },
      error: null,
    });
  });

  test('keeps the shared-storage projection without subscribing a Main runtime client', async () => {
    render(
      <SupabaseAuthProvider>
        <SessionProbe />
      </SupabaseAuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('session-probe').textContent).toBe(
        'false:true:legacy@example.com',
      );
    });
    expect(mockLegacyOnAuthStateChange).not.toHaveBeenCalled();
    expect(mockKeylessOnAuthStateChange).not.toHaveBeenCalled();
  });

  test('subscribes and unsubscribes both clients in the token-refresh runtime', async () => {
    mockIsTokenRefreshRuntime = true;
    const { unmount } = render(
      <SupabaseAuthProvider>
        <SessionProbe />
      </SupabaseAuthProvider>,
    );

    await waitFor(() => {
      expect(mockLegacyOnAuthStateChange).toHaveBeenCalledTimes(1);
      expect(mockKeylessOnAuthStateChange).toHaveBeenCalledTimes(1);
    });
    unmount();
    expect(mockLegacyUnsubscribe).toHaveBeenCalledTimes(1);
    expect(mockKeylessUnsubscribe).toHaveBeenCalledTimes(1);
  });
});

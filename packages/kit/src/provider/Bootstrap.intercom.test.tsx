/**
 * @jest-environment jsdom
 */

import React from 'react';

import { act, render } from '@testing-library/react';

let mockUserId: string | null = 'A';
let mockOnUnread: ((count: number) => void) | undefined;
const mockSdk = {
  default: jest.fn(),
  boot: jest.fn(),
  shutdown: jest.fn(),
  onShow: jest.fn(),
  onUnreadCountChange: jest.fn((listener: (count: number) => void) => {
    mockOnUnread = listener;
  }),
  trackEvent: jest.fn(),
  update: jest.fn(),
  show: jest.fn(),
  hide: jest.fn(),
  showConversation: jest.fn(),
};

jest.mock('@intercom/messenger-js-sdk', () => ({
  __esModule: true,
  ...mockSdk,
}));

// Bootstrap imports unrelated startup features; this suite mounts only its
// real Intercom hook and keeps the real session adapter and identity checks.
const unrelatedModules = [
  '@react-navigation/native',
  '@onekeyhq/components',
  '@onekeyhq/desktop/app/config',
  '@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings',
  '@onekeyhq/kit-bg/src/states/jotai/atoms/onboarding',
  '@onekeyhq/kit-bg/src/states/jotai/atoms/passwordLock',
  '@onekeyhq/shared/src/appUpdate',
  '@onekeyhq/shared/src/consts/perp',
  '@onekeyhq/shared/src/errors/utils/errorToastUtils',
  '@onekeyhq/shared/src/eventBus/appEventBus',
  '@onekeyhq/shared/src/locale',
  '@onekeyhq/shared/src/logger/logger',
  '@onekeyhq/shared/src/logger/scopes/perp/perpPageSource',
  '@onekeyhq/shared/src/modules/BootRecovery',
  '@onekeyhq/shared/src/modules/NetworkThrottle',
  '@onekeyhq/shared/src/modules3rdParty/auto-update/electronUpdateListeners',
  '@onekeyhq/shared/src/performance',
  '@onekeyhq/shared/src/performance/collectors/jsBlockCollector',
  '@onekeyhq/shared/src/performance/enabled',
  '@onekeyhq/shared/src/routes',
  '@onekeyhq/shared/src/routes/prime',
  '@onekeyhq/shared/src/routes/root',
  '@onekeyhq/shared/src/shortcuts/shortcuts.enum',
  '@onekeyhq/shared/src/spotlight',
  '@onekeyhq/shared/src/storage/instance/devSettingSyncStorageInstance',
  '@onekeyhq/shared/src/utils/openUrlUtils',
  '@onekeyhq/shared/src/utils/swrCacheUtils',
  '../background/instance/backgroundApiProxy',
  '../components/AccountSelector/AccountSelectorProvider',
  '../components/AppUpdate',
  '../components/SplitViewPrompt',
  '../hooks/useAppNavigation',
  '../hooks/useHandleAppStateActive',
  '../hooks/useOnLock',
  '../hooks/useRunAfterTokensDone',
  '../hooks/useTrayDataProvider',
  './preloadComponents',
  './showAboutDialog',
  './useIPadMainMenu',
];

function createToken(userId: string) {
  return `header.${Buffer.from(JSON.stringify({ user_id: userId })).toString(
    'base64url',
  )}.signature`;
}

describe('Intercom startup identity synchronization', () => {
  let useIntercomInit: typeof import('./Bootstrap').useIntercomInit;
  let intercom: typeof import('@onekeyhq/shared/src/modules3rdParty/intercom');

  function SessionSync() {
    useIntercomInit();
    return null;
  }

  beforeEach(async () => {
    jest.resetModules();
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockUserId = 'A';
    mockOnUnread = undefined;
    delete globalThis.window.Intercom;
    delete globalThis.window.intercomSettings;
    localStorage.clear();
    jest.doMock('react', () => React);
    for (const name of unrelatedModules) {
      jest.doMock(name, () => ({}));
    }
    jest.doMock('../utils/swrCacheMutationInvalidation', () => ({
      registerSwrCacheMutationInvalidation: jest.fn(),
    }));
    jest.doMock(
      '../states/jotai/contexts/tokenList/cells/ownerCacheInvalidation',
      () => ({ registerHomeTokenListOwnerCacheInvalidation: jest.fn() }),
    );
    jest.doMock(
      '../views/Swap/utils/swapTokenSelectorCacheInvalidation',
      () => ({
        registerSwapTokenSelectorCacheInvalidation: jest.fn(),
      }),
    );
    jest.doMock('@onekeyhq/shared/src/platformEnv', () => ({
      __esModule: true,
      default: { isWeb: true },
    }));
    jest.doMock('@onekeyhq/kit-bg/src/states/jotai/atoms/prime', () => ({
      usePrimePersistAtom: () => [
        { onekeyUserId: mockUserId, isLoggedIn: mockUserId !== null },
      ],
    }));
    jest.doMock('../hooks/useThemeVariant', () => ({
      useThemeVariant: () => 'light',
    }));
    jest.doMock('@onekeyhq/shared/src/appGlobals', () => ({
      __esModule: true,
      default: {
        $backgroundApiProxy: {
          servicePrime: {
            getLocalUserInfo: async () => ({
              onekeyUserId: mockUserId,
              isLoggedIn: mockUserId !== null,
            }),
            apiGetCustomerJWT: async () => ({
              token: createToken(`intercom-${mockUserId}`),
            }),
          },
        },
      },
    }));
    jest.doMock('@onekeyhq/shared/src/errors', () => ({
      OneKeyLocalError: Error,
    }));
    jest.doMock(
      '@onekeyhq/shared/src/modules3rdParty/intercom/openFailure',
      () => ({ notifyIntercomOpenFailed: jest.fn() }),
    );
    jest.doMock('@onekeyhq/shared/src/modules3rdParty/intercom/utils', () => ({
      getInstanceId: async () => 'test-instance',
      getIntercomLanguageOverride: async () => 'en',
    }));
    ({ useIntercomInit } = await import('./Bootstrap'));
    intercom = await import('@onekeyhq/shared/src/modules3rdParty/intercom');
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('defers only the first unchanged identity sync and cancels it on unmount', async () => {
    const first = render(<SessionSync />);
    await act(async () => {
      await jest.advanceTimersByTimeAsync(9000);
    });
    expect(mockSdk.default).not.toHaveBeenCalled();
    first.unmount();
    await act(async () => {
      await jest.advanceTimersByTimeAsync(1000);
    });
    expect(mockSdk.default).not.toHaveBeenCalled();

    const second = render(<SessionSync />);
    await act(async () => {
      await jest.advanceTimersByTimeAsync(10_000);
    });
    expect(mockSdk.default).toHaveBeenCalledTimes(1);
    second.unmount();
  });

  it.each([null, 'B'])(
    'retires manually opened A before the initial timer when identity becomes %s',
    async (nextUser) => {
      const screen = render(<SessionSync />);
      await act(async () => {
        await intercom.showIntercom();
        mockOnUnread?.(4);
        await jest.advanceTimersByTimeAsync(0);
      });
      expect(mockSdk.show).toHaveBeenCalledTimes(1);
      expect(intercom.getIntercomUnreadCount()).toBe(4);
      expect(mockSdk.shutdown).not.toHaveBeenCalled();

      mockUserId = nextUser;
      screen.rerender(<SessionSync />);
      await act(async () => {
        await jest.advanceTimersByTimeAsync(0);
      });
      expect(mockSdk.shutdown).toHaveBeenCalledTimes(1);
      expect(intercom.getIntercomUnreadCount()).toBe(0);
      expect(mockSdk.boot).toHaveBeenCalledTimes(1);
      const expectedJwt = nextUser ? createToken('intercom-B') : undefined;
      expect(globalThis.window.intercomSettings?.intercom_user_jwt).toBe(
        expectedJwt,
      );

      await act(async () => {
        await jest.advanceTimersByTimeAsync(10_000);
      });
      expect(mockSdk.shutdown).toHaveBeenCalledTimes(1);
      expect(mockSdk.boot).toHaveBeenCalledTimes(1);
      screen.unmount();
    },
  );
});

/**
 * @jest-environment jsdom
 */

import React from 'react';

import { act, render } from '@testing-library/react';

let mockUserId: string | null = 'A';
const mockInit = jest.fn(async () => {});
jest.mock('@onekeyhq/kit/src/views/Intercom/client', () => ({
  initIntercom: () => mockInit(),
}));

// Bootstrap imports unrelated startup features; this suite mounts only its
// real Intercom hook and observes identity synchronization at its boundary.
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

  function SessionSync() {
    useIntercomInit();
    return null;
  }

  beforeEach(async () => {
    jest.resetModules();
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockUserId = 'A';
    localStorage.clear();
    jest.doMock('react', () => React);
    for (const name of unrelatedModules) {
      jest.doMock(name, () => ({}));
    }
    // The intercom adapter logs routing diagnostics through this scene; the
    // generic unrelated-module mock above would leave `defaultLogger` empty.
    jest.doMock('@onekeyhq/shared/src/logger/logger', () => ({
      defaultLogger: {
        notification: {
          support: {
            supportReplyClicked: jest.fn(),
            supportReplyReceived: jest.fn(),
            supportReplyQueued: jest.fn(),
            supportReplyClaimed: jest.fn(),
            supportReplyBranch: jest.fn(),
          },
        },
      },
    }));
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
    jest.doMock('@onekeyhq/kit-bg/src/states/jotai/atoms/settings', () => ({
      useSettingsPersistAtom: () => [{ theme: 'light' }],
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
    jest.doMock('@onekeyhq/shared/src/utils/getInstanceId', () => ({
      ...jest.requireActual<
        typeof import('@onekeyhq/shared/src/utils/getInstanceId')
      >('@onekeyhq/shared/src/utils/getInstanceId'),
      getInstanceId: async () => 'test-instance',
      getIntercomLanguageOverride: async () => 'en',
    }));
    ({ useIntercomInit } = await import('./Bootstrap'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('defers only the first unchanged identity sync and cancels it on unmount', async () => {
    const first = render(<SessionSync />);
    await act(async () => {
      await jest.advanceTimersByTimeAsync(9000);
    });
    expect(mockInit).not.toHaveBeenCalled();
    first.unmount();
    await act(async () => {
      await jest.advanceTimersByTimeAsync(1000);
    });
    expect(mockInit).not.toHaveBeenCalled();

    const second = render(<SessionSync />);
    await act(async () => {
      await jest.advanceTimersByTimeAsync(10_000);
    });
    expect(mockInit).toHaveBeenCalledTimes(1);
    second.unmount();
  });

  it.each([null, 'B'])(
    'synchronizes identity immediately when it becomes %s before the startup timer',
    async (nextUser) => {
      const screen = render(<SessionSync />);
      mockUserId = nextUser;
      screen.rerender(<SessionSync />);
      await act(async () => {
        await jest.advanceTimersByTimeAsync(0);
      });
      expect(mockInit).toHaveBeenCalledTimes(1);
      await act(async () => {
        await jest.advanceTimersByTimeAsync(10_000);
      });
      expect(mockInit).toHaveBeenCalledTimes(1);
      screen.unmount();
    },
  );
});

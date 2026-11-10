/** @jest-environment jsdom */
import React from 'react';

import { act, cleanup, renderHook } from '@testing-library/react';

import {
  EModalReferFriendsRoutes,
  EModalRoutes,
  ERootRoutes,
  ETabReferFriendsRoutes,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';
import { EFullScreenPushRoutes } from '@onekeyhq/shared/src/routes/fullScreenPush';

import type { useReferFriends } from './useReferFriends';

const mockIsLoggedIn = jest.fn<Promise<boolean>, []>();
const mockPushModal = jest.fn<void, unknown[]>();
const mockNavigate = jest.fn<void, unknown[]>();
const mockDispatch = jest.fn<void, unknown[]>();
const mockLogin = jest.fn<void, unknown[]>();
const mockError = jest.fn<void, unknown[]>();
const mockOpenExtension = jest.fn<Promise<void>, unknown[]>();
const mockCloseExtension = jest.fn<void, unknown[]>();
const mockIntl = { formatMessage: ({ id }: { id: string }) => id };
const mockRouteListeners = new Set<() => void>();
const mockIdentityListeners = new Set<() => void>();
let mockRouteKey = 'source';
let mockRootRoute = {
  name: ERootRoutes.Main,
  params: {} as { screen?: string },
};
let mockIdentity = {
  onekeyUserId: 'user-1',
  isLoggedIn: true,
  isLoggedInOnServer: true,
};
const mockPlatform = {
  isNative: true,
  isExtensionUiPopup: false,
  isExtensionUiSidePanel: false,
};

jest.mock('@react-navigation/native', () => ({
  StackActions: {
    replace: (name: string, params: unknown) => ({
      type: 'REPLACE',
      payload: { name, params },
    }),
  },
}));
jest.mock('react-intl', () => ({ useIntl: () => mockIntl }));
jest.mock('@onekeyhq/components', () => ({
  OverlayCloseCancelledError: class OverlayCloseCancelledError extends Error {},
  Toast: { error: (...args: unknown[]) => mockError(...args) },
  rootNavigationRef: {
    current: {
      getCurrentRoute: () => ({ key: mockRouteKey }),
      getRootState: () => ({ index: 0, routes: [mockRootRoute] }),
      navigate: (...args: unknown[]) => mockNavigate(...args),
      dispatch: (...args: unknown[]) => mockDispatch(...args),
      addListener: (_event: string, listener: () => void) => {
        mockRouteListeners.add(listener);
        return () => mockRouteListeners.delete(listener);
      },
    },
  },
}));
jest.mock('@onekeyhq/shared/src/errors', () => ({
  OneKeyLocalError: Error,
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    servicePrime: { isLoggedIn: () => mockIsLoggedIn() },
    serviceApp: {
      openExtensionExpandTab: (...args: unknown[]) =>
        mockOpenExtension(...args),
    },
  },
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms/prime', () => ({
  primePersistAtom: {
    atom: () => undefined,
    sub: (listener: () => void) => {
      mockIdentityListeners.add(listener);
      return () => mockIdentityListeners.delete(listener);
    },
  },
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/utils/jotaiDefaultStore', () => ({
  jotaiDefaultStore: { get: () => mockIdentity },
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: mockPlatform,
}));
jest.mock('@onekeyhq/shared/src/utils/extUtils', () => ({
  closeExtensionPopupAfterExpandTabOpen: () => mockCloseExtension(),
}));
jest.mock('../components/OneKeyAuth/useOneKeyAuth', () => ({
  useOneKeyAuth: () => ({ loginOneKeyId: mockLogin }),
}));
jest.mock('./useAppNavigation', () => ({
  __esModule: true,
  default: () => ({ pushModal: mockPushModal }),
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

function loadHook() {
  let hook!: typeof useReferFriends;
  // Keep React shared with the renderer while resetting the module's in-flight read.
  jest.doMock('react', () => React);
  jest.isolateModules(() => {
    hook = (
      require('./useReferFriends') as {
        useReferFriends: typeof useReferFriends;
      }
    ).useReferFriends;
  });
  return hook;
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe('referral entry feedback and cancellation', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.resetAllMocks();
    mockRouteListeners.clear();
    mockIdentityListeners.clear();
    mockRouteKey = 'source';
    mockRootRoute = { name: ERootRoutes.Main, params: {} };
    mockIdentity = {
      onekeyUserId: 'user-1',
      isLoggedIn: true,
      isLoggedInOnServer: true,
    };
    Object.assign(mockPlatform, {
      isNative: true,
      isExtensionUiPopup: false,
      isExtensionUiSidePanel: false,
    });
  });
  afterEach(async () => {
    cleanup();
    await flush();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('disables immediately, shows loading after 300ms, and ignores duplicate clicks', async () => {
    const check = deferred<boolean>();
    mockIsLoggedIn.mockReturnValue(check.promise);
    const { result } = renderHook(loadHook());
    act(() => {
      void result.current.toInviteRewardPage();
      void result.current.toInviteRewardPage();
    });
    await flush();
    expect(mockIsLoggedIn).toHaveBeenCalledTimes(1);
    expect(result.current.isReferralEntryPending).toBe(true);
    expect(result.current.isReferralEntryLoading).toBe(false);
    act(() => {
      jest.advanceTimersByTime(299);
    });
    expect(result.current.isReferralEntryLoading).toBe(false);
    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(result.current.isReferralEntryLoading).toBe(true);
    await act(async () => {
      check.resolve(true);
    });
    expect(mockPushModal).toHaveBeenCalledWith(EModalRoutes.ReferFriendsModal, {
      screen: EModalReferFriendsRoutes.InviteReward,
      params: undefined,
    });
    expect(result.current.isReferralEntryPending).toBe(false);
    expect(result.current.isReferralEntryLoading).toBe(false);
  });

  it('navigates quickly without displaying loading', async () => {
    mockIsLoggedIn.mockResolvedValue(true);
    const { result } = renderHook(loadHook());
    await act(async () => {
      await result.current.toReferFriendsPage();
    });
    expect(result.current.isReferralEntryLoading).toBe(false);
    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(result.current.isReferralEntryLoading).toBe(false);
    expect(mockPushModal).toHaveBeenCalledTimes(1);
  });

  it('times out without navigating when the old response eventually arrives', async () => {
    const check = deferred<boolean>();
    mockIsLoggedIn.mockReturnValue(check.promise);
    const { result } = renderHook(loadHook());
    act(() => {
      void result.current.toReferFriendsPage();
    });
    await act(async () => {
      jest.advanceTimersByTime(5000);
    });
    expect(mockError).toHaveBeenCalledTimes(1);
    expect(result.current.isReferralEntryPending).toBe(false);
    await act(async () => {
      check.resolve(true);
    });
    expect(mockPushModal).not.toHaveBeenCalled();
  });

  it('reuses a pending background read when retrying after timeout', async () => {
    const check = deferred<boolean>();
    mockIsLoggedIn.mockReturnValue(check.promise);
    const { result } = renderHook(loadHook());
    act(() => {
      void result.current.toReferFriendsPage();
    });
    await act(async () => {
      jest.advanceTimersByTime(5000);
    });
    act(() => {
      void result.current.toReferFriendsPage();
    });
    await flush();
    expect(mockIsLoggedIn).toHaveBeenCalledTimes(1);
    await act(async () => {
      check.resolve(true);
    });
    expect(mockPushModal).toHaveBeenCalledTimes(1);
  });

  it('restores the entry after rejection and allows a fresh request', async () => {
    const beforeNavigate = jest.fn<Promise<void>, []>().mockResolvedValue();
    mockIsLoggedIn
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(true);
    const hook = loadHook();
    const { result } = renderHook(() => hook({ beforeNavigate }));
    await act(async () => {
      await result.current.toInviteRewardPage();
    });
    expect(mockError).toHaveBeenCalledTimes(1);
    expect(beforeNavigate).not.toHaveBeenCalled();
    expect(result.current.isReferralEntryPending).toBe(false);
    await act(async () => {
      await result.current.toInviteRewardPage();
    });
    expect(mockIsLoggedIn).toHaveBeenCalledTimes(2);
    expect(mockPushModal).toHaveBeenCalledTimes(1);
  });

  it('shares one background check across both visible entry hooks', async () => {
    const check = deferred<boolean>();
    mockIsLoggedIn.mockReturnValue(check.promise);
    const hook = loadHook();
    const first = renderHook(hook);
    const second = renderHook(hook);
    act(() => {
      void first.result.current.toInviteRewardPage();
      void second.result.current.toReferFriendsPage();
    });
    await flush();
    expect(mockIsLoggedIn).toHaveBeenCalledTimes(1);
    first.unmount();
    await act(async () => {
      check.resolve(true);
    });
    expect(mockPushModal).toHaveBeenCalledTimes(1);
  });

  it('preserves the login flow when the reward entry is logged out', async () => {
    mockIsLoggedIn.mockResolvedValue(false);
    const { result } = renderHook(loadHook());
    await act(async () => {
      await result.current.toInviteRewardPage();
    });
    expect(mockLogin).toHaveBeenCalledWith({
      toOneKeyIdPageOnLoginSuccess: false,
    });
    expect(mockPushModal).not.toHaveBeenCalled();
  });

  it('keeps the menu open while checking and closes it before navigation', async () => {
    const check = deferred<boolean>();
    const close = deferred<void>();
    const beforeNavigate = jest.fn(() => close.promise);
    mockIsLoggedIn.mockReturnValue(check.promise);
    const hook = loadHook();
    const { result, rerender } = renderHook(
      ({ open }) => hook({ isEntryActive: open, beforeNavigate }),
      { initialProps: { open: true } },
    );
    act(() => {
      void result.current.toReferFriendsPage({
        tab: 'benefits',
        perksEntry: 'activity_hub',
      });
    });
    await flush();
    expect(beforeNavigate).not.toHaveBeenCalled();
    await act(async () => {
      check.resolve(true);
    });
    expect(beforeNavigate).toHaveBeenCalledTimes(1);
    expect(mockPushModal).not.toHaveBeenCalled();
    rerender({ open: false });
    await act(async () => {
      close.resolve();
    });
    expect(mockPushModal).toHaveBeenCalledWith(EModalRoutes.ReferFriendsModal, {
      screen: EModalReferFriendsRoutes.InviteReward,
      params: { tab: 'benefits', perksEntry: 'activity_hub' },
    });
  });

  it('cancels when the menu closes and can retry after it reopens', async () => {
    const check = deferred<boolean>();
    mockIsLoggedIn.mockReturnValue(check.promise);
    const hook = loadHook();
    const { result, rerender } = renderHook(
      ({ open }) => hook({ isEntryActive: open }),
      { initialProps: { open: true } },
    );
    act(() => {
      void result.current.toReferFriendsPage();
    });
    rerender({ open: false });
    await flush();
    expect(result.current.isReferralEntryPending).toBe(false);
    await act(async () => {
      check.resolve(true);
    });
    expect(mockPushModal).not.toHaveBeenCalled();
    rerender({ open: true });
    mockIsLoggedIn.mockResolvedValueOnce(true);
    await act(async () => {
      await result.current.toReferFriendsPage();
    });
    expect(mockPushModal).toHaveBeenCalledTimes(1);
  });

  it('ignores a response after navigating away', async () => {
    const check = deferred<boolean>();
    mockIsLoggedIn.mockReturnValue(check.promise);
    const { result } = renderHook(loadHook());
    act(() => {
      void result.current.toReferFriendsPage();
    });
    act(() => {
      mockRouteKey = 'different-page';
      mockRouteListeners.forEach((listener) => listener());
    });
    await act(async () => {
      check.resolve(true);
    });
    expect(mockPushModal).not.toHaveBeenCalled();
    expect(mockError).not.toHaveBeenCalled();
  });

  it('invalidates a pending check across logout and login to the same account', async () => {
    const oldCheck = deferred<boolean>();
    const newCheck = deferred<boolean>();
    mockIsLoggedIn
      .mockReturnValueOnce(oldCheck.promise)
      .mockReturnValueOnce(newCheck.promise);
    const { result } = renderHook(loadHook());
    act(() => {
      void result.current.toInviteRewardPage();
    });
    await flush();
    act(() => {
      mockIdentity = { ...mockIdentity, isLoggedIn: false };
      mockIdentityListeners.forEach((listener) => listener());
      mockIdentity = { ...mockIdentity, isLoggedIn: true };
      mockIdentityListeners.forEach((listener) => listener());
    });
    await flush();
    act(() => {
      void result.current.toInviteRewardPage();
    });
    await flush();
    expect(mockIsLoggedIn).toHaveBeenCalledTimes(2);
    await act(async () => {
      oldCheck.resolve(true);
    });
    expect(mockPushModal).not.toHaveBeenCalled();
    await act(async () => {
      newCheck.resolve(true);
    });
    expect(mockPushModal).toHaveBeenCalledTimes(1);
  });

  it('ignores late failures after unmounting', async () => {
    const check = deferred<boolean>();
    mockIsLoggedIn.mockReturnValue(check.promise);
    const { result, unmount } = renderHook(loadHook());
    act(() => {
      void result.current.toInviteRewardPage();
    });
    await flush();
    unmount();
    await act(async () => {
      check.reject(new Error('offline'));
    });
    expect(mockError).not.toHaveBeenCalled();
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('replaces the native More page after checking succeeds', async () => {
    mockRootRoute = {
      name: ERootRoutes.FullScreenPush,
      params: { screen: EFullScreenPushRoutes.ActionCenter },
    };
    mockIsLoggedIn.mockResolvedValue(true);
    const { result } = renderHook(loadHook());
    await act(async () => {
      await result.current.toReferFriendsPage();
    });
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'REPLACE',
      payload: {
        name: ERootRoutes.Modal,
        params: {
          screen: EModalRoutes.ReferFriendsModal,
          params: {
            screen: EModalReferFriendsRoutes.InviteReward,
            params: undefined,
          },
        },
      },
    });
    expect(mockPushModal).not.toHaveBeenCalled();
  });

  it('opens the non-native tab with its original parameters', async () => {
    mockPlatform.isNative = false;
    mockIsLoggedIn.mockResolvedValue(true);
    const { result } = renderHook(loadHook());
    await act(async () => {
      await result.current.toReferFriendsPage({
        tab: 'benefits',
        perksEntry: 'activity_hub',
      });
    });
    expect(mockNavigate).toHaveBeenCalledWith(
      ERootRoutes.Main,
      {
        screen: ETabRoutes.ReferFriends,
        params: {
          screen: ETabReferFriendsRoutes.TabInviteReward,
          params: { tab: 'benefits', perksEntry: 'activity_hub' },
        },
      },
      { pop: true },
    );
  });

  it('opens the extension expanded tab before closing its popup', async () => {
    Object.assign(mockPlatform, { isNative: false, isExtensionUiPopup: true });
    const expanded = deferred<void>();
    mockOpenExtension.mockReturnValue(expanded.promise);
    mockIsLoggedIn.mockResolvedValue(false);
    const { result } = renderHook(loadHook());
    act(() => {
      void result.current.toReferFriendsPage();
    });
    await flush();
    expect(mockOpenExtension).toHaveBeenCalledWith({
      path: '/refer-friends',
      params: undefined,
    });
    expect(mockCloseExtension).not.toHaveBeenCalled();
    await act(async () => {
      expanded.resolve();
    });
    expect(mockCloseExtension).toHaveBeenCalledTimes(1);
  });
});

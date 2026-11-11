/**
 * @jest-environment jsdom
 */

import { IntercomNotificationContainer } from '.';

import { act, render } from '@testing-library/react';

import type { IToastNotificationProps } from '@onekeyhq/components';
import { ELockDuration } from '@onekeyhq/shared/src/consts/appAutoLockConsts';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import type { IIntercomNotification } from '@onekeyhq/shared/src/modules3rdParty/intercom/messengerTypes';
import { presentIntercomSupportUi } from '@onekeyhq/shared/src/modules3rdParty/intercom/supportUi';
import type { IIntercomLockPolicy } from '@onekeyhq/shared/src/modules3rdParty/intercom/utils';
import { ERootRoutes } from '@onekeyhq/shared/src/routes/root';

import { IntercomNotificationContainer as ExtensionContainer } from './index.ext';
import { IntercomNotificationContainer as NativeContainer } from './index.native';
import { IntercomLockGuard } from './IntercomLockGuard';
import { IntercomLockGuard as ExtensionLockGuard } from './IntercomLockGuard.ext';

import type { IIntercomNavigationState } from './visibility';

let mockIsLocked = false;
let mockState: IIntercomNavigationState | undefined;
let mockRouterChange:
  | ((state: IIntercomNavigationState | undefined) => void)
  | undefined;
let mockReady: (() => void) | undefined;
const mockRemoveReady = jest.fn();
const mockNavigate = jest.fn();
let mockLockDuration = 5;
let mockLastActivity = 1234;
const mockSetLocked = jest.fn(
  async (_locked: boolean, _policy?: IIntercomLockPolicy) => {},
);
const mockSetVisibility = jest.fn(async (_visible: boolean) => {});
let mockNotification: IIntercomNotification | undefined;
const mockNotificationListeners = new Set<() => void>();
const mockOpenNotification = jest.fn(async (_id: string) => {});
const mockDismissNotification = jest.fn((_id: string) => {});
const mockRefreshNotifications = jest.fn((_id?: string) => {});
let mockVisibilityChange: ((visible: boolean) => void) | undefined;
const mockRemoveVisibility = jest.fn();
const mockCloseToast = jest.fn();
const mockToast = jest.fn((_props: IToastNotificationProps) => ({
  close: mockCloseToast,
}));
const mockIntl = { formatMessage: ({ id }: { id: string }) => id };

jest.mock('react-intl', () => ({ useIntl: () => mockIntl }));
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    notification: { support: { supportReplyBranch: jest.fn() } },
  },
}));
jest.mock('@onekeyhq/shared/src/utils/appVisibility', () => ({
  getCurrentVisibilityState: () => true,
  onVisibilityStateChange: (listener: (visible: boolean) => void) => {
    mockVisibilityChange = listener;
    return mockRemoveVisibility;
  },
}));

jest.mock('@onekeyhq/components', () => ({
  Button: () => null,
  Toast: { notification: (props: IToastNotificationProps) => mockToast(props) },
  rootNavigationRef: {
    current: {
      isReady: () => !!mockState,
      navigate: (params: unknown) => {
        mockNavigate(params);
      },
      getRootState: () => mockState,
      addListener: (_event: string, callback: () => void) => {
        mockReady = callback;
        return mockRemoveReady;
      },
    },
  },
  useOnRouterChange: (
    callback: (state: IIntercomNavigationState | undefined) => void,
  ) => {
    mockRouterChange = callback;
    // Mirrors the real hook, which syncs once on mount.
    // oxlint-disable-next-line @typescript-eslint/no-require-imports
    const { useEffect } = require('react') as typeof import('react');
    useEffect(() => {
      callback(mockState);
      // oxlint-disable-next-line react-hooks/exhaustive-deps
    }, []);
  },
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms/passwordLock', () => ({
  useAppIsLockedAtom: () => [mockIsLocked],
  usePasswordPersistAtom: () => [
    { isPasswordSet: true, appLockDuration: mockLockDuration },
  ],
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms/settings', () => ({
  useSettingsLastActivityAtom: () => [{ time: mockLastActivity }],
}));
jest.mock('@onekeyhq/shared/src/travelMode', () => ({
  travelModeManager: {
    getRuntimeEnvironmentSync: () => ({ profile: { kind: 'standard' } }),
  },
}));
jest.mock('@onekeyhq/shared/src/modules3rdParty/intercom', () => ({
  setIntercomInAppMessageVisibility: (visible: boolean) =>
    mockSetVisibility(visible),
  setIntercomMessengerLocked: (locked: boolean, policy?: IIntercomLockPolicy) =>
    mockSetLocked(locked, policy),
  getIntercomNotification: () => mockNotification,
  subscribeToIntercomNotifications: (listener: () => void) => {
    mockNotificationListeners.add(listener);
    return () => mockNotificationListeners.delete(listener);
  },
  openIntercomNotification: (id: string) => mockOpenNotification(id),
  dismissIntercomNotification: (id: string) => mockDismissNotification(id),
  refreshIntercomNotifications: (id?: string) => mockRefreshNotifications(id),
}));

const main: IIntercomNavigationState = {
  routes: [{ name: ERootRoutes.Main }],
};

describe('Intercom notification visibility integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsLocked = false;
    mockLockDuration = 5;
    mockLastActivity = 1234;
    mockState = main;
    mockRouterChange = undefined;
    mockReady = undefined;
    mockNotification = undefined;
    mockVisibilityChange = undefined;
  });

  it.each([
    ['web', IntercomNotificationContainer],
    ['native', NativeContainer],
    ['extension', ExtensionContainer],
  ])(
    'registers and cleans up the support presenter on %s',
    (_platform, Container) => {
      const screen = render(<Container />);
      expect(presentIntercomSupportUi({ userId: null })).toBe(true);
      expect(mockNavigate).toHaveBeenCalledWith(
        expect.objectContaining({
          params: expect.objectContaining({
            params: expect.objectContaining({ params: { userId: '' } }),
          }),
        }),
      );
      screen.unmount();
      expect(presentIntercomSupportUi({ userId: null })).toBeUndefined();
    },
  );

  it('waits for navigation readiness before allowing messages', () => {
    mockState = undefined;
    render(<IntercomNotificationContainer />);
    expect(mockSetVisibility).not.toHaveBeenCalledWith(true);
    mockState = main;
    act(() => mockReady?.());
    expect(mockSetVisibility).toHaveBeenLastCalledWith(true);
  });

  it('does not restore on unlock while a modal flow is still open', () => {
    const screen = render(<IntercomNotificationContainer />);
    expect(mockSetVisibility).toHaveBeenLastCalledWith(true);
    mockIsLocked = true;
    screen.rerender(<IntercomNotificationContainer />);
    expect(mockSetVisibility).toHaveBeenLastCalledWith(false);
    act(() => {
      mockRouterChange?.({
        index: 1,
        routes: [{ name: ERootRoutes.Main }, { name: ERootRoutes.Modal }],
      });
    });
    mockIsLocked = false;
    screen.rerender(<IntercomNotificationContainer />);
    expect(mockSetVisibility).toHaveBeenLastCalledWith(false);
    act(() => mockRouterChange?.(main));
    expect(mockSetVisibility).toHaveBeenLastCalledWith(true);
  });

  it('leaves the Messenger lock guard to IntercomLockGuard', () => {
    render(<IntercomNotificationContainer />);
    expect(mockSetLocked).not.toHaveBeenCalled();
  });

  function receiveMessage() {
    act(() => {
      mockNotification = {
        id: '42:reply',
        conversationId: '42',
        author: 'Support agent',
        message: 'A test support reply',
      };
      mockNotificationListeners.forEach((listener) => listener());
    });
  }

  it('opens the exact notification and dismisses it when the user closes the preview', () => {
    render(<IntercomNotificationContainer />);
    receiveMessage();
    expect(mockToast).toHaveBeenCalledTimes(1);
    const props = mockToast.mock.calls[0][0];
    expect(props.message).toBe('A test support reply');
    props.onPress?.();
    expect(mockOpenNotification).toHaveBeenCalledWith('42:reply');
    props.onClose?.();
    expect(mockDismissNotification).toHaveBeenCalledWith('42:reply');
  });

  it.each(['lock', 'modal', 'background'])(
    'removes the preview on %s and does not treat cleanup as a user dismissal',
    (reason) => {
      const screen = render(<IntercomNotificationContainer />);
      receiveMessage();
      if (reason === 'lock') {
        mockIsLocked = true;
        screen.rerender(<IntercomNotificationContainer />);
      } else {
        act(() => {
          if (reason === 'modal')
            mockRouterChange?.({ routes: [{ name: ERootRoutes.Modal }] });
          else mockVisibilityChange?.(false);
        });
      }
      expect(mockCloseToast).toHaveBeenCalledTimes(1);
      expect(mockSetVisibility).toHaveBeenLastCalledWith(false);
      mockToast.mock.calls[0][0].onClose?.();
      expect(mockDismissNotification).not.toHaveBeenCalled();
      receiveMessage();
      expect(mockToast).toHaveBeenCalledTimes(1);
    },
  );

  it('refreshes from cross-runtime push hints and releases its listeners on unmount', () => {
    const screen = render(<IntercomNotificationContainer />);
    act(() => {
      appEventBus.emit(EAppEventBusNames.SupportConversationUpdated, {
        conversationId: '42',
      });
    });
    expect(mockRefreshNotifications).toHaveBeenCalledWith('42');
    screen.unmount();
    appEventBus.emit(EAppEventBusNames.SupportConversationUpdated, {});
    expect(mockRefreshNotifications).toHaveBeenCalledTimes(1);
    expect(mockNotificationListeners.size).toBe(0);
    expect(mockRemoveVisibility).toHaveBeenCalledTimes(1);
  });

  it.each([IntercomLockGuard, ExtensionLockGuard])(
    'forwards the wallet lock state to the Messenger guard (%#)',
    (Guard) => {
      const screen = render(<Guard />);
      expect(mockSetLocked).toHaveBeenLastCalledWith(false, {
        validFromMs: 1234,
        lockAtMs: 1234 + 5 * 60_000,
      });
      mockIsLocked = true;
      screen.rerender(<Guard />);
      expect(mockSetLocked).toHaveBeenLastCalledWith(true, {
        validFromMs: 1234,
        lockAtMs: 1234 + 5 * 60_000,
      });
      mockLastActivity = 5678;
      mockLockDuration = 30;
      screen.rerender(<Guard />);
      expect(mockSetLocked).toHaveBeenLastCalledWith(true, {
        validFromMs: 5678,
        lockAtMs: 5678 + 30 * 60_000,
      });
      mockLockDuration = Number(ELockDuration.Never);
      screen.rerender(<Guard />);
      expect(mockSetLocked).toHaveBeenLastCalledWith(true, {
        validFromMs: 0,
        lockAtMs: Number.MAX_VALUE,
      });
    },
  );
});

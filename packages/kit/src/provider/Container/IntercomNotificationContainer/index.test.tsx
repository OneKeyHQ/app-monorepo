/**
 * @jest-environment jsdom
 */

import { IntercomNotificationContainer } from '.';

import { act, render } from '@testing-library/react';

import type { IIntercomLockPolicy } from '@onekeyhq/shared/src/modules3rdParty/intercom/utils';
import { ELockDuration } from '@onekeyhq/shared/src/consts/appAutoLockConsts';
import { ERootRoutes } from '@onekeyhq/shared/src/routes/root';

import type { IIntercomNavigationState } from './visibility';

let mockIsLocked = false;
let mockState: IIntercomNavigationState | undefined;
let mockRouterChange:
  | ((state: IIntercomNavigationState | undefined) => void)
  | undefined;
let mockReady: (() => void) | undefined;
const mockRemoveReady = jest.fn();
let mockLockDuration = 5;
let mockLastActivity = 1234;
const mockSetLocked = jest.fn(
  async (_locked: boolean, _policy?: IIntercomLockPolicy) => {},
);
const mockSetVisibility = jest.fn(async (_visible: boolean) => {});

jest.mock('@onekeyhq/components', () => ({
  rootNavigationRef: {
    current: {
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
}));

const main: IIntercomNavigationState = {
  routes: [{ name: ERootRoutes.Main }],
};

describe('Intercom notification visibility integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsLocked = false;
    mockState = main;
    mockRouterChange = undefined;
    mockReady = undefined;
  });

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

  it('forwards the wallet lock state to the Messenger guard', () => {
    const screen = render(<IntercomNotificationContainer />);
    expect(mockSetLocked).toHaveBeenLastCalledWith(false, {
      validFromMs: 1234,
      lockAtMs: 1234 + 5 * 60_000,
    });
    mockIsLocked = true;
    screen.rerender(<IntercomNotificationContainer />);
    expect(mockSetLocked).toHaveBeenLastCalledWith(true, {
      validFromMs: 1234,
      lockAtMs: 1234 + 5 * 60_000,
    });
    mockLastActivity = 5678;
    mockLockDuration = 30;
    screen.rerender(<IntercomNotificationContainer />);
    expect(mockSetLocked).toHaveBeenLastCalledWith(true, {
      validFromMs: 5678,
      lockAtMs: 5678 + 30 * 60_000,
    });
    mockLockDuration = Number(ELockDuration.Never);
    screen.rerender(<IntercomNotificationContainer />);
    expect(mockSetLocked).toHaveBeenLastCalledWith(true, {
      validFromMs: 0,
      lockAtMs: Number.MAX_VALUE,
    });
  });
});

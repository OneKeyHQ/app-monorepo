/**
 * @jest-environment jsdom
 */

import { IntercomNotificationContainer } from '.';

import { act, render } from '@testing-library/react';

import { ERootRoutes } from '@onekeyhq/shared/src/routes/root';

import type { IIntercomNavigationState } from './visibility';

let mockIsLocked = false;
let mockState: IIntercomNavigationState | undefined;
let mockRouterChange:
  | ((state: IIntercomNavigationState | undefined) => void)
  | undefined;
let mockReady: (() => void) | undefined;
const mockRemoveReady = jest.fn();
const mockSetVisibility = jest.fn(async (_visible: boolean) => {});
const mockSetForeground = jest.fn(
  async (_params: { isForeground: boolean }) => {},
);
const mockRemoveVisibility = jest.fn();
let mockVisibilityChange: ((visible: boolean) => void) | undefined;

jest.mock('../../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceNotification: {
      setSupportNotificationForeground: (params: { isForeground: boolean }) =>
        mockSetForeground(params),
    },
  },
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNativeMainThread: true },
}));
jest.mock('@onekeyhq/shared/src/utils/appVisibility', () => ({
  getCurrentVisibilityState: () => true,
  onVisibilityStateChange: (callback: (visible: boolean) => void) => {
    mockVisibilityChange = callback;
    return mockRemoveVisibility;
  },
}));

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
  },
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms/passwordLock', () => ({
  useAppIsLockedAtom: () => [mockIsLocked],
}));
jest.mock('@onekeyhq/shared/src/modules3rdParty/intercom', () => ({
  setIntercomInAppMessageVisibility: (visible: boolean) =>
    mockSetVisibility(visible),
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
    mockVisibilityChange = undefined;
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

  it('hides messages and removes the readiness listener on unmount', () => {
    const screen = render(<IntercomNotificationContainer />);
    expect(mockSetVisibility).toHaveBeenLastCalledWith(true);
    screen.unmount();
    expect(mockSetVisibility).toHaveBeenLastCalledWith(false);
    expect(mockRemoveReady).toHaveBeenCalledTimes(1);
    expect(mockRemoveVisibility).toHaveBeenCalledTimes(1);
    expect(mockSetForeground).toHaveBeenLastCalledWith({ isForeground: false });
  });

  it('relays foreground changes independently of lock and signing scenes', () => {
    const screen = render(<IntercomNotificationContainer />);
    expect(mockSetForeground).toHaveBeenLastCalledWith({ isForeground: true });
    mockIsLocked = true;
    screen.rerender(<IntercomNotificationContainer />);
    expect(mockSetVisibility).toHaveBeenLastCalledWith(false);
    expect(mockSetForeground).toHaveBeenLastCalledWith({ isForeground: true });
    act(() => mockVisibilityChange?.(false));
    expect(mockSetForeground).toHaveBeenLastCalledWith({ isForeground: false });
    act(() => mockVisibilityChange?.(true));
    expect(mockSetForeground).toHaveBeenLastCalledWith({ isForeground: true });
  });
});

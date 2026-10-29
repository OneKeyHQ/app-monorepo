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
  });
});

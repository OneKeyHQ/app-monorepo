/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';

import {
  useAppExitPrevent,
  useModalExitPrevent,
} from './usePrimeTransferHooks';

type IRemoveEvent = { data: { action: { type: string } } };
type IConfirmation = { onConfirm: () => Promise<void>; onClose: () => void };
let mockRemove: (event: IRemoveEvent) => void;
let mockBack: () => boolean;
let mockAlertButtons: { onPress?: () => Promise<void> | void }[];
const mockDialogs: IConfirmation[] = [];
const mockDispatch = jest.fn<void, [unknown]>();
const mockNavigation = { dispatch: jest.fn(), popStack: jest.fn() };
const mockIntl = { formatMessage: ({ id }: { id: string }) => id };

jest.mock('react-intl', () => ({ useIntl: () => mockIntl }));
jest.mock('react-native', () => ({
  Alert: {
    alert: (
      _title: string,
      _message: string,
      buttons: typeof mockAlertButtons,
    ) => {
      mockAlertButtons = buttons;
    },
  },
  BackHandler: {
    addEventListener: (_event: string, callback: () => boolean) => {
      mockBack = callback;
      return { remove: jest.fn() };
    },
  },
}));
jest.mock('@onekeyhq/components', () => ({
  Dialog: { show: (props: IConfirmation) => mockDialogs.push(props) },
  rootNavigationRef: {
    current: { dispatch: (action: unknown) => mockDispatch(action) },
  },
  usePreventRemove: (_prevent: boolean, callback: typeof mockRemove) => {
    mockRemove = callback;
  },
}));
jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => mockNavigation,
}));
jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocused: () => true,
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isRuntimeBrowser: false },
}));

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockDialogs.length = 0;
});
afterEach(async () => {
  mockDialogs.forEach((dialog) => dialog.onClose());
  await act(async () => {
    jest.runOnlyPendingTimers();
  });
  jest.useRealTimers();
});

test.each([true, false])(
  'modal exit respects the cleanup owner result: %s',
  async (allowed) => {
    const confirm = jest.fn(async () => allowed);
    const current = jest.fn(async () => true);
    renderHook(() =>
      useModalExitPrevent({
        title: 'Exit',
        message: 'Exit?',
        onConfirm: confirm,
        isExitCurrent: current,
      }),
    );
    act(() => mockRemove({ data: { action: { type: 'GO_BACK' } } }));
    await act(async () => mockDialogs[0].onConfirm());
    await act(async () => {
      jest.advanceTimersByTime(0);
    });
    expect(mockDispatch).toHaveBeenCalledTimes(allowed ? 1 : 0);
    expect(current).toHaveBeenCalledTimes(allowed ? 1 : 0);
  },
);

test('a modal replay retains the old owner and rejects replacement before navigation', async () => {
  let current = true;
  const oldOwner = jest.fn(async () => current);
  const replacementOwner = jest.fn(async () => true);
  const { rerender } = renderHook(
    ({ isExitCurrent }) =>
      useModalExitPrevent({
        title: 'Exit',
        message: 'Exit?',
        onConfirm: async () => true,
        isExitCurrent,
      }),
    { initialProps: { isExitCurrent: oldOwner } },
  );
  act(() => mockRemove({ data: { action: { type: 'GO_BACK' } } }));
  await act(async () => mockDialogs[0].onConfirm());
  current = false;
  rerender({ isExitCurrent: replacementOwner });
  await act(async () => {
    jest.advanceTimersByTime(0);
  });
  expect(oldOwner).toHaveBeenCalledTimes(1);
  expect(replacementOwner).not.toHaveBeenCalled();
  expect(mockDispatch).not.toHaveBeenCalled();
});

test.each([
  { allowed: false, current: true },
  { allowed: true, current: false },
  { allowed: true, current: true },
])(
  'Android exit checks cleanup and ownership before popping: %p',
  async ({ allowed, current }) => {
    renderHook(() =>
      useAppExitPrevent({
        title: 'Exit',
        message: 'Exit?',
        onConfirm: async () => allowed,
        isExitCurrent: async () => current,
      }),
    );
    act(() => {
      mockBack();
    });
    await act(async () => mockAlertButtons[1].onPress?.());
    expect(mockNavigation.popStack).toHaveBeenCalledTimes(
      allowed && current ? 1 : 0,
    );
  },
);

test('callers without ownership callbacks retain their existing exit behavior', async () => {
  renderHook(() => useAppExitPrevent({ title: 'Exit', message: 'Exit?' }));
  act(() => {
    mockBack();
  });
  await act(async () => mockAlertButtons[1].onPress?.());
  expect(mockNavigation.popStack).toHaveBeenCalledTimes(1);
});

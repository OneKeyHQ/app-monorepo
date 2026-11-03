/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { act, fireEvent, render, screen } from '@testing-library/react';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  dismissNativeStorageRecovery,
  getRequestedNativeStorageRecovery,
  subscribeNativeStorageRecovery,
} from '@onekeyhq/shared/src/storage/nativeStorageRecovery';
import {
  type INativeAppStorageMigrationStatus,
  createNativeStorageMigrationInconsistentErrorMessage,
} from '@onekeyhq/shared/src/storage/nativeStorageTypes';
import { APP_STATE_LOCK_Z_INDEX } from '@onekeyhq/shared/src/utils/overlayUtils';

import AppStateLock from './AppStateLock';

let mockIOS = true;
let mockAppState = 'active';
const mockAppStateListeners = new Set<(state: string) => void>();
const mockInspect = jest.fn<
  Promise<INativeAppStorageMigrationStatus>,
  [unknown]
>();
const mockPasswordService = jest.fn(() => {
  throw new OneKeyLocalError('The recovery UI must not call password services');
});
type IViewProps = {
  children?: ReactNode;
  testID?: string;
  zIndex?: number;
  onPress?: () => void;
};
function TestView({ children, testID, zIndex }: IViewProps) {
  return (
    <div data-testid={testID} data-zindex={zIndex}>
      {children}
    </div>
  );
}
function TestButton({ children, testID, onPress }: IViewProps) {
  return (
    <button type="button" data-testid={testID} onClick={onPress}>
      {children}
    </button>
  );
}

jest.mock('@onekeyhq/components', () => ({
  Stack: TestView,
  XStack: TestView,
  YStack: TestView,
  ThemeableStack: TestView,
  SizableText: TestView,
  ScrollView: TestView,
  Heading: TestView,
  Button: TestButton,
  Image: () => null,
  Icon: () => null,
  DesktopDragZoneBox: () => null,
  Keyboard: { dismiss: jest.fn() },
  useSafeAreaInsets: () => ({ top: 24, bottom: 0 }),
  useKeyboardEventWithoutNavigation: () => {},
  updateHeightWhenKeyboardHide: () => 0,
  updateHeightWhenKeyboardShown: () => 0,
  OverlayContainer: ({ children }: IViewProps) => (
    <div data-testid="native-window">{children}</div>
  ),
  Portal: {
    Container: () => null,
    Constant: { APP_STATE_LOCK_CONTAINER_OVERLAY: 'lock' },
  },
}));
jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: () => 'Retry' }),
}));
jest.mock('react-native', () => ({
  Dimensions: { get: () => ({ height: 800 }) },
  AppState: {
    get currentState() {
      return mockAppState;
    },
    addEventListener: (_event: string, listener: (state: string) => void) => {
      mockAppStateListeners.add(listener);
      return { remove: () => mockAppStateListeners.delete(listener) };
    },
  },
}));
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: { View: TestView },
  useSharedValue: (value: number) => ({ value }),
  useAnimatedStyle: (fn: () => unknown) => fn(),
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isNative: true,
    get isNativeIOS() {
      return mockIOS;
    },
  },
}));
jest.mock('@onekeyhq/shared/src/lazyLoad', () => ({
  __esModule: true,
  default: () => () => null,
}));
jest.mock('@onekeyhq/shared/src/biologyAuth', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('@onekeyhq/shared/src/webAuth', () => ({
  verifiedWebAuth: jest.fn(),
}));
jest.mock('@onekeyhq/kit/src/components/MultipleClickStack', () => ({
  MultipleClickStack: TestView,
}));
jest.mock('@onekeyhq/kit/src/views/Setting/hooks', () => ({
  useResetApp: () => jest.fn(),
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms/passwordLock', () => ({
  usePasswordPersistAtom: () => [{}],
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms/v4migration', () => ({
  useV4migrationAtom: () => [{}],
}));
jest.mock('@onekeyhq/shared/src/storage/nativeStorageBridge', () => ({
  callNativeStorage: (request: unknown) => mockInspect(request),
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: { servicePassword: mockPasswordService },
}));
jest.mock('./NativeStorageLockRecovery', () =>
  jest.requireActual<typeof import('./NativeStorageLockRecovery.native')>(
    './NativeStorageLockRecovery.native',
  ),
);
jest.mock('./AppStateContainer', () => ({
  AppStateContainer: ({ children }: IViewProps) => {
    const { AppStateContainer: Component } = mockIOS
      ? jest.requireActual<typeof import('./AppStateContainer/index.ios')>(
          './AppStateContainer/index.ios',
        )
      : jest.requireActual<typeof import('./AppStateContainer/index.android')>(
          './AppStateContainer/index.android',
        );
    return <Component>{children}</Component>;
  },
}));

const diagnostic =
  createNativeStorageMigrationInconsistentErrorMessage('appStorage');
function Lock() {
  return (
    <AppStateLock
      lockContainerRef={null}
      passwordVerifyContainer={<input data-testid="password" />}
    />
  );
}
async function settle() {
  await act(async () => {
    await Promise.resolve();
  });
}
async function poll() {
  await act(async () => {
    jest.advanceTimersByTime(3000);
    await Promise.resolve();
  });
}

describe.each(['ios', 'android'])('native lock recovery on %s', (platform) => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockIOS = platform === 'ios';
    mockAppState = 'active';
    mockInspect.mockReset();
    mockInspect.mockResolvedValue({ errorMessage: diagnostic });
    mockPasswordService.mockClear();
    dismissNativeStorageRecovery();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('shows the original diagnostic below the input and a toast in the actual lock layer without DetailRouter', async () => {
    render(<Lock />);
    await settle();
    expect(mockInspect).toHaveBeenCalledWith({
      scope: 'recovery',
      operation: 'inspectAppStorageMigration',
    });
    const input = screen.getByTestId('password');
    const error = screen.getByTestId('lock-storage-error');
    expect(input.parentElement?.contains(error)).toBe(true);
    expect(error.textContent).toContain(diagnostic);
    const lock = screen.getByTestId('unlock-screen');
    const toast = screen.getByTestId('lock-storage-toast');
    expect(lock.contains(toast)).toBe(true);
    expect(lock.getAttribute('data-zindex')).toBe(
      String(APP_STATE_LOCK_Z_INDEX),
    );
    if (mockIOS)
      expect(screen.getByTestId('native-window').contains(toast)).toBe(true);
    await act(async () => {
      jest.advanceTimersByTime(5000);
    });
    expect(screen.queryByTestId('lock-storage-toast')).toBeNull();
    expect(screen.getByTestId('lock-storage-repair')).toBeTruthy();
    expect(mockPasswordService).not.toHaveBeenCalled();
  });

  it.each(['lock-storage-repair', 'native-storage-repair-toast-action'])(
    'opens only the public repair screen from %s, including rapid retry',
    async (testID) => {
      const requests = jest.fn();
      const unsubscribe = subscribeNativeStorageRecovery(requests);
      render(<Lock />);
      await settle();
      const button = screen.getByTestId(testID);
      fireEvent.click(button);
      fireEvent.click(button);
      expect(getRequestedNativeStorageRecovery()).toBe('appStorage');
      expect(requests).toHaveBeenCalledTimes(1);
      expect(mockPasswordService).not.toHaveBeenCalled();
      unsubscribe();
    },
  );

  it('retries delayed cold-start transport and does not diagnose password or transport errors', async () => {
    mockInspect
      .mockRejectedValueOnce(new OneKeyLocalError('transport not installed'))
      .mockRejectedValueOnce(new OneKeyLocalError('WrongPassword'))
      .mockResolvedValueOnce({ errorMessage: 'incorrect password' });
    render(<Lock />);
    await settle();
    expect(screen.queryByTestId('lock-storage-error')).toBeNull();
    await poll();
    expect(screen.queryByTestId('lock-storage-error')).toBeNull();
    await poll();
    expect(screen.queryByTestId('lock-storage-error')).toBeNull();
    await poll();
    expect(screen.getByTestId('lock-storage-error').textContent).toContain(
      diagnostic,
    );
  });

  it('detects a warm fault, preserves it across transient failures and clears it on verified repair', async () => {
    mockInspect.mockResolvedValueOnce({ errorMessage: null });
    render(<Lock />);
    await settle();
    expect(screen.queryByTestId('lock-storage-error')).toBeNull();
    await poll();
    expect(screen.getByTestId('lock-storage-error')).toBeTruthy();
    mockInspect.mockRejectedValueOnce(
      new OneKeyLocalError('temporary disconnect'),
    );
    await poll();
    expect(screen.getByTestId('lock-storage-error')).toBeTruthy();
    mockInspect.mockResolvedValue({ errorMessage: null });
    await poll();
    expect(screen.queryByTestId('lock-storage-error')).toBeNull();
    expect(screen.queryByTestId('lock-storage-toast')).toBeNull();
  });

  it.each([
    'incorrect password',
    'Native storage migration target is inconsistent:appStorage',
    createNativeStorageMigrationInconsistentErrorMessage('jotai'),
    'Native background storage transport is not installed',
  ])('does not show AppStorage repair for %s', async (errorMessage) => {
    mockInspect.mockResolvedValue({ errorMessage });
    render(<Lock />);
    await settle();
    expect(screen.queryByTestId('lock-storage-error')).toBeNull();
    expect(screen.queryByTestId('lock-storage-toast')).toBeNull();
    expect(screen.getByTestId('password')).toBeTruthy();
  });

  it('serializes inspections, resumes on foreground and ignores responses after unmount', async () => {
    let resolveInspection: (
      value: INativeAppStorageMigrationStatus,
    ) => void = () => {};
    mockInspect.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveInspection = resolve;
        }),
    );
    const view = render(<Lock />);
    await poll();
    act(() => mockAppStateListeners.forEach((listener) => listener('active')));
    expect(mockInspect).toHaveBeenCalledTimes(1);
    view.unmount();
    await act(async () => {
      resolveInspection({ errorMessage: diagnostic });
    });
    await poll();
    expect(mockInspect).toHaveBeenCalledTimes(1);
    expect(mockAppStateListeners.size).toBe(0);
    mockInspect.mockResolvedValue({ errorMessage: null });
    render(<Lock />);
    await settle();
    mockAppState = 'background';
    await poll();
    expect(mockInspect).toHaveBeenCalledTimes(2);
    mockAppState = 'active';
    await act(async () => {
      mockAppStateListeners.forEach((listener) => listener('active'));
    });
    expect(mockInspect).toHaveBeenCalledTimes(3);
  });
});

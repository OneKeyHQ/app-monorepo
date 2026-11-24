/** @jest-environment jsdom */

import { StrictMode, createRef } from 'react';

import { useNavigation } from '@react-navigation/native';
import { act, render } from '@testing-library/react';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { ScanCamera } from './index.native';

import type { IScanCameraRef } from './types';

type IViewProps = {
  active: boolean;
  onReady: (generation: number) => void;
  onFrameText: (text: string, generation: number) => void;
  onError: (code: string, message: string, generation: number) => void;
};
type ITransitionEvent = { data: { closing: boolean } };
type IEventName =
  | 'transitionStart'
  | 'transitionEnd'
  | 'gestureCancel'
  | 'focus'
  | 'blur';
type IListener = (event: ITransitionEvent) => void;
type ITestNavigation = {
  getParent: () => ITestNavigation | undefined;
  isFocused: jest.Mock<boolean, []>;
  dispatch: jest.Mock;
  addListener: (name: IEventName, listener: IListener) => () => boolean;
  emit: (name: IEventName, event?: ITransitionEvent) => void;
};

let mockViewProps: IViewProps | undefined;
let mockViewMounts = 0;
let mockViewUnmounts = 0;

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNativeIOSMacCatalyst: false },
}));
jest.mock('@react-navigation/native', () => ({ useNavigation: jest.fn() }));
jest.mock('react-native-nitro-modules', () => ({
  callback: <T,>(fn: T) => fn,
}));
jest.mock('@onekeyfe/react-native-qr-scanner', () => {
  const React = require('react') as typeof import('react');
  return {
    QrScannerView: (props: IViewProps) => {
      mockViewProps = props;
      React.useEffect(() => {
        mockViewMounts += 1;
        return () => {
          mockViewUnmounts += 1;
        };
      }, []);
      return null;
    },
  };
});

function createNavigation(parent?: ITestNavigation): ITestNavigation {
  const listeners = new Map<IEventName, Set<IListener>>();
  return {
    getParent: () => parent,
    isFocused: jest.fn(() => true),
    dispatch: jest.fn(),
    addListener: (name: IEventName, listener: IListener) => {
      const callbacks = listeners.get(name) ?? new Set<IListener>();
      callbacks.add(listener);
      listeners.set(name, callbacks);
      return () => callbacks.delete(listener);
    },
    emit: (
      name: IEventName,
      event: ITransitionEvent = { data: { closing: false } },
    ) => {
      listeners.get(name)?.forEach((listener) => listener(event));
    },
  };
}

function view() {
  if (!mockViewProps) {
    throw new OneKeyLocalError('QrScannerView was not rendered');
  }
  return mockViewProps;
}

function useTestNavigation(screen: ITestNavigation) {
  jest
    .mocked(useNavigation)
    .mockReturnValue(screen as unknown as ReturnType<typeof useNavigation>);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockViewProps = undefined;
  mockViewMounts = 0;
  mockViewUnmounts = 0;
});

test('parent dismissal pauses at once and a cancelled gesture resumes the same camera', () => {
  const root = createNavigation();
  const modal = createNavigation(root);
  const screen = createNavigation(modal);
  useTestNavigation(screen);
  const handleScanResult = jest.fn();

  const { unmount } = render(
    <ScanCamera handleScanResult={handleScanResult} />,
  );
  expect(view().active).toBe(true);
  const { onFrameText } = view();

  act(() => {
    modal.emit('transitionStart', { data: { closing: true } });
    // The frame arrives before React commits the paused view.
    onFrameText('late', 1);
  });
  expect(handleScanResult).not.toHaveBeenCalled();
  expect(view().active).toBe(false);

  act(() => modal.emit('gestureCancel'));
  expect(view().active).toBe(true);
  view().onFrameText('valid', 2);
  expect(handleScanResult).toHaveBeenCalledWith('valid');
  expect(mockViewMounts).toBe(1);
  expect(mockViewUnmounts).toBe(0);

  unmount();
  onFrameText('after-unmount', 2);
  expect(handleScanResult).toHaveBeenCalledTimes(1);
  expect(screen.dispatch).not.toHaveBeenCalled();
});

test('one cancelled transition cannot resume capture paused by another ancestor', () => {
  const root = createNavigation();
  const screen = createNavigation(root);
  useTestNavigation(screen);

  render(<ScanCamera />);
  act(() => {
    root.emit('transitionStart', { data: { closing: true } });
    screen.emit('transitionStart', { data: { closing: true } });
    root.emit('gestureCancel');
  });
  expect(view().active).toBe(false);

  act(() => screen.emit('gestureCancel'));
  expect(view().active).toBe(true);
});

test('focus loss and return transition control capture on one mounted view', () => {
  const screen = createNavigation();
  useTestNavigation(screen);
  render(<ScanCamera />);

  act(() => screen.emit('transitionStart', { data: { closing: true } }));
  screen.isFocused.mockReturnValue(false);
  act(() => screen.emit('blur'));
  act(() => screen.emit('gestureCancel'));
  expect(view().active).toBe(false);

  act(() => screen.emit('transitionStart', { data: { closing: true } }));
  screen.isFocused.mockReturnValue(true);
  act(() => screen.emit('focus'));
  expect(view().active).toBe(false);
  act(() => screen.emit('transitionEnd', { data: { closing: false } }));
  expect(view().active).toBe(true);
  expect(mockViewMounts).toBe(1);
});

test('frames of an older capture generation are dropped', () => {
  const screen = createNavigation();
  useTestNavigation(screen);
  const handleScanResult = jest.fn();
  render(<ScanCamera handleScanResult={handleScanResult} />);

  view().onReady(3);
  view().onFrameText('stale', 2);
  view().onFrameText('current', 3);
  expect(handleScanResult.mock.calls).toEqual([['current']]);
});

test('explicit dispose blocks later resume and QR delivery', () => {
  const screen = createNavigation();
  useTestNavigation(screen);
  const scannerRef = createRef<IScanCameraRef>();
  const handleScanResult = jest.fn();
  render(<ScanCamera ref={scannerRef} handleScanResult={handleScanResult} />);
  const { onFrameText } = view();

  act(() => scannerRef.current?.dispose());
  expect(view().active).toBe(false);
  act(() => screen.emit('gestureCancel'));
  act(() => screen.emit('focus'));
  expect(view().active).toBe(false);
  onFrameText('disposed', 1);
  expect(handleScanResult).not.toHaveBeenCalled();
});

test('camera errors map to error codes', () => {
  const screen = createNavigation();
  useTestNavigation(screen);
  const onCameraError = jest.fn();
  render(<ScanCamera onCameraError={onCameraError} />);

  view().onError('permission-denied', 'denied', 1);
  view().onError('something-new', 'unknown', 1);
  expect(onCameraError.mock.calls).toEqual([
    ['permission-denied'],
    ['decoder-unavailable'],
  ]);
});

test('DeviceStage overlay scans after StrictMode effect replay without navigation', () => {
  const handleScanResult = jest.fn();
  render(
    <StrictMode>
      <ScanCamera disableNavigationGuard handleScanResult={handleScanResult} />
    </StrictMode>,
  );

  expect(useNavigation).not.toHaveBeenCalled();
  expect(view().active).toBe(true);
  expect(view()).not.toHaveProperty('disableNavigationGuard');
  view().onFrameText('overlay-frame', 1);
  expect(handleScanResult).toHaveBeenCalledWith('overlay-frame');
});

/** @jest-environment jsdom */

import { type ComponentProps, StrictMode, createRef } from 'react';

import { useNavigation } from '@react-navigation/native';
import { act, render } from '@testing-library/react';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { ScanCamera } from './index.native';

import type { IScanCameraRef } from './types';

type ICameraProps = ComponentProps<
  typeof import('react-native-camera-kit').Camera
>;
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

let mockCameraProps: ICameraProps | undefined;
let mockCameraMounts = 0;
let mockCameraUnmounts = 0;
let mockAttachCameraRef = true;
const mockSetActive = jest.fn<void, [boolean]>();
const mockDispose = jest.fn<void, []>();

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNativeIOSMacCatalyst: false },
}));
jest.mock('@react-navigation/native', () => ({ useNavigation: jest.fn() }));
jest.mock('react-native-camera-kit', () => {
  const React = require('react') as typeof import('react');
  return {
    Camera: React.forwardRef((props: ICameraProps, ref) => {
      mockCameraProps = props;
      React.useImperativeHandle(
        mockAttachCameraRef ? ref : null,
        () => ({ setActive: mockSetActive, dispose: mockDispose }),
        [],
      );
      React.useEffect(() => {
        mockCameraMounts += 1;
        return () => {
          mockCameraUnmounts += 1;
        };
      }, []);
      return null;
    }),
    CameraType: { Back: 'back' },
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

function latestCameraProps() {
  if (!mockCameraProps) {
    throw new OneKeyLocalError('Camera was not rendered');
  }
  return mockCameraProps;
}

function useTestNavigation(screen: ITestNavigation) {
  jest
    .mocked(useNavigation)
    .mockReturnValue(screen as unknown as ReturnType<typeof useNavigation>);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCameraProps = undefined;
  mockCameraMounts = 0;
  mockCameraUnmounts = 0;
  mockAttachCameraRef = true;
});

test('parent dismissal sends pause immediately and cancelled gesture resumes the same camera', () => {
  const root = createNavigation();
  const modal = createNavigation(root);
  const screen = createNavigation(modal);
  useTestNavigation(screen);
  const handleScanResult = jest.fn();

  const { unmount } = render(
    <ScanCamera handleScanResult={handleScanResult} />,
  );
  expect(mockSetActive.mock.calls.at(-1)?.[0]).toBe(true);
  expect(mockCameraMounts).toBe(1);

  const onReadCode = latestCameraProps().onReadCode;
  const commandsBeforePause = mockSetActive.mock.calls.length;
  act(() => modal.emit('transitionStart', { data: { closing: true } }));
  expect(mockSetActive).toHaveBeenCalledTimes(commandsBeforePause + 1);
  expect(mockSetActive.mock.calls.at(-1)?.[0]).toBe(false);
  onReadCode?.({ nativeEvent: { codeStringValue: 'late', codeFormat: 'qr' } });
  expect(handleScanResult).not.toHaveBeenCalled();
  expect(mockCameraUnmounts).toBe(0);

  act(() => modal.emit('gestureCancel'));
  expect(mockSetActive.mock.calls.at(-1)?.[0]).toBe(true);
  onReadCode?.({ nativeEvent: { codeStringValue: 'valid', codeFormat: 'qr' } });
  expect(handleScanResult).toHaveBeenCalledWith('valid');
  expect(mockCameraMounts).toBe(1);

  unmount();
  onReadCode?.({
    nativeEvent: { codeStringValue: 'after-unmount', codeFormat: 'qr' },
  });
  expect(handleScanResult).toHaveBeenCalledTimes(1);
  expect(mockDispose).not.toHaveBeenCalled();
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
  expect(mockSetActive.mock.calls.at(-1)?.[0]).toBe(false);

  act(() => screen.emit('gestureCancel'));
  expect(mockSetActive.mock.calls.at(-1)?.[0]).toBe(true);
});

test('focus loss and return transition control capture without a rerender', () => {
  const screen = createNavigation();
  useTestNavigation(screen);
  render(<ScanCamera />);

  act(() => screen.emit('transitionStart', { data: { closing: true } }));
  screen.isFocused.mockReturnValue(false);
  act(() => screen.emit('blur'));
  act(() => screen.emit('gestureCancel'));
  expect(mockSetActive.mock.calls.at(-1)?.[0]).toBe(false);

  act(() => screen.emit('transitionStart', { data: { closing: true } }));
  screen.isFocused.mockReturnValue(true);
  act(() => screen.emit('focus'));
  expect(mockSetActive.mock.calls.at(-1)?.[0]).toBe(false);
  act(() => screen.emit('transitionEnd', { data: { closing: false } }));
  expect(mockSetActive.mock.calls.at(-1)?.[0]).toBe(true);
  expect(mockCameraMounts).toBe(1);
});

test('late camera ref replays only the latest route activity', () => {
  const screen = createNavigation();
  useTestNavigation(screen);
  mockAttachCameraRef = false;

  const { rerender } = render(<ScanCamera />);
  act(() => screen.emit('transitionStart', { data: { closing: true } }));
  act(() => screen.emit('gestureCancel'));
  expect(mockSetActive).not.toHaveBeenCalled();

  mockAttachCameraRef = true;
  rerender(<ScanCamera />);
  expect(mockSetActive).toHaveBeenCalledTimes(1);
  expect(mockSetActive).toHaveBeenLastCalledWith(true);
  expect(mockCameraMounts).toBe(1);
});

test('explicit dispose blocks later resume, ref replay, and QR delivery', () => {
  const screen = createNavigation();
  useTestNavigation(screen);
  const scannerRef = createRef<IScanCameraRef>();
  const handleScanResult = jest.fn();
  const { rerender } = render(
    <ScanCamera ref={scannerRef} handleScanResult={handleScanResult} />,
  );
  const onReadCode = latestCameraProps().onReadCode;
  scannerRef.current?.dispose();
  expect(mockDispose).toHaveBeenCalledTimes(1);
  const activeCalls = mockSetActive.mock.calls.length;

  act(() => screen.emit('gestureCancel'));
  mockAttachCameraRef = false;
  rerender(<ScanCamera ref={scannerRef} handleScanResult={handleScanResult} />);
  mockAttachCameraRef = true;
  rerender(<ScanCamera ref={scannerRef} handleScanResult={handleScanResult} />);
  expect(mockSetActive).toHaveBeenCalledTimes(activeCalls);
  expect(mockDispose).toHaveBeenCalledTimes(2);
  onReadCode?.({
    nativeEvent: { codeStringValue: 'disposed', codeFormat: 'qr' },
  });
  expect(handleScanResult).not.toHaveBeenCalled();
});

test('DeviceStage overlay scans after StrictMode effect replay without navigation or dispose', () => {
  const handleScanResult = jest.fn();
  render(
    <StrictMode>
      <ScanCamera disableNavigationGuard handleScanResult={handleScanResult} />
    </StrictMode>,
  );

  expect(useNavigation).not.toHaveBeenCalled();
  expect(mockSetActive.mock.calls.at(-1)?.[0]).toBe(true);
  expect(latestCameraProps()).not.toHaveProperty('disableNavigationGuard');
  latestCameraProps().onReadCode?.({
    nativeEvent: { codeStringValue: 'overlay-frame', codeFormat: 'qr' },
  });
  expect(handleScanResult).toHaveBeenCalledWith('overlay-frame');
  expect(mockDispose).not.toHaveBeenCalled();
});

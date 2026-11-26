/** @jest-environment jsdom */

import { createRef } from 'react';

import { ScanCamera } from '.';

import { createWebQrScanner } from '@onekeyfe/react-native-qr-scanner/web';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';

import type { IScanCameraRef } from './types';

type IOptions = {
  video: HTMLVideoElement;
  source: { kind: string; deviceId?: string };
  onReady: () => void;
  mode: string;
  onFrameText: (text: string) => void;
  onError: (error: unknown) => void;
};

const mockScanner = {
  start: jest.fn(async () => {}),
  switchCamera: jest.fn(async (_id?: string) => {}),
  focus: jest.fn(async (_point?: { x: number; y: number }) => true),
  setMultiSymbol: jest.fn(),
  setFrozen: jest.fn(),
  dispose: jest.fn(),
};
const mockEnsureConfigured = jest.fn<void, []>();

jest.mock('react-native', () => ({
  StyleSheet: { create: <T,>(styles: T) => styles },
  View: ({ children }: { children?: unknown }) => children,
}));
jest.mock('./webQrScanner', () => ({
  ensureWebQrScannerConfigured: () => mockEnsureConfigured(),
}));
jest.mock('@onekeyfe/react-native-qr-scanner/web', () => {
  class QrScannerError extends Error {
    constructor(
      readonly code: string,
      message: string,
    ) {
      super(message);
    }
  }
  return {
    QrScannerError,
    createWebQrScanner: jest.fn(() => mockScanner),
  };
});

function options() {
  return jest.mocked(createWebQrScanner).mock
    .calls[0][0] as unknown as IOptions;
}

afterEach(() => {
  jest.clearAllMocks();
});

test('scans the video element and passes every frame text through', () => {
  const handleScanResult = jest.fn();
  render(<ScanCamera handleScanResult={handleScanResult} />);

  expect(mockEnsureConfigured).toHaveBeenCalled();
  expect(options().video).toBeInstanceOf(HTMLVideoElement);
  expect(options().mode).toBe('static');
  expect(mockScanner.start).toHaveBeenCalled();
  options().onFrameText('ur:crypto-psbt/1-3/a');
  options().onFrameText('ur:crypto-psbt/2-3/b');
  expect(handleScanResult.mock.calls).toEqual([
    ['ur:crypto-psbt/1-3/a'],
    ['ur:crypto-psbt/2-3/b'],
  ]);
});

test('reports camera errors and releases the camera on unmount and dispose', () => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  const { QrScannerError } = jest.requireMock<{
    QrScannerError: new (code: string, message: string) => Error;
  }>('@onekeyfe/react-native-qr-scanner/web');
  const onCameraError = jest.fn();
  const ref = createRef<IScanCameraRef>();
  const { unmount } = render(
    <ScanCamera ref={ref} onCameraError={onCameraError} />,
  );

  options().onError(new QrScannerError('permission-denied', 'denied'));
  expect(onCameraError).toHaveBeenCalledWith('permission-denied');

  ref.current?.dispose();
  expect(mockScanner.dispose).toHaveBeenCalledTimes(1);
  unmount();
  expect(mockScanner.dispose).toHaveBeenCalledTimes(2);
});

test('starts on the chosen camera and switches when it changes', () => {
  const onCameraReady = jest.fn();
  const { rerender } = render(
    <ScanCamera cameraId="cam-a" onCameraReady={onCameraReady} />,
  );
  expect(options().source).toEqual({ kind: 'camera', deviceId: 'cam-a' });
  expect(mockScanner.switchCamera).not.toHaveBeenCalled();
  options().onReady();
  expect(onCameraReady).toHaveBeenCalledTimes(1);

  rerender(<ScanCamera cameraId="cam-b" onCameraReady={onCameraReady} />);
  expect(mockScanner.switchCamera).toHaveBeenCalledWith('cam-b');
  rerender(<ScanCamera cameraId="cam-b" onCameraReady={onCameraReady} />);
  expect(mockScanner.switchCamera).toHaveBeenCalledTimes(1);
  expect(createWebQrScanner).toHaveBeenCalledTimes(1);
});

test('focus maps a cropped preview tap to the source frame and shows the box at the tap', async () => {
  render(<ScanCamera />);
  const video = options().video;
  Object.defineProperties(video, {
    videoWidth: { value: 1280 },
    videoHeight: { value: 720 },
  });
  jest.spyOn(video, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    top: 0,
    width: 100,
    height: 100,
    right: 100,
    bottom: 100,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });

  fireEvent.click(video, { clientX: 0, clientY: 25 });
  expect(mockScanner.focus).toHaveBeenCalledWith({ x: 0.218_75, y: 0.25 });
  await waitFor(() => {
    expect(screen.getByTestId('scan-camera-focus-box').style.left).toBe(
      '-36.5px',
    );
  });
});

test('clears existing feedback and ignores pending focus results on a camera switch', async () => {
  const { rerender } = render(<ScanCamera cameraId="cam-a" />);
  const video = options().video;
  fireEvent.click(video);
  await screen.findByTestId('scan-camera-focus-box');

  const pendingFocus = Promise.withResolvers<boolean>();
  mockScanner.focus.mockReturnValueOnce(pendingFocus.promise);
  fireEvent.click(video);
  rerender(<ScanCamera cameraId="cam-b" />);
  expect(screen.queryByTestId('scan-camera-focus-box')).toBeNull();
  await act(async () => pendingFocus.resolve(true));
  expect(screen.queryByTestId('scan-camera-focus-box')).toBeNull();
});

test('an overlay request focuses on resume even when no camera focus is available', async () => {
  const onPreviewTap = jest.fn();
  const { rerender } = render(
    <ScanCamera frozen onPreviewTap={onPreviewTap} />,
  );
  const video = options().video;
  Object.defineProperties(video, {
    videoWidth: { value: 1280 },
    videoHeight: { value: 720 },
  });
  jest.spyOn(video, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    top: 0,
    width: 100,
    height: 100,
    right: 100,
    bottom: 100,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
  mockScanner.focus.mockResolvedValueOnce(false);
  const focusRequest = { id: 1, x: 0, y: 0.25 };
  rerender(
    <ScanCamera
      frozen={false}
      focusRequest={focusRequest}
      onPreviewTap={onPreviewTap}
    />,
  );
  expect(mockScanner.setFrozen).toHaveBeenLastCalledWith(false);
  expect(mockScanner.setFrozen.mock.invocationCallOrder.at(-1)).toBeLessThan(
    mockScanner.focus.mock.invocationCallOrder.at(-1)!,
  );
  expect(mockScanner.focus).toHaveBeenLastCalledWith({ x: 0.218_75, y: 0.25 });
  expect(onPreviewTap).not.toHaveBeenCalled();
  rerender(
    <ScanCamera
      frozen={false}
      focusRequest={{ ...focusRequest }}
      onPreviewTap={onPreviewTap}
    />,
  );
  expect(mockScanner.focus).toHaveBeenCalledTimes(1);
  await act(async () => {});
  expect(screen.queryByTestId('scan-camera-focus-box')).toBeNull();

  fireEvent.click(video, { clientX: 25, clientY: 25 });
  expect(onPreviewTap).toHaveBeenCalledTimes(1);
});

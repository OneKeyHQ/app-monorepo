/** @jest-environment jsdom */

import { createRef } from 'react';

import { ScanCamera } from '.';

import { createWebQrScanner } from '@onekeyfe/react-native-qr-scanner/web';
import { render } from '@testing-library/react';

import type { IScanCameraRef } from './types';

type IOptions = {
  video: HTMLVideoElement;
  mode: string;
  onFrameText: (text: string) => void;
  onError: (error: unknown) => void;
};

const mockScanner = { start: jest.fn(async () => {}), dispose: jest.fn() };
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

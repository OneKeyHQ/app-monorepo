/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { ScanQrCode } from '.';

import { fireEvent, render, screen } from '@testing-library/react';

import { EAppSyncStorageKeys } from '@onekeyhq/shared/src/storage/syncStorageKeys';

const mockGetString = jest.fn<string | undefined, [string]>();
let mockIsDesktop = false;
const defaultDiscovery = {
  cameras: [{ id: 'a' }, { id: 'b' }],
  loaded: true,
  pending: false,
};
let mockDiscovery = defaultDiscovery;
const mockPersist = jest.fn<void, [string, string]>();

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/components', () => ({
  Button: ({ onPress, testID }: { onPress: () => void; testID: string }) => (
    <button type="button" data-testid={testID} onClick={onPress}>
      Retry
    </button>
  ),
  SizableText: () => null,
  YStack: ({ children }: { children: ReactNode }) => children,
}));
jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocused: () => true,
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isNative: false,
    get isDesktop() {
      return mockIsDesktop;
    },
  },
}));
jest.mock('@onekeyhq/shared/src/storage/appStorage', () => ({
  __esModule: true,
  default: {
    syncStorage: {
      getString: (key: string) => mockGetString(key),
      set: (key: string, value: string) => mockPersist(key, value),
    },
  },
}));
jest.mock('@onekeyhq/shared/src/utils/extUtils', () => ({}));
jest.mock('@onekeyhq/shared/src/utils/openUrlUtils', () => ({}));
jest.mock('./ScanCamera/useScanCameras', () => ({
  useScanCameras: () => mockDiscovery,
}));
jest.mock('./CameraSwitchButton', () => ({
  CameraSwitchButton: ({
    cameraId,
    onSelect,
  }: {
    cameraId?: string;
    onSelect: (id: string) => void;
  }) => (
    <button
      type="button"
      data-testid="camera-switch-btn"
      data-camera-id={cameraId}
      onClick={() => onSelect(cameraId === 'b' ? 'a' : 'b')}
    >
      Switch
    </button>
  ),
}));
jest.mock('./ScanCamera', () => ({
  ScanCamera: ({
    cameraId,
    cameraActive,
    children,
    onCameraReady,
    onCameraError,
    onWebCameraFallback,
  }: {
    cameraId?: string;
    cameraActive?: boolean;
    children: ReactNode;
    onCameraReady: (id?: string) => void;
    onCameraError: (code: string) => void;
    onWebCameraFallback: () => void;
  }) => (
    <div
      data-testid="camera"
      data-camera-id={cameraId}
      data-camera-active={cameraActive}
    >
      {children}
      <button type="button" onClick={() => onCameraReady(cameraId ?? 'a')}>
        Ready
      </button>
      <button type="button" onClick={() => onCameraReady(undefined)}>
        ReadyWithoutId
      </button>
      <button type="button" onClick={() => onCameraReady('a')}>
        ReadyWithFallback
      </button>
      <button type="button" onClick={onWebCameraFallback}>
        Fallback
      </button>
      <button type="button" onClick={() => onCameraError('camera-busy')}>
        Fail
      </button>
    </div>
  ),
}));

beforeEach(() => {
  mockIsDesktop = false;
  mockDiscovery = defaultDiscovery;
  mockGetString.mockReset();
  mockPersist.mockReset();
});

test('a failed switch retries the last working camera and preserves its preference', () => {
  mockPersist.mockImplementation((_key, value) => {
    mockGetString.mockReturnValue(value);
  });
  const handleBarCodeScanned = jest.fn(async () => ({}));
  const { unmount } = render(
    <ScanQrCode handleBarCodeScanned={handleBarCodeScanned} />,
  );

  fireEvent.click(screen.getByText('Ready'));
  fireEvent.click(screen.getByText('Switch'));
  expect(screen.getByTestId('camera').getAttribute('data-camera-id')).toBe('b');
  fireEvent.click(screen.getByText('Fail'));
  expect(mockPersist).toHaveBeenCalledTimes(1);
  expect(mockPersist).toHaveBeenLastCalledWith(expect.any(String), 'a');

  fireEvent.click(screen.getByTestId('scan-camera-retry'));
  expect(screen.getByTestId('camera').getAttribute('data-camera-id')).toBe('a');

  unmount();
  render(<ScanQrCode handleBarCodeScanned={handleBarCodeScanned} />);
  expect(screen.getByTestId('camera').getAttribute('data-camera-id')).toBe('a');

  fireEvent.click(screen.getByText('Switch'));
  fireEvent.click(screen.getByText('Ready'));
  expect(mockPersist).toHaveBeenLastCalledWith(expect.any(String), 'b');
});

test('Retry opens the default camera when a previously saved device fails before readiness', () => {
  mockGetString.mockReturnValue('b');
  render(<ScanQrCode handleBarCodeScanned={jest.fn(async () => ({}))} />);
  expect(screen.getByTestId('camera').getAttribute('data-camera-id')).toBe('b');

  fireEvent.click(screen.getByText('Fail'));
  expect(mockPersist).not.toHaveBeenCalled();
  fireEvent.click(screen.getByTestId('scan-camera-retry'));

  expect(
    screen.getByTestId('camera').getAttribute('data-camera-id'),
  ).toBeNull();
  fireEvent.click(screen.getByText('Ready'));
  expect(mockPersist).toHaveBeenLastCalledWith(expect.any(String), 'a');
});

test('desktop keeps native and Chromium camera choices independent across visits', () => {
  const nativeKey = EAppSyncStorageKeys.last_scan_desktop_native_camera_id;
  const chromiumKey = EAppSyncStorageKeys.last_scan_camera_id;
  const handleBarCodeScanned = jest.fn(async () => ({}));
  const previousDesktopApi = globalThis.desktopApi;
  mockIsDesktop = true;
  Object.defineProperty(globalThis, 'desktopApi', {
    configurable: true,
    writable: true,
    value: { qrScanner: {} },
  });
  mockGetString.mockImplementation((key) => (key === nativeKey ? 'a' : 'b'));
  try {
    const { unmount } = render(
      <ScanQrCode handleBarCodeScanned={handleBarCodeScanned} />,
    );
    expect(screen.getByTestId('camera').getAttribute('data-camera-id')).toBe(
      'a',
    );
    fireEvent.click(screen.getByText('Ready'));
    expect(mockPersist).toHaveBeenLastCalledWith(nativeKey, 'a');
    fireEvent.click(screen.getByText('Fallback'));
    expect(screen.getByTestId('camera').getAttribute('data-camera-id')).toBe(
      'b',
    );
    fireEvent.click(screen.getByText('Ready'));
    expect(mockPersist).toHaveBeenLastCalledWith(chromiumKey, 'b');

    unmount();
    render(<ScanQrCode handleBarCodeScanned={handleBarCodeScanned} />);
    fireEvent.click(screen.getByText('Fallback'));
    expect(screen.getByTestId('camera').getAttribute('data-camera-id')).toBe(
      'b',
    );
  } finally {
    globalThis.desktopApi = previousDesktopApi;
  }
});

test('desktop waits for discovery and retains the selected device when enumeration fails', () => {
  const previousDesktopApi = globalThis.desktopApi;
  mockIsDesktop = true;
  Object.defineProperty(globalThis, 'desktopApi', {
    configurable: true,
    writable: true,
    value: { qrScanner: {} },
  });
  mockGetString.mockReturnValue('usb');
  mockDiscovery = { cameras: [], loaded: false, pending: true };
  const handleBarCodeScanned = jest.fn(async () => ({}));
  try {
    const { rerender } = render(
      <ScanQrCode handleBarCodeScanned={handleBarCodeScanned} />,
    );
    expect(
      screen.getByTestId('camera').getAttribute('data-camera-active'),
    ).toBe('false');

    mockDiscovery = { cameras: [], loaded: false, pending: false };
    rerender(<ScanQrCode handleBarCodeScanned={handleBarCodeScanned} />);
    expect(
      screen.getByTestId('camera').getAttribute('data-camera-active'),
    ).toBe('true');
    expect(screen.getByTestId('camera').getAttribute('data-camera-id')).toBe(
      'usb',
    );
  } finally {
    globalThis.desktopApi = previousDesktopApi;
  }
});

test('cycles cameras back and forth even when onReady does not report an active camera id', () => {
  render(<ScanQrCode handleBarCodeScanned={jest.fn(async () => ({}))} />);

  fireEvent.click(screen.getByText('ReadyWithoutId'));
  fireEvent.click(screen.getByTestId('camera-switch-btn'));
  expect(screen.getByTestId('camera').getAttribute('data-camera-id')).toBe('b');

  fireEvent.click(screen.getByText('ReadyWithoutId'));
  expect(
    screen.getByTestId('camera-switch-btn').getAttribute('data-camera-id'),
  ).toBe('b');
  expect(mockPersist).toHaveBeenLastCalledWith(expect.any(String), 'b');

  fireEvent.click(screen.getByTestId('camera-switch-btn'));
  expect(screen.getByTestId('camera').getAttribute('data-camera-id')).toBe('a');
});

test('the picker reports the opened camera when capture falls back before discovery refreshes', () => {
  mockGetString.mockReturnValue('b');
  render(<ScanQrCode handleBarCodeScanned={jest.fn(async () => ({}))} />);
  expect(
    screen.getByTestId('camera-switch-btn').getAttribute('data-camera-id'),
  ).toBe('b');

  fireEvent.click(screen.getByText('ReadyWithFallback'));
  expect(
    screen.getByTestId('camera-switch-btn').getAttribute('data-camera-id'),
  ).toBe('a');
  expect(mockPersist).toHaveBeenLastCalledWith(expect.any(String), 'a');
});

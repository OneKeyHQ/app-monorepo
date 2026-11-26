/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { ScanQrCode } from '.';

import { UR, URDecoder, UREncoder } from '@ngraveio/bc-ur';
import { act, fireEvent, render, screen } from '@testing-library/react';

import { EAppSyncStorageKeys } from '@onekeyhq/shared/src/storage/syncStorageKeys';

import type { IScanCameraProps } from './ScanCamera/types';
import type { IMultiQrSymbol } from '../utils/multiQrSymbols';

const mockGetString = jest.fn<string | undefined, [string]>();
let mockIsDesktop = false;
const defaultDiscovery = {
  cameras: [{ id: 'a' }, { id: 'b' }],
  loaded: true,
  pending: false,
};
let mockDiscovery = defaultDiscovery;
const mockPersist = jest.fn<void, [string, string]>();
let mockReceiveFrame: IScanCameraProps['onFrameSymbols'];

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/components', () => ({
  BlurView: () => null,
  Button: ({ onPress, testID }: { onPress: () => void; testID: string }) => (
    <button type="button" data-testid={testID} onClick={onPress}>
      Retry
    </button>
  ),
  SizableText: ({ children }: { children: ReactNode }) => (
    <span>{children}</span>
  ),
  Stack: ({ children }: { children: ReactNode }) => children,
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
jest.mock('./MultiQrSelectionOverlay', () => ({
  MultiQrSelectionOverlay: ({
    symbols,
    onSelect,
  }: {
    symbols: IMultiQrSymbol[];
    onSelect: (symbol: IMultiQrSymbol) => void;
  }) => (
    <div data-testid="selector" data-symbol-count={symbols.length}>
      {symbols.map((symbol) => (
        <button
          type="button"
          key={symbol.text}
          onClick={() => onSelect(symbol)}
        >
          {symbol.text}
        </button>
      ))}
    </div>
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
    handleScanResult,
    onFrameSymbols,
    multiSymbol,
  }: {
    cameraId?: string;
    cameraActive?: boolean;
    children: ReactNode;
    onCameraReady: (id?: string) => void;
    onCameraError: (code: string) => void;
    onWebCameraFallback: () => void;
  } & Pick<
    IScanCameraProps,
    'handleScanResult' | 'onFrameSymbols' | 'multiSymbol'
  >) => {
    mockReceiveFrame = onFrameSymbols;
    return (
      <div
        data-testid="camera"
        data-camera-id={cameraId}
        data-camera-active={cameraActive}
        data-camera-multi-symbol={multiSymbol}
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
        <button
          type="button"
          onClick={() => {
            onFrameSymbols?.({
              coordinateSpace: 'view',
              symbols: [
                { text: 'https://example.com', centerX: 0.3, centerY: 0.5 },
                { text: 'ur:bytes/1-2/first', centerX: 0.7, centerY: 0.5 },
              ],
            });
            handleScanResult?.('https://example.com');
          }}
        >
          MixedFrame
        </button>
      </div>
    );
  },
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
    value: { qrScanner: { setPreviewFrozen: jest.fn() } },
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
    value: { qrScanner: { setPreviewFrozen: jest.fn() } },
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

test('mixed detection waits for a selection even when the camera also reports raw text', () => {
  const onScan = jest.fn(async () => ({}));
  render(<ScanQrCode handleBarCodeScanned={onScan} />);
  fireEvent.click(screen.getByText('MixedFrame'));
  expect(onScan).not.toHaveBeenCalled();
  expect(screen.getByTestId('selector').getAttribute('data-symbol-count')).toBe(
    '2',
  );
  expect(
    screen.getByTestId('camera').getAttribute('data-camera-multi-symbol'),
  ).toBe('true');
});

test.each([
  { acquisition: 'explicit', selected: true },
  { acquisition: 'automatic', selected: false },
])(
  'switching cameras handles $acquisition animated QR acquisition',
  async ({ selected }) => {
    jest.useFakeTimers();
    try {
      const onScan = jest.fn(async (_text: string) => ({ progress: 0.25 }));
      const encoder = new UREncoder(UR.fromBuffer(Buffer.alloc(200, 7)), 40);
      const first = encoder.nextPart();
      const next = encoder.nextPart();
      const address = {
        text: 'https://example.com',
        centerX: 0.3,
        centerY: 0.5,
      };
      const ur = { text: first, centerX: 0.7, centerY: 0.5 };
      render(<ScanQrCode handleBarCodeScanned={onScan} />);

      const frame = (symbols: IMultiQrSymbol[]) =>
        mockReceiveFrame?.({ coordinateSpace: 'view', symbols });
      await act(async () => {
        frame(selected ? [address, ur] : [ur]);
      });
      if (selected) {
        await act(async () => {
          fireEvent.click(screen.getByText(first));
        });
      }
      expect(screen.getByText(/25%$/)).toBeTruthy();
      await act(async () => {
        fireEvent.click(screen.getByText('Switch'));
      });
      expect(screen.getByTestId('camera').getAttribute('data-camera-id')).toBe(
        'b',
      );
      expect(Boolean(screen.queryByText(/25%$/))).toBe(selected);
      await act(async () => {
        frame([address]);
        jest.advanceTimersByTime(300);
      });
      expect(onScan.mock.calls).toEqual(
        selected ? [[first]] : [[first], [address.text]],
      );
      await act(async () => {
        frame([{ ...ur, text: next }]);
      });
      expect(onScan.mock.calls).toEqual([
        [first],
        [selected ? next : address.text],
      ]);
    } finally {
      jest.useRealTimers();
    }
  },
);

test('camera switch drains an automatic UR frame and resets the decoder before feeding a new message', async () => {
  const previous = new UREncoder(UR.fromBuffer(Buffer.alloc(200, 7)), 40);
  const next = new UREncoder(UR.fromBuffer(Buffer.alloc(200, 8)), 40);
  const firstPart = previous.nextPart();
  const inFlightPart = previous.nextPart();
  const nextMessagePart = next.nextPart();
  const oldFrameFinished = Promise.withResolvers<void>();
  const decoderResetFinished = Promise.withResolvers<void>();
  let decoder = new URDecoder();
  const onScan = jest.fn(async (text: string) => {
    if (text === inFlightPart) await oldFrameFinished.promise;
    return decoder.receivePart(text)
      ? { progress: decoder.estimatedPercentComplete() }
      : {};
  });
  const onResetAnimationData = jest.fn(async () => {
    await decoderResetFinished.promise;
    decoder = new URDecoder();
  });
  render(
    <ScanQrCode
      handleBarCodeScanned={onScan}
      onResetAnimationData={onResetAnimationData}
    />,
  );
  const frame = (text: string) =>
    mockReceiveFrame?.({
      coordinateSpace: 'view',
      symbols: [{ text, centerX: 0.5, centerY: 0.5 }],
    });
  await act(async () => {
    frame(firstPart);
  });
  expect(screen.getByText(/\d+%$/)).toBeTruthy();
  act(() => {
    frame(inFlightPart);
  });
  fireEvent.click(screen.getByText('Switch'));
  expect(screen.queryByText(/\d+%$/)).toBeNull();
  expect(onResetAnimationData).not.toHaveBeenCalled();
  act(() => {
    frame(nextMessagePart);
  });
  expect(onScan.mock.calls).toEqual([[firstPart], [inFlightPart]]);
  await act(async () => {
    oldFrameFinished.resolve();
  });
  expect(onResetAnimationData).toHaveBeenCalledTimes(1);
  expect(screen.queryByText(/\d+%$/)).toBeNull();
  act(() => {
    frame(nextMessagePart);
  });
  expect(onScan).toHaveBeenCalledTimes(2);
  await act(async () => {
    decoderResetFinished.resolve();
  });
  await act(async () => {
    frame(nextMessagePart);
  });
  expect(onScan.mock.calls).toEqual([
    [firstPart],
    [inFlightPart],
    [nextMessagePart],
  ]);
  expect(screen.getByText(/\d+%$/)).toBeTruthy();
});

test('a live selection detected under the album stays hidden until the album closes', () => {
  const onScan = jest.fn(async () => ({}));
  const { rerender } = render(
    <ScanQrCode handleBarCodeScanned={onScan} selectionCovered />,
  );

  fireEvent.click(screen.getByText('MixedFrame'));
  expect(screen.queryByTestId('selector')).toBeNull();
  expect(onScan).not.toHaveBeenCalled();

  rerender(<ScanQrCode handleBarCodeScanned={onScan} />);
  expect(screen.getByTestId('selector').getAttribute('data-symbol-count')).toBe(
    '2',
  );
});

test.each([{ qrWalletScene: true }, { disableNavigationGuard: true }])(
  'keeps raw text capture on the single-symbol path for %j',
  (props) => {
    const onScan = jest.fn(async () => ({}));
    render(<ScanQrCode handleBarCodeScanned={onScan} {...props} />);
    fireEvent.click(screen.getByText('MixedFrame'));
    expect(onScan).toHaveBeenCalledWith('https://example.com');
    expect(
      screen.getByTestId('camera').getAttribute('data-camera-multi-symbol'),
    ).toBe('false');
  },
);

test('desktop without freezing loads browser camera preferences from first render', () => {
  const previousDesktopApi = globalThis.desktopApi;
  mockIsDesktop = true;
  Object.defineProperty(globalThis, 'desktopApi', {
    configurable: true,
    writable: true,
    value: { qrScanner: {} },
  });
  const chromiumKey = EAppSyncStorageKeys.last_scan_camera_id;
  mockGetString.mockImplementation((key) => (key === chromiumKey ? 'b' : 'a'));
  try {
    render(<ScanQrCode handleBarCodeScanned={async () => ({})} />);
    expect(screen.getByTestId('camera').getAttribute('data-camera-id')).toBe(
      'b',
    );
    fireEvent.click(screen.getByText('Ready'));
    expect(mockPersist).toHaveBeenLastCalledWith(chromiumKey, 'b');
  } finally {
    globalThis.desktopApi = previousDesktopApi;
  }
});

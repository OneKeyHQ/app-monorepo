/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { ScanQrCode } from '.';

import { fireEvent, render, screen } from '@testing-library/react';

const mockGetString = jest.fn<string | undefined, []>();
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
  default: { isNative: false },
}));
jest.mock('@onekeyhq/shared/src/storage/appStorage', () => ({
  __esModule: true,
  default: {
    syncStorage: {
      getString: () => mockGetString(),
      set: (key: string, value: string) => mockPersist(key, value),
    },
  },
}));
jest.mock('@onekeyhq/shared/src/utils/extUtils', () => ({}));
jest.mock('@onekeyhq/shared/src/utils/openUrlUtils', () => ({}));
jest.mock('./ScanCamera/useScanCameras', () => ({
  useScanCameras: () => ({
    cameras: [{ id: 'a' }, { id: 'b' }],
    loaded: true,
  }),
}));
jest.mock('./CameraSwitchButton', () => ({
  CameraSwitchButton: ({ onSelect }: { onSelect: (id: string) => void }) => (
    <button type="button" onClick={() => onSelect('b')}>
      Switch
    </button>
  ),
}));
jest.mock('./ScanCamera', () => ({
  ScanCamera: ({
    cameraId,
    children,
    onCameraReady,
    onCameraError,
  }: {
    cameraId?: string;
    children: ReactNode;
    onCameraReady: (id: string) => void;
    onCameraError: (code: string) => void;
  }) => (
    <div data-testid="camera" data-camera-id={cameraId}>
      {children}
      <button type="button" onClick={() => onCameraReady(cameraId ?? 'a')}>
        Ready
      </button>
      <button type="button" onClick={() => onCameraError('camera-busy')}>
        Fail
      </button>
    </div>
  ),
}));

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

/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';

import { Toast } from '@onekeyhq/components';
import PhotoLibrary from '@onekeyhq/shared/src/modules3rdParty/photo-library';
import type {
  EScanQrCodeModalPages,
  IScanQrCodeModalParamList,
} from '@onekeyhq/shared/src/routes';

import { ScanQrCodeTestIDs } from '../testIDs';
import {
  scanFromURLAsync,
  scanSymbolsFromURLAsync,
} from '../utils/scanFromURLAsync';

import ScanQrCodeModal from './ScanQrCodeModal';

import type { IMultiQrSelectionOverlayProps } from '../components/MultiQrSelectionOverlay';

type IRouteCallback =
  IScanQrCodeModalParamList[EScanQrCodeModalPages.ScanQrCodeStack]['callback'];

const mockCloseOrder: string[] = [];
const mockOnCancel = jest.fn();
const mockResetAnimationData = jest.fn<Promise<void>, []>();
const mockAddListener = jest.fn<() => void, [string, () => void]>();
const mockRouteCallback = jest.fn<
  ReturnType<IRouteCallback>,
  Parameters<IRouteCallback>
>();
let mockScan: (value: string) => ReturnType<IRouteCallback>;
let mockResetCapture: (drain?: Promise<void>) => Promise<void>;

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceScanQRCode: { resetAnimationData: () => mockResetAnimationData() },
  },
}));

jest.mock('@react-navigation/core', () => ({
  useRoute: () => ({
    key: 'scan',
    params: { callback: mockRouteCallback, onCancel: mockOnCancel },
  }),
  useNavigation: () => ({ addListener: mockAddListener }),
}));
jest.mock('react-native', () => ({ StyleSheet: { hairlineWidth: 1 } }));
jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/components', () => {
  const Box = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  const Page = Object.assign(Box, {
    Header: ({
      unstable_headerLeftItems,
      headerRight,
    }: {
      unstable_headerLeftItems: () => { element: ReactNode }[];
      headerRight: () => ReactNode;
    }) => (
      <>
        {unstable_headerLeftItems?.()[0]?.element}
        {headerRight?.()}
      </>
    ),
    Body: Box,
    Footer: Box,
  });
  return {
    __esModule: true,
    Page,
    Icon: Box,
    IconButton: ({
      onPress,
      testID,
    }: {
      onPress: () => void;
      testID: string;
    }) => (
      <button
        type="button"
        aria-label={testID}
        data-testid={testID}
        onClick={onPress}
      />
    ),
    SizableText: Box,
    Stack: Box,
    TextAreaInput: Box,
    XStack: Box,
    YStack: Box,
    Toast: { error: jest.fn() },
    useMedia: () => ({ md: false }),
    useSafeAreaInsets: () => ({ bottom: 0 }),
    NavCloseButton: ({ onPress }: { onPress: () => void }) => (
      <button
        type="button"
        aria-label="Close scanner"
        data-testid="header-close"
        onClick={onPress}
      />
    ),
    glassBarItem: (element: ReactNode) => ({ type: 'custom', element }),
    default: ({ onPress, testID }: { onPress: () => void; testID: string }) => (
      <button type="button" data-testid={testID} onClick={onPress}>
        Open photos
      </button>
    ),
  };
});
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: true, isNativeIOS26Plus: true, isNativeAndroid: false },
}));
jest.mock('@onekeyhq/shared/src/appGlobals', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: { scanQrCode: { readQrCode: { readFromCamera: jest.fn() } } },
}));
jest.mock('@onekeyhq/shared/src/modules3rdParty/photo-library', () => ({
  __esModule: true,
  default: { pickImage: jest.fn(), releasePickedImage: jest.fn() },
}));
jest.mock('@onekeyhq/shared/src/storage/appStorage', () => ({
  __esModule: true,
  default: { syncStorage: { getString: () => '', set: jest.fn() } },
}));
jest.mock('../../../hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({ popStack: () => mockCloseOrder.push('pop') }),
}));
jest.mock('../../../components/MultipleClickStack', () => ({
  MultipleClickStack: ({ onPress }: { onPress: () => void }) => (
    <button
      type="button"
      aria-label="Show debug"
      data-testid="show-debug"
      onClick={onPress}
    />
  ),
}));
jest.mock('../components', () => {
  const React = require('react') as typeof import('react');
  return {
    ScanQrCode: React.forwardRef<
      unknown,
      {
        handleBarCodeScanned: typeof mockScan;
        onResetAnimationData: typeof mockResetCapture;
        selectionCovered?: boolean;
      }
    >((props, ref) => {
      mockScan = props.handleBarCodeScanned;
      mockResetCapture = props.onResetAnimationData;
      React.useImperativeHandle(ref, () => ({
        dispose: () => mockCloseOrder.push('dispose'),
      }));
      return (
        <div
          data-testid="live-scanner"
          data-selection-covered={props.selectionCovered}
        />
      );
    }),
  };
});
jest.mock('../components/MultiQrSelectionOverlay', () => ({
  MultiQrSelectionOverlay: ({
    onCancel,
    onSelect,
    symbols,
  }: IMultiQrSelectionOverlayProps) => (
    <>
      <button type="button" onClick={onCancel}>
        Cancel {symbols.length} codes
      </button>
      {symbols.map((symbol) => (
        <button
          key={symbol.text}
          type="button"
          onClick={() => onSelect(symbol)}
        >
          {symbol.text}
        </button>
      ))}
    </>
  ),
}));
jest.mock('../utils/scanFromURLAsync', () => ({
  scanFromURLAsync: jest.fn(),
  scanSymbolsFromURLAsync: jest.fn(),
}));

beforeEach(() => {
  mockCloseOrder.length = 0;
  mockOnCancel.mockClear();
  jest.mocked(Toast.error).mockClear();
  jest.mocked(PhotoLibrary.pickImage).mockReset();
  jest.mocked(PhotoLibrary.releasePickedImage).mockReset().mockResolvedValue();
  jest.mocked(scanFromURLAsync).mockReset();
  jest
    .mocked(scanSymbolsFromURLAsync)
    .mockReset()
    .mockImplementation(async (uri) => {
      const text = await scanFromURLAsync(uri);
      return {
        width: 100,
        height: 100,
        symbols: text ? [{ text, centerX: 0.5, centerY: 0.5 }] : [],
      };
    });
  mockRouteCallback.mockReset().mockResolvedValue({});
  mockResetAnimationData.mockReset().mockResolvedValue();
  mockAddListener.mockReset().mockReturnValue(() => {});
});

test('header and debug close dispose the camera before popping the scan route', () => {
  const { unmount } = render(<ScanQrCodeModal />);
  fireEvent.click(screen.getByTestId('header-close'));
  expect(mockCloseOrder).toEqual(['dispose', 'pop']);

  unmount();
  mockCloseOrder.length = 0;
  render(<ScanQrCodeModal />);
  fireEvent.click(screen.getByTestId('show-debug'));
  fireEvent.click(screen.getByTestId('scan-qr-code-debug-close-btn'));
  expect(mockCloseOrder).toEqual(['dispose', 'pop']);
});

test('closing after multipart progress cancels the pending request', async () => {
  mockRouteCallback.mockResolvedValueOnce({ progress: 0.5 });
  render(<ScanQrCodeModal />);

  await expect(mockScan('ur:part')).resolves.toEqual({ progress: 0.5 });
  fireEvent.click(screen.getByTestId('header-close'));

  expect(mockOnCancel).toHaveBeenCalledTimes(1);
  expect(mockRouteCallback).toHaveBeenCalledTimes(1);
});

test.each([
  ['user dismissal', false],
  ['parser-owned dismissal', true],
])('%s handles an in-flight address result', async (_name, parserOwnsClose) => {
  const pending = Promise.withResolvers<{ progress?: number }>();
  mockRouteCallback.mockReturnValueOnce(pending.promise);
  const { unmount } = render(<ScanQrCodeModal />);
  const scan = mockScan('address');
  await waitFor(() => expect(mockRouteCallback).toHaveBeenCalledTimes(1));
  const [{ onResultDismiss }] = mockRouteCallback.mock.calls[0];

  if (parserOwnsClose) expect(onResultDismiss?.()).toBe(true);
  const [, beforeRemove] = mockAddListener.mock.calls[0];
  beforeRemove();
  unmount();

  if (!parserOwnsClose) {
    expect(onResultDismiss?.()).toBe(false);
  }

  pending.resolve({});
  await scan;
  expect(mockOnCancel).toHaveBeenCalledTimes(parserOwnsClose ? 0 : 1);
  expect(mockRouteCallback).toHaveBeenCalledTimes(1);
});

test('accepts one photo scan from picker launch through parsing', async () => {
  const picker =
    Promise.withResolvers<Awaited<ReturnType<typeof PhotoLibrary.pickImage>>>();
  const decode = Promise.withResolvers<string>();
  const parse = Promise.withResolvers<Awaited<ReturnType<IRouteCallback>>>();
  const pickImage = jest.mocked(PhotoLibrary.pickImage);
  pickImage.mockReturnValueOnce(picker.promise).mockResolvedValue({
    canceled: true,
  });
  jest.mocked(scanFromURLAsync).mockReturnValueOnce(decode.promise);
  mockRouteCallback.mockReturnValueOnce(parse.promise);
  render(<ScanQrCodeModal />);

  const albumButton = screen.getByTestId(ScanQrCodeTestIDs.openPhotoBtn);
  fireEvent.click(albumButton);
  fireEvent.click(albumButton);
  await act(async () => picker.resolve({ canceled: false, uri: 'image' }));
  fireEvent.click(albumButton);
  await act(async () => decode.resolve('photo code'));
  fireEvent.click(albumButton);

  expect(pickImage).toHaveBeenCalledTimes(1);
  expect(PhotoLibrary.releasePickedImage).toHaveBeenCalledWith('image');
  expect(mockRouteCallback).toHaveBeenCalledWith(
    expect.objectContaining({ value: 'photo code' }),
  );

  await act(async () => parse.resolve({ retry: true }));
  await act(async () => fireEvent.click(albumButton));
  expect(pickImage).toHaveBeenCalledTimes(2);
  await expect(mockScan('camera after closing picker')).resolves.toEqual({});
});

test('a photo waits for the abandoned camera frame and shared decoder reset', async () => {
  const cameraParse = Promise.withResolvers<{ progress?: number }>();
  const resetComplete = Promise.withResolvers<void>();
  mockResetAnimationData.mockReturnValueOnce(resetComplete.promise);
  mockRouteCallback.mockReturnValueOnce(cameraParse.promise);
  jest.mocked(PhotoLibrary.pickImage).mockResolvedValueOnce({
    canceled: false,
    uri: 'image',
  });
  jest.mocked(scanFromURLAsync).mockResolvedValueOnce('ur:photo-part');
  render(<ScanQrCodeModal />);

  const camera = mockScan('ur:previous-camera-part');
  await waitFor(() => expect(mockRouteCallback).toHaveBeenCalledTimes(1));
  const [{ isCaptureCurrent, onResultDismiss }] =
    mockRouteCallback.mock.calls[0];
  expect(isCaptureCurrent?.()).toBe(true);
  const reset = mockResetCapture(camera.then(() => {}));
  expect(isCaptureCurrent?.()).toBe(false);
  expect(onResultDismiss?.()).toBe(false);
  await act(async () =>
    fireEvent.click(screen.getByTestId(ScanQrCodeTestIDs.openPhotoBtn)),
  );
  expect(mockResetAnimationData).not.toHaveBeenCalled();
  expect(mockRouteCallback).toHaveBeenCalledTimes(1);

  await act(async () => cameraParse.resolve({ progress: 1 }));
  expect(mockResetAnimationData).toHaveBeenCalledTimes(1);
  expect(mockRouteCallback).toHaveBeenCalledTimes(1);
  await act(async () => {
    resetComplete.resolve();
    await reset;
  });
  expect(mockRouteCallback).toHaveBeenCalledTimes(2);
  expect(mockRouteCallback).toHaveBeenLastCalledWith(
    expect.objectContaining({ value: 'ur:photo-part' }),
  );
});

test('an album scan can retry a failed reset without a live camera frame', async () => {
  const firstReset = Promise.withResolvers<void>();
  const retryReset = Promise.withResolvers<void>();
  mockResetAnimationData
    .mockReturnValueOnce(firstReset.promise)
    .mockReturnValueOnce(retryReset.promise);
  jest.mocked(PhotoLibrary.pickImage).mockResolvedValueOnce({
    canceled: false,
    uri: 'image',
  });
  jest.mocked(scanFromURLAsync).mockResolvedValueOnce('ur:photo-part');
  render(<ScanQrCodeModal />);

  const first = mockResetCapture(Promise.resolve());
  await act(async () =>
    fireEvent.click(screen.getByTestId(ScanQrCodeTestIDs.openPhotoBtn)),
  );
  expect(mockRouteCallback).not.toHaveBeenCalled();
  await act(async () => {
    firstReset.reject(new Error('decoder offline'));
    await expect(first).rejects.toThrow('decoder offline');
  });
  expect(mockResetAnimationData).toHaveBeenCalledTimes(2);
  expect(mockRouteCallback).not.toHaveBeenCalled();
  const cameraRetry = mockResetCapture();
  await act(async () => {
    retryReset.resolve();
    await cameraRetry;
  });
  expect(mockRouteCallback).toHaveBeenCalledWith(
    expect.objectContaining({ value: 'ur:photo-part' }),
  );
  await mockResetCapture();
  expect(mockResetAnimationData).toHaveBeenCalledTimes(2);
});

test.each([false, true])(
  'an album QR can be retried from the same image after repeated reset failures (multi: %s)',
  async (multiple) => {
    const firstReset = Promise.withResolvers<void>();
    const retryReset = Promise.withResolvers<void>();
    mockResetAnimationData
      .mockReturnValueOnce(firstReset.promise)
      .mockReturnValueOnce(retryReset.promise);
    jest.mocked(PhotoLibrary.pickImage).mockResolvedValueOnce({
      canceled: false,
      uri: 'image',
    });
    const photoCode = { text: 'ur:photo-part', centerX: 0.3, centerY: 0.5 };
    jest.mocked(scanSymbolsFromURLAsync).mockResolvedValueOnce({
      width: 100,
      height: 100,
      symbols: multiple
        ? [photoCode, { text: 'other code', centerX: 0.7, centerY: 0.5 }]
        : [photoCode],
    });
    render(<ScanQrCodeModal />);

    const first = mockResetCapture(Promise.resolve());
    await act(async () =>
      fireEvent.click(screen.getByTestId(ScanQrCodeTestIDs.openPhotoBtn)),
    );
    if (multiple) {
      await act(async () =>
        fireEvent.click(screen.getByRole('button', { name: photoCode.text })),
      );
    }
    await act(async () => {
      firstReset.reject(new Error('decoder offline'));
      await expect(first).rejects.toThrow('decoder offline');
    });
    await act(async () =>
      retryReset.reject(new Error('decoder still offline')),
    );

    expect(mockRouteCallback).not.toHaveBeenCalled();
    expect(PhotoLibrary.releasePickedImage).not.toHaveBeenCalled();
    await act(async () =>
      fireEvent.click(screen.getByRole('button', { name: photoCode.text })),
    );
    expect(mockResetAnimationData).toHaveBeenCalledTimes(3);
    expect(mockRouteCallback).toHaveBeenCalledTimes(1);
    expect(mockRouteCallback).toHaveBeenCalledWith(
      expect.objectContaining({ value: photoCode.text }),
    );
    expect(PhotoLibrary.pickImage).toHaveBeenCalledTimes(1);
    expect(PhotoLibrary.releasePickedImage).toHaveBeenCalledTimes(1);
    expect(PhotoLibrary.releasePickedImage).toHaveBeenCalledWith('image');
  },
);

test('allows the camera to retry the same code after photo parsing finishes', async () => {
  const parse = Promise.withResolvers<Awaited<ReturnType<IRouteCallback>>>();
  jest.mocked(PhotoLibrary.pickImage).mockResolvedValueOnce({
    canceled: false,
    uri: 'image',
  });
  jest.mocked(scanFromURLAsync).mockResolvedValueOnce('photo code');
  mockRouteCallback.mockReturnValueOnce(parse.promise);
  render(<ScanQrCodeModal />);

  await act(async () =>
    fireEvent.click(screen.getByTestId(ScanQrCodeTestIDs.openPhotoBtn)),
  );
  expect(mockRouteCallback).toHaveBeenCalledTimes(1);
  await expect(mockScan('camera code')).resolves.toEqual({ retry: true });
  expect(mockRouteCallback).toHaveBeenCalledTimes(1);

  await act(async () => parse.resolve({ retry: true }));
  await expect(mockScan('camera code')).resolves.toEqual({});
  expect(mockRouteCallback).toHaveBeenLastCalledWith(
    expect.objectContaining({ value: 'camera code' }),
  );
});

test('resumes camera scans and allows another album tap after the picker fails', async () => {
  const pickImage = jest.mocked(PhotoLibrary.pickImage);
  pickImage
    .mockRejectedValueOnce(
      new DOMException('User activation expired', 'NotAllowedError'),
    )
    .mockResolvedValueOnce({ canceled: true });
  render(<ScanQrCodeModal />);

  const albumButton = screen.getByTestId(ScanQrCodeTestIDs.openPhotoBtn);
  await act(async () => fireEvent.click(albumButton));
  expect(Toast.error).toHaveBeenCalledTimes(1);
  await expect(mockScan('camera code')).resolves.toEqual({});
  expect(mockRouteCallback).toHaveBeenCalledWith(
    expect.objectContaining({ value: 'camera code' }),
  );
  await act(async () => fireEvent.click(albumButton));
  expect(pickImage).toHaveBeenCalledTimes(2);
});

test('a partial album result with one code waits for selection and releases the file on cancel', async () => {
  jest
    .mocked(PhotoLibrary.pickImage)
    .mockResolvedValueOnce({ canceled: false, uri: 'partial.png' });
  jest.mocked(scanSymbolsFromURLAsync).mockResolvedValueOnce({
    width: 700,
    height: 400,
    partial: true,
    symbols: [{ text: 'partial code', centerX: 0.2, centerY: 0.6 }],
  });
  render(<ScanQrCodeModal />);

  await act(async () =>
    fireEvent.click(screen.getByTestId(ScanQrCodeTestIDs.openPhotoBtn)),
  );
  expect(mockRouteCallback).not.toHaveBeenCalled();
  expect(PhotoLibrary.releasePickedImage).not.toHaveBeenCalled();
  expect(
    screen.getByTestId('live-scanner').getAttribute('data-selection-covered'),
  ).toBe('true');
  await act(async () =>
    fireEvent.click(screen.getByRole('button', { name: 'Cancel 1 codes' })),
  );
  expect(screen.queryByRole('button', { name: 'Cancel 1 codes' })).toBeNull();
  expect(
    screen.getByTestId('live-scanner').getAttribute('data-selection-covered'),
  ).toBe('false');
  expect(PhotoLibrary.releasePickedImage).toHaveBeenCalledWith('partial.png');
});

test('a selected album code excludes camera results until parsing settles', async () => {
  const parse = Promise.withResolvers<Awaited<ReturnType<IRouteCallback>>>();
  jest
    .mocked(PhotoLibrary.pickImage)
    .mockResolvedValueOnce({ canceled: false, uri: 'multi.png' });
  jest.mocked(scanSymbolsFromURLAsync).mockResolvedValueOnce({
    width: 700,
    height: 400,
    symbols: [
      { text: 'first album code', centerX: 0.2, centerY: 0.5 },
      { text: 'second album code', centerX: 0.8, centerY: 0.5 },
    ],
  });
  mockRouteCallback.mockReturnValueOnce(parse.promise);
  render(<ScanQrCodeModal />);
  await act(async () =>
    fireEvent.click(screen.getByTestId(ScanQrCodeTestIDs.openPhotoBtn)),
  );
  await act(async () =>
    fireEvent.click(screen.getByRole('button', { name: 'second album code' })),
  );
  expect(PhotoLibrary.releasePickedImage).toHaveBeenCalledWith('multi.png');
  await expect(mockScan('camera code')).resolves.toEqual({ retry: true });
  expect(mockRouteCallback).toHaveBeenCalledTimes(1);
  expect(mockRouteCallback).toHaveBeenCalledWith(
    expect.objectContaining({ value: 'second album code' }),
  );
  await act(async () => parse.resolve({}));
  await expect(mockScan('camera code')).resolves.toEqual({});
  expect(mockRouteCallback).toHaveBeenLastCalledWith(
    expect.objectContaining({ value: 'camera code' }),
  );
});

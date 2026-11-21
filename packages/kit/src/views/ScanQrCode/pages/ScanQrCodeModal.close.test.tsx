/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { Toast } from '@onekeyhq/components';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import PhotoLibrary from '@onekeyhq/shared/src/modules3rdParty/photo-library';

import { scanFromURLAsync } from '../utils/scanFromURLAsync';

import ScanQrCodeModal from './ScanQrCodeModal';

const mockCloseOrder: string[] = [];
const mockRouteCallback = jest.fn(
  async (_params: {
    value: string;
    canApplyScanResult: () => boolean;
    isScanOpen: () => boolean;
    onResultWillClose?: () => void;
  }): Promise<{ retry?: boolean }> => ({}),
);
let mockCurrentRouteKey = 'scan-route';
let mockScanRouteInStack = true;
let mockBeforeRemove: (() => void) | undefined;
let mockBlur: (() => void) | undefined;
const mockNavigation = {
  addListener: (_event: string, listener: () => void) => {
    mockBeforeRemove = listener;
    return () => {
      mockBeforeRemove = undefined;
    };
  },
};

jest.mock('@react-navigation/core', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    useNavigation: () => mockNavigation,
    useFocusEffect: (effect: () => () => void) => {
      React.useEffect(() => {
        const cleanup = effect();
        mockBlur = cleanup;
        return () => {
          mockBlur = undefined;
          cleanup();
        };
      }, [effect]);
    },
    useRoute: () => ({
      key: 'scan-route',
      params: { callback: mockRouteCallback },
    }),
  };
});
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
        {headerRight()}
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
    Toast: { error: jest.fn(), dismiss: jest.fn() },
    rootNavigationRef: {
      current: {
        getCurrentRoute: () => ({ key: mockCurrentRouteKey }),
        getRootState: () => ({
          routes: [
            { key: 'home' },
            {
              key: 'overlay',
              state: {
                routes: mockScanRouteInStack ? [{ key: 'scan-route' }] : [],
              },
            },
            { key: 'other-route' },
          ],
        }),
      },
    },
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
    default: ({ onPress }: { onPress: () => void }) => (
      <button type="button" aria-label="Pick image" onClick={onPress} />
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
    ScanQrCode: React.forwardRef(
      (
        {
          handleBarCodeScanned,
        }: { handleBarCodeScanned: (value: string) => void },
        ref,
      ) => {
        const hasFrame = React.useRef(false);
        React.useImperativeHandle(ref, () => ({
          dispose: () => mockCloseOrder.push('dispose'),
        }));
        React.useEffect(
          () => () => {
            if (!hasFrame.current) handleBarCodeScanned('');
          },
          [handleBarCodeScanned],
        );
        return (
          <button
            type="button"
            aria-label="Scan frame"
            onClick={() => {
              hasFrame.current = true;
              handleBarCodeScanned('lightning:example');
            }}
          />
        );
      },
    ),
  };
});
jest.mock('../utils/scanFromURLAsync', () => ({ scanFromURLAsync: jest.fn() }));

beforeEach(() => {
  mockCloseOrder.length = 0;
  mockRouteCallback.mockClear();
  jest.mocked(Toast.error).mockClear();
  jest.mocked(Toast.dismiss).mockClear();
  mockCurrentRouteKey = 'scan-route';
  mockScanRouteInStack = true;
  mockBeforeRemove = undefined;
  mockBlur = undefined;
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

test('a parsed frame stops belonging to the scanner when another route opens or the scanner closes', async () => {
  render(<ScanQrCodeModal />);
  fireEvent.click(screen.getByRole('button', { name: 'Scan frame' }));
  await waitFor(() => expect(mockRouteCallback).toHaveBeenCalledTimes(1));
  const [{ canApplyScanResult, isScanOpen }] = mockRouteCallback.mock.calls[0];
  expect(canApplyScanResult()).toBe(true);

  mockCurrentRouteKey = 'other-route';
  expect(canApplyScanResult()).toBe(false);
  expect(isScanOpen()).toBe(true);

  mockCurrentRouteKey = 'scan-route';
  fireEvent.click(screen.getByTestId('header-close'));
  expect(canApplyScanResult()).toBe(false);
  mockScanRouteInStack = false;
  expect(isScanOpen()).toBe(false);
});

test('resumes the camera and cancels on close after a photo result is discarded', async () => {
  let completeImageScan: (value: string) => void = () => {};
  jest.mocked(PhotoLibrary.pickImage).mockResolvedValueOnce({
    canceled: false,
    uri: 'test://image',
  });
  jest.mocked(PhotoLibrary.releasePickedImage).mockResolvedValueOnce(undefined);
  jest.mocked(scanFromURLAsync).mockReturnValueOnce(
    new Promise<string>((resolve) => {
      completeImageScan = resolve;
    }),
  );

  render(<ScanQrCodeModal />);
  fireEvent.click(screen.getByRole('button', { name: 'Pick image' }));
  await waitFor(() =>
    expect(scanFromURLAsync).toHaveBeenCalledWith('test://image'),
  );
  mockCurrentRouteKey = 'other-route';
  completeImageScan('from photo');
  await waitFor(() =>
    expect(PhotoLibrary.releasePickedImage).toHaveBeenCalledWith(
      'test://image',
    ),
  );
  expect(mockRouteCallback).not.toHaveBeenCalled();
  expect(Toast.error).not.toHaveBeenCalled();

  mockCurrentRouteKey = 'scan-route';
  fireEvent.click(screen.getByRole('button', { name: 'Scan frame' }));
  await waitFor(() =>
    expect(mockRouteCallback).toHaveBeenCalledWith(
      expect.objectContaining({ value: 'lightning:example' }),
    ),
  );

  fireEvent.click(screen.getByTestId('header-close'));
  expect(mockRouteCallback).toHaveBeenCalledWith(
    expect.objectContaining({ value: '' }),
  );
});

test('opening the photo picker permanently discards a camera frame already being parsed', async () => {
  let finishPicking: (
    result: Awaited<ReturnType<typeof PhotoLibrary.pickImage>>,
  ) => void = () => {};
  jest.mocked(PhotoLibrary.pickImage).mockReturnValueOnce(
    new Promise((resolve) => {
      finishPicking = resolve;
    }),
  );
  jest.mocked(PhotoLibrary.releasePickedImage).mockResolvedValueOnce(undefined);
  jest.mocked(scanFromURLAsync).mockResolvedValueOnce('selected photo');
  render(<ScanQrCodeModal />);
  fireEvent.click(screen.getByRole('button', { name: 'Scan frame' }));
  await waitFor(() => expect(mockRouteCallback).toHaveBeenCalledTimes(1));
  const [{ canApplyScanResult: canApplyCameraFrame }] =
    mockRouteCallback.mock.calls[0];
  expect(canApplyCameraFrame()).toBe(true);

  fireEvent.click(screen.getByRole('button', { name: 'Pick image' }));
  const cameraOwnsResultWhilePicking = canApplyCameraFrame();
  finishPicking({ canceled: false, uri: 'test://pending-photo' });

  await waitFor(() => expect(mockRouteCallback).toHaveBeenCalledTimes(2));
  const [{ canApplyScanResult: canApplyPhoto, value }] =
    mockRouteCallback.mock.calls[1];
  expect(value).toBe('selected photo');
  expect(canApplyPhoto()).toBe(true);
  expect(cameraOwnsResultWhilePicking).toBe(false);
  expect(canApplyCameraFrame()).toBe(false);
});

test('a broken photo shows the QR error and leaves photo and camera scanning usable', async () => {
  const picker = jest.mocked(PhotoLibrary.pickImage);
  picker.mockClear();
  picker
    .mockResolvedValueOnce({ canceled: false, uri: 'test://broken-image' })
    .mockResolvedValueOnce({ canceled: false, uri: 'test://valid-image' });
  jest.mocked(PhotoLibrary.releasePickedImage).mockResolvedValue(undefined);
  jest
    .mocked(scanFromURLAsync)
    .mockRejectedValueOnce(new OneKeyLocalError('Synthetic image load failure'))
    .mockResolvedValueOnce('invoice from good photo');

  render(<ScanQrCodeModal />);
  const pickImage = screen.getByRole('button', { name: 'Pick image' });
  fireEvent.click(pickImage);
  await waitFor(() =>
    expect(Toast.error).toHaveBeenCalledWith({
      title: ETranslations.scan_no_recognizable_qr_code_found,
    }),
  );
  expect(PhotoLibrary.releasePickedImage).toHaveBeenCalledWith(
    'test://broken-image',
  );
  fireEvent.click(screen.getByRole('button', { name: 'Scan frame' }));
  await waitFor(() => expect(mockRouteCallback).toHaveBeenCalledTimes(1));
  fireEvent.click(pickImage);
  await waitFor(() => expect(mockRouteCallback).toHaveBeenCalledTimes(2));
  expect(mockRouteCallback.mock.calls.map(([params]) => params.value)).toEqual([
    'lightning:example',
    'invoice from good photo',
  ]);
  expect(picker).toHaveBeenCalledTimes(2);
});

test('a successful photo keeps its result when the camera unmounts during navigation', async () => {
  jest.mocked(PhotoLibrary.pickImage).mockResolvedValueOnce({
    canceled: false,
    uri: 'test://photo',
  });
  jest.mocked(PhotoLibrary.releasePickedImage).mockResolvedValueOnce(undefined);
  jest.mocked(scanFromURLAsync).mockResolvedValueOnce('invoice from photo');
  let finishClosing: () => void = () => {};
  let startClosing: () => void = () => {};
  const closing = new Promise<void>((resolve) => {
    startClosing = resolve;
  });
  mockRouteCallback.mockImplementationOnce(async ({ onResultWillClose }) => {
    onResultWillClose?.();
    startClosing();
    await new Promise<void>((resolve) => {
      finishClosing = resolve;
    });
    return {};
  });
  const { unmount } = render(<ScanQrCodeModal />);
  fireEvent.click(screen.getByRole('button', { name: 'Pick image' }));

  await closing;
  mockBeforeRemove?.();
  mockScanRouteInStack = false;
  unmount();
  finishClosing();

  expect(mockRouteCallback.mock.calls.map(([params]) => params.value)).toEqual([
    'invoice from photo',
  ]);
});

test('Android Back cancels a scan after the camera delivered a frame', async () => {
  const { unmount } = render(<ScanQrCodeModal />);
  fireEvent.click(screen.getByRole('button', { name: 'Scan frame' }));
  await waitFor(() => expect(mockRouteCallback).toHaveBeenCalledTimes(1));

  mockBeforeRemove?.();
  mockScanRouteInStack = false;
  unmount();

  expect(mockRouteCallback.mock.calls.map(([params]) => params.value)).toEqual([
    'lightning:example',
    '',
  ]);
});

test('a retryable photo result can be submitted again without reopening the photo picker', async () => {
  jest.mocked(PhotoLibrary.pickImage).mockClear();
  jest.mocked(PhotoLibrary.pickImage).mockResolvedValueOnce({
    canceled: false,
    uri: 'test://retry-photo',
  });
  jest.mocked(PhotoLibrary.releasePickedImage).mockResolvedValueOnce(undefined);
  jest.mocked(scanFromURLAsync).mockResolvedValueOnce('invoice from photo');
  mockRouteCallback.mockResolvedValueOnce({ retry: true });

  render(<ScanQrCodeModal />);
  fireEvent.click(screen.getByRole('button', { name: 'Pick image' }));

  await waitFor(() =>
    expect(Toast.error).toHaveBeenCalledWith({
      toastId: 'scan-route:photo-retry',
      title: ETranslations.global_server_error,
      actions: expect.objectContaining({
        label: ETranslations.global_try_again,
      }),
    }),
  );
  expect(mockCloseOrder).toEqual([]);

  const [{ actions }] = jest.mocked(Toast.error).mock.calls[0];
  const retry = Array.isArray(actions) ? actions[0] : actions;
  await retry?.onPress?.();
  expect(mockRouteCallback.mock.calls.map(([params]) => params.value)).toEqual([
    'invoice from photo',
    'invoice from photo',
  ]);
  expect(PhotoLibrary.pickImage).toHaveBeenCalledTimes(1);
});

test('only the most recently selected photo can be retried', async () => {
  jest
    .mocked(PhotoLibrary.pickImage)
    .mockResolvedValueOnce({ canceled: false, uri: 'test://first-photo' })
    .mockResolvedValueOnce({ canceled: false, uri: 'test://second-photo' });
  jest.mocked(PhotoLibrary.releasePickedImage).mockResolvedValue(undefined);
  jest
    .mocked(scanFromURLAsync)
    .mockResolvedValueOnce('first invoice')
    .mockResolvedValueOnce('second invoice');
  mockRouteCallback
    .mockResolvedValueOnce({ retry: true })
    .mockResolvedValueOnce({ retry: true });
  render(<ScanQrCodeModal />);

  const picker = screen.getByRole('button', { name: 'Pick image' });
  fireEvent.click(picker);
  await waitFor(() => expect(Toast.error).toHaveBeenCalledTimes(1));
  fireEvent.click(picker);
  await waitFor(() => expect(Toast.error).toHaveBeenCalledTimes(2));

  const [first, second] = jest.mocked(Toast.error).mock.calls.map(([toast]) => {
    return Array.isArray(toast.actions) ? toast.actions[0] : toast.actions;
  });
  await first?.onPress?.();
  expect(mockRouteCallback).toHaveBeenCalledTimes(2);

  await second?.onPress?.();
  expect(mockRouteCallback.mock.calls.map(([params]) => params.value)).toEqual([
    'first invoice',
    'second invoice',
    'second invoice',
  ]);
});

test.each(['header close', 'system Back', 'focus loss'])(
  'dismisses the photo retry toast on %s',
  async (exit) => {
    jest.mocked(PhotoLibrary.pickImage).mockResolvedValueOnce({
      canceled: false,
      uri: 'test://retry-photo',
    });
    jest
      .mocked(PhotoLibrary.releasePickedImage)
      .mockResolvedValueOnce(undefined);
    jest.mocked(scanFromURLAsync).mockResolvedValueOnce('invoice from photo');
    mockRouteCallback.mockResolvedValueOnce({ retry: true });
    render(<ScanQrCodeModal />);
    fireEvent.click(screen.getByRole('button', { name: 'Pick image' }));
    await waitFor(() => expect(Toast.error).toHaveBeenCalledTimes(1));
    const [{ actions, toastId }] = jest.mocked(Toast.error).mock.calls[0];
    const retry = Array.isArray(actions) ? actions[0] : actions;
    jest.mocked(Toast.dismiss).mockClear();

    if (exit === 'header close') {
      fireEvent.click(screen.getByTestId('header-close'));
    } else if (exit === 'system Back') {
      mockBeforeRemove?.();
    } else {
      mockCurrentRouteKey = 'other-route';
      mockBlur?.();
    }

    expect(Toast.dismiss).toHaveBeenCalledWith(toastId);
    const callsAfterExit = mockRouteCallback.mock.calls.length;
    await retry?.onPress?.();
    expect(mockRouteCallback).toHaveBeenCalledTimes(callsAfterExit);
  },
);

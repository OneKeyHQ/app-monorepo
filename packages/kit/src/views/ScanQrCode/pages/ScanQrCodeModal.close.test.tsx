/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { fireEvent, render, screen, waitFor } from '@testing-library/react';

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
  }) => ({}),
);
let mockCurrentRouteKey = 'scan-route';
let mockScanRouteInStack = true;
let mockBeforeRemove: (() => void) | undefined;
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
      React.useEffect(effect, [effect]);
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
    Toast: { error: jest.fn() },
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
  mockCurrentRouteKey = 'scan-route';
  mockScanRouteInStack = true;
  mockBeforeRemove = undefined;
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

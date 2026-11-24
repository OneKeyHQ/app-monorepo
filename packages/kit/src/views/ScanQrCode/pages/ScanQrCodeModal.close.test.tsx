/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';

import PhotoLibrary from '@onekeyhq/shared/src/modules3rdParty/photo-library';
import type {
  EScanQrCodeModalPages,
  IScanQrCodeModalParamList,
} from '@onekeyhq/shared/src/routes';

import { ScanQrCodeTestIDs } from '../testIDs';
import { scanFromURLAsync } from '../utils/scanFromURLAsync';

import ScanQrCodeModal from './ScanQrCodeModal';

type IRouteCallback =
  IScanQrCodeModalParamList[EScanQrCodeModalPages.ScanQrCodeStack]['callback'];

const mockCloseOrder: string[] = [];
const mockOnCancel = jest.fn();
const mockAddListener = jest.fn<() => void, [string, () => void]>();
const mockRouteCallback = jest.fn<
  ReturnType<IRouteCallback>,
  Parameters<IRouteCallback>
>();
let mockScan: (value: string) => ReturnType<IRouteCallback>;

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
      { handleBarCodeScanned: typeof mockScan }
    >((props, ref) => {
      mockScan = props.handleBarCodeScanned;
      React.useImperativeHandle(ref, () => ({
        dispose: () => mockCloseOrder.push('dispose'),
      }));
      return null;
    }),
  };
});
jest.mock('../utils/scanFromURLAsync', () => ({ scanFromURLAsync: jest.fn() }));

beforeEach(() => {
  mockCloseOrder.length = 0;
  mockOnCancel.mockClear();
  jest.mocked(PhotoLibrary.pickImage).mockReset();
  jest.mocked(PhotoLibrary.releasePickedImage).mockReset().mockResolvedValue();
  jest.mocked(scanFromURLAsync).mockReset();
  mockRouteCallback.mockReset().mockResolvedValue({});
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

/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import type {
  EScanQrCodeModalPages,
  IScanQrCodeModalParamList,
} from '@onekeyhq/shared/src/routes';

import ScanQrCodeModal from './ScanQrCodeModal';

type IRouteCallback =
  IScanQrCodeModalParamList[EScanQrCodeModalPages.ScanQrCodeStack]['callback'];

const mockCloseOrder: string[] = [];
const mockAddListener = jest.fn<() => void, [string, () => void]>();
const mockRouteCallback = jest.fn<
  Promise<{ progress?: number }>,
  Parameters<IRouteCallback>
>();
let mockScan: (value: string) => Promise<{ progress?: number }>;

jest.mock('@react-navigation/core', () => ({
  useRoute: () => ({ key: 'scan', params: { callback: mockRouteCallback } }),
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
    }: {
      unstable_headerLeftItems: () => { element: ReactNode }[];
    }) => <>{unstable_headerLeftItems?.()[0]?.element}</>,
    Body: Box,
    Footer: Box,
  });
  return {
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
    default: () => null,
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

  expect(mockRouteCallback).toHaveBeenLastCalledWith({
    value: '',
    popNavigation: false,
    routeKey: 'scan',
  });
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
    expect(mockRouteCallback).toHaveBeenLastCalledWith({
      value: '',
      popNavigation: false,
      routeKey: 'scan',
    });
    expect(onResultDismiss?.()).toBe(false);
  }

  pending.resolve({});
  await scan;
  expect(mockRouteCallback).toHaveBeenCalledTimes(parserOwnsClose ? 1 : 2);
});

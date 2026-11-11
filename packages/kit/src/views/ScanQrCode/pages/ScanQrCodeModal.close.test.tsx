/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import ScanQrCodeModal from './ScanQrCodeModal';

const mockCloseOrder: string[] = [];

jest.mock('@react-navigation/core', () => ({
  useRoute: () => ({ params: { callback: jest.fn(async () => ({})) } }),
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
  default: { syncStorage: { getString: () => '' } },
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
    ScanQrCode: React.forwardRef((_props, ref) => {
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

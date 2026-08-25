/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { act, fireEvent, render, screen } from '@testing-library/react';

const mockBootstrapResolvers: Array<() => void> = [];
const mockBootstrapNativeStorage = jest.fn<
  Promise<void>,
  [{ force?: boolean }]
>(
  () =>
    new Promise((resolve) => {
      mockBootstrapResolvers.push(resolve);
    }),
);
const mockHideNativeStorageBootstrapSplash = jest.fn();

jest.mock('react-native', () => ({
  ActivityIndicator: ({ testID }: { testID?: string }) => (
    <div data-testid={testID} />
  ),
  Pressable: ({
    children,
    onPress,
    testID,
  }: {
    children?: ReactNode;
    onPress?: () => void;
    testID?: string;
  }) => (
    <button data-testid={testID} onClick={onPress} type="button">
      {children}
    </button>
  ),
  StyleSheet: {
    create: (styles: unknown) => styles,
  },
  Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  View: ({ children, testID }: { children?: ReactNode; testID?: string }) => (
    <div data-testid={testID}>{children}</div>
  ),
  useColorScheme: () => 'light',
}));

jest.mock('./bootstrapNativeStorage', () => ({
  bootstrapNativeStorage: (options: { force?: boolean }) =>
    mockBootstrapNativeStorage(options),
}));

jest.mock('./nativeStorageBootstrapSplash', () => ({
  hideNativeStorageBootstrapSplash: () => {
    mockHideNativeStorageBootstrapSplash();
  },
}));

jest.mock(
  '../../App',
  (): { __esModule: boolean; default: () => ReactNode } => ({
    __esModule: true,
    default: () => <div data-testid="business-app" />,
  }),
);

jest.useFakeTimers();

const { NativeStorageBootstrapRoot } =
  require('./NativeStorageBootstrapRoot') as typeof import('./NativeStorageBootstrapRoot');

describe('NativeStorageBootstrapRoot', () => {
  afterAll(() => {
    jest.useRealTimers();
  });

  it('renders a waiting surface and turns a hung bootstrap into a retryable error', async () => {
    render(<NativeStorageBootstrapRoot />);

    expect(screen.getByTestId('native-storage-bootstrap-waiting')).toBeTruthy();

    await act(async () => {
      jest.advanceTimersByTime(65_000);
      await Promise.resolve();
    });

    expect(screen.getByText('Storage initialization failed')).toBeTruthy();
    expect(
      screen.getByText('Native storage bootstrap timed out after 65 seconds'),
    ).toBeTruthy();
    expect(screen.getByTestId('native-storage-migration-retry')).toBeTruthy();
    expect(mockHideNativeStorageBootstrapSplash).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('native-storage-migration-retry'));

    expect(screen.getByTestId('native-storage-bootstrap-waiting')).toBeTruthy();
    expect(mockBootstrapNativeStorage.mock.calls).toEqual([
      [{ force: false }],
      [{ force: true }],
    ]);

    await act(async () => {
      mockBootstrapResolvers[0]?.();
      await Promise.resolve();
    });
    expect(screen.getByTestId('native-storage-bootstrap-waiting')).toBeTruthy();

    await act(async () => {
      mockBootstrapResolvers[1]?.();
      await Promise.resolve();
    });
    expect(screen.getByTestId('business-app')).toBeTruthy();
  });
});

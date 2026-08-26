/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { act, fireEvent, render, screen } from '@testing-library/react';

const mockBootstrapResolvers: Array<() => void> = [];
const mockBootstrapRejectors: Array<(error: Error) => void> = [];
const mockBootstrapNativeStorage = jest.fn<
  Promise<void>,
  [{ force?: boolean }]
>(
  () =>
    new Promise((resolve, reject) => {
      mockBootstrapResolvers.push(resolve);
      mockBootstrapRejectors.push(reject);
    }),
);
const mockHideNativeStorageBootstrapSplash = jest.fn();
const mockCallNativeStorage = jest.fn<Promise<void>, [unknown]>(
  async () => undefined,
);

jest.mock('@onekeyhq/shared/src/storage/nativeStorageBridge', () => ({
  callNativeStorage: (request: unknown) => mockCallNativeStorage(request),
}));

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
      mockBootstrapRejectors[1]?.(
        new Error(
          'Native storage migration target is inconsistent:appStorage; App-storage MMKV migration marker is missing after migration completed',
        ),
      );
      await Promise.resolve();
    });
    expect(screen.getByText('Local storage needs repair')).toBeTruthy();
    expect(screen.queryByTestId('native-storage-migration-retry')).toBeNull();

    fireEvent.click(screen.getByTestId('native-storage-migration-repair'));
    expect(
      screen.getByTestId('native-storage-migration-repair-confirm'),
    ).toBeTruthy();
    fireEvent.click(
      screen.getByTestId('native-storage-migration-repair-confirm'),
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(mockCallNativeStorage).toHaveBeenCalledWith({
      scope: 'recovery',
      operation: 'resetMigrationTarget',
      target: 'appStorage',
    });
    expect(mockBootstrapNativeStorage.mock.calls).toEqual([
      [{ force: false }],
      [{ force: true }],
      [{ force: true }],
    ]);

    await act(async () => {
      mockBootstrapResolvers[2]?.();
      await Promise.resolve();
    });
    expect(screen.getByTestId('business-app')).toBeTruthy();
  });
});

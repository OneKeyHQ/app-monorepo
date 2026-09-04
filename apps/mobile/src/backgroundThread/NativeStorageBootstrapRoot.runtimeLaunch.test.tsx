/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { act, fireEvent, render, screen } from '@testing-library/react';

const mockAppRestart = jest.fn(
  (_options: unknown) => new Promise<void>(() => undefined),
);
const mockBootstrapNativeStorage = jest.fn(async () => undefined);
const mockCompleteRuntimeLaunchAcknowledgement = jest.fn(async () => false);
const mockHideNativeStorageBootstrapSplash = jest.fn();
const mockInitializeJotaiFromBackground = jest.fn(async () => undefined);
const mockForceDisableTravelModeForRecovery = jest.fn(async () => undefined);

jest.mock('@onekeyhq/shared/src/modules3rdParty/appRestart', () => ({
  appRestart: (options: unknown) => mockAppRestart(options),
  EAppRestartMode: { All: 'all' },
}));

jest.mock('@onekeyhq/shared/src/storage/nativeStorageBridge', () => ({
  callNativeStorage: jest.fn(),
}));

jest.mock('@onekeyhq/shared/src/travelMode', () => ({
  travelModeManager: {},
}));

jest.mock('@onekeyhq/shared/src/travelMode/nativeLaunchEpoch', () => ({
  forceDisableTravelModeForRecovery: () =>
    mockForceDisableTravelModeForRecovery(),
}));

jest.mock(
  '@onekeyhq/shared/src/travelMode/runtimeLaunchAcknowledgement',
  () => ({
    completeTravelModeRuntimeLaunchAcknowledgement: () =>
      mockCompleteRuntimeLaunchAcknowledgement(),
  }),
);

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    initializeJotaiFromBackground: () => mockInitializeJotaiFromBackground(),
  },
}));

jest.mock('./jotaiMainHydrationGate', () => ({
  runJotaiMainHydration: (initializeFromBackground: () => Promise<void>) =>
    initializeFromBackground(),
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
  StyleSheet: { create: (styles: unknown) => styles },
  Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  View: ({ children, testID }: { children?: ReactNode; testID?: string }) => (
    <div data-testid={testID}>{children}</div>
  ),
  useColorScheme: () => 'light',
}));

jest.mock('./bootstrapNativeStorage', () => ({
  bootstrapNativeStorage: () => mockBootstrapNativeStorage(),
}));

jest.mock('./nativeStorageBootstrapSplash', () => ({
  hideNativeStorageBootstrapSplash: () => {
    mockHideNativeStorageBootstrapSplash();
  },
}));

jest.mock('../../App', () => ({
  __esModule: true,
  default: () => <div data-testid="business-app" />,
}));

const { NativeStorageBootstrapRoot } =
  require('./NativeStorageBootstrapRoot') as typeof import('./NativeStorageBootstrapRoot');

describe('NativeStorageBootstrapRoot runtime launch recovery', () => {
  it('restarts a timed-out launch even when forcing the native profile fails', async () => {
    render(<NativeStorageBootstrapRoot />);

    await act(async () => {
      for (let index = 0; index < 10; index += 1) {
        await Promise.resolve();
      }
    });

    expect(screen.getByText('Runtime launch verification failed')).toBeTruthy();
    expect(mockInitializeJotaiFromBackground).not.toHaveBeenCalled();
    expect(screen.queryByTestId('native-storage-migration-retry')).toBeNull();
    expect(
      screen.queryByTestId('native-storage-bootstrap-restart-app'),
    ).toBeNull();

    mockForceDisableTravelModeForRecovery.mockRejectedValueOnce(
      new Error('Native recovery storage unavailable'),
    );
    fireEvent.click(screen.getByTestId('travel-mode-runtime-launch-retry'));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockForceDisableTravelModeForRecovery).toHaveBeenCalledTimes(1);
    expect(mockAppRestart).toHaveBeenCalledWith({
      mode: 'all',
      reason: 'travel-mode.runtime-launch.restart',
    });
    expect(
      mockForceDisableTravelModeForRecovery.mock.invocationCallOrder[0],
    ).toBeLessThan(mockAppRestart.mock.invocationCallOrder[0]);
  });
});

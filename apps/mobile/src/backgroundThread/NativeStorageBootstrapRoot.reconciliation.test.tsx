/** @jest-environment jsdom */

import { act, render, screen } from '@testing-library/react';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

const mockBootstrap = jest.fn<Promise<void>, []>(async () => {
  throw new OneKeyLocalError('Background temporarily unavailable');
});
const mockStorageCall = jest.fn<Promise<unknown>, [unknown]>(
  async () => undefined,
);
const mockRestart = jest.fn<Promise<void>, [unknown]>(async () => undefined);
const mockHydrate = jest.fn<Promise<void>, []>(async () => {
  throw new OneKeyLocalError('Canonical state temporarily unavailable');
});
const mockLoadErrorScreen = jest.fn();

jest.mock('./NativeStorageBootstrapErrorScreen', () => {
  mockLoadErrorScreen();
  return jest.requireActual<
    typeof import('./NativeStorageBootstrapErrorScreen')
  >('./NativeStorageBootstrapErrorScreen');
});

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: { app: { bootstrap: { initDeferredStep: jest.fn() } } },
}));
jest.mock(
  '@onekeyhq/shared/src/modules3rdParty/react-native-file-logger',
  () => ({
    LogLevel: { Debug: 0, Info: 1, Warning: 2, Error: 3 },
    NativeLogger: { write: jest.fn() },
  }),
);
jest.mock('../splitBundle/segmentManifest', () => ({
  getSegmentEntry: (key: string) => ({
    id: 3297,
    key,
    runtime: 'main',
    relativePath: 'segments/storage-repair.seg.hbc',
    sha256: 'test',
    dependsOn: [],
  }),
  isSegmentAllowedInRuntime: () => true,
}));

jest.mock('@onekeyfe/react-native-native-overlay', () => ({
  OverlayView: ({ children }: { children?: import('react').ReactNode }) =>
    children,
}));

jest.mock('react-native', () => ({
  Modal: ({ children }: { children?: import('react').ReactNode }) => (
    <div>{children}</div>
  ),
  ScrollView: ({ children }: { children?: import('react').ReactNode }) => (
    <div>{children}</div>
  ),
  ActivityIndicator: ({ testID }: { testID?: string }) => (
    <div data-testid={testID} />
  ),
  Pressable: ({
    children,
    onPress,
    testID,
  }: {
    children?: import('react').ReactNode;
    onPress?: () => void;
    testID?: string;
  }) => (
    <button type="button" data-testid={testID} onClick={onPress}>
      {children}
    </button>
  ),
  Text: ({ children }: { children?: import('react').ReactNode }) => (
    <span>{children}</span>
  ),
  View: ({ children }: { children?: import('react').ReactNode }) => (
    <div>{children}</div>
  ),
  StyleSheet: { create: (styles: unknown) => styles },
  useColorScheme: () => 'light',
}));
jest.mock('@onekeyhq/kit/src/utils/swrCacheMutationInvalidation', () => ({
  registerSwrCacheMutationInvalidation: jest.fn(),
}));
jest.mock('@onekeyhq/shared/src/modules3rdParty/appRestart', () => ({
  appRestart: (options: unknown) => mockRestart(options),
  EAppRestartMode: { All: 'all' },
}));
jest.mock('@onekeyhq/shared/src/storage/nativeStorageBridge', () => ({
  callNativeStorage: (request: unknown) => mockStorageCall(request),
}));
jest.mock('@onekeyhq/shared/src/travelMode', () => ({ travelModeManager: {} }));
jest.mock(
  '@onekeyhq/shared/src/travelMode/runtimeLaunchAcknowledgement',
  () => ({ completeTravelModeRuntimeLaunchAcknowledgement: async () => true }),
);
jest.mock(
  '@onekeyhq/kit-bg/src/states/jotai/jotaiInitFromNativeStorage',
  () => ({
    hydrateJotaiFromNativeStorage: async () => ({
      hydrated: true,
      atomCount: 62,
    }),
  }),
);
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: { initializeJotaiFromBackground: () => mockHydrate() },
}));
jest.mock('./jotaiMainHydrationGate', () => ({
  runJotaiMainHydration: (initialize: () => Promise<void>) => initialize(),
}));
jest.mock('./bootstrapNativeStorage', () => ({
  bootstrapNativeStorage: () => mockBootstrap(),
  hydrateColdStartSnapshotAfterRuntimeLaunch: jest.fn(),
  waitForColdStartCriticalImagesBeforeMount: async () => undefined,
}));
jest.mock('./nativeStorageBootstrapSplash', () => ({
  hideNativeStorageBootstrapSplash: jest.fn(),
}));
jest.mock('../../App', () => ({
  __esModule: true,
  default: () => <div data-testid="business-app" />,
}));

jest.useFakeTimers();
const { NativeStorageBootstrapRoot } =
  require('./NativeStorageBootstrapRoot') as typeof import('./NativeStorageBootstrapRoot');
const flush = async () => {
  await act(async () => {
    for (let index = 0; index < 25; index += 1) await Promise.resolve();
  });
};

describe('initial background reconciliation after local hydration', () => {
  afterAll(() => jest.useRealTimers());

  it('continues reconciling mirrors and canonical state after the initial retry window', async () => {
    mockBootstrap.mockRejectedValue(
      new Error('Background temporarily unavailable'),
    );
    mockHydrate.mockRejectedValue(
      new Error('Canonical state temporarily unavailable'),
    );
    render(<NativeStorageBootstrapRoot />);
    await flush();
    expect(screen.getByTestId('business-app')).toBeTruthy();
    for (const delay of [1000, 3000, 10_000]) {
      await act(async () => {
        await jest.advanceTimersByTimeAsync(delay);
      });
      await flush();
    }
    expect(mockBootstrap).toHaveBeenCalledTimes(4);
    mockBootstrap.mockResolvedValue(undefined);
    for (let index = 0; index < 4; index += 1) {
      await act(async () => {
        await jest.advanceTimersByTimeAsync(10_000);
      });
      await flush();
    }
    expect(mockHydrate).toHaveBeenCalledTimes(4);
    mockHydrate.mockResolvedValue(undefined);
    await act(async () => {
      await jest.advanceTimersByTimeAsync(10_000);
    });
    await flush();
    expect(mockHydrate).toHaveBeenCalledTimes(5);
    const calls = mockBootstrap.mock.calls.length;
    await act(async () => {
      await jest.advanceTimersByTimeAsync(60_000);
    });
    expect(mockBootstrap).toHaveBeenCalledTimes(calls);
  });
});

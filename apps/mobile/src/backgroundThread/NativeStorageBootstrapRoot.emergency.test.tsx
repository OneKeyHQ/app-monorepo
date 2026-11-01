/** @jest-environment jsdom */

import { act, fireEvent, render, screen } from '@testing-library/react';

import { requestNativeStorageRecovery } from '@onekeyhq/shared/src/storage/nativeStorageRecovery';

const mockMismatch = new Error(
  'Native storage migration target is inconsistent:appStorage; App-storage MMKV migration marker is missing after migration completed',
);
const mockBootstrap = jest.fn<Promise<void>, []>(async () => {
  throw mockMismatch;
});
const mockStorageCall = jest.fn<Promise<unknown>, [unknown]>(
  async () => undefined,
);
const mockRestart = jest.fn<Promise<void>, [unknown]>(async () => undefined);
const mockHydrate = jest.fn(async () => undefined);

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

jest.mock('react-native', () => ({
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

describe('public emergency continuation UI', () => {
  afterAll(() => jest.useRealTimers());
  it('requires a second confirmation and keeps activated mode distinct from completed repair across hydration and restart failures', async () => {
    render(<NativeStorageBootstrapRoot />);
    await flush();
    act(() => requestNativeStorageRecovery('appStorage'));
    await flush();
    expect(screen.queryByTestId('native-storage-emergency-open')).toBeNull();
    mockStorageCall.mockRejectedValueOnce(new Error('repair unavailable'));
    fireEvent.click(
      screen.getByTestId('native-storage-migration-repair-attempt'),
    );
    await flush();
    expect(screen.getByTestId('native-storage-emergency-open')).toBeTruthy();
    const attempts = mockStorageCall.mock.calls.length;
    fireEvent.click(screen.getByTestId('native-storage-emergency-open'));
    expect(mockStorageCall).toHaveBeenCalledTimes(attempts);
    expect(
      screen.getByText(
        /future restore of legacy may discard those new changes/,
      ),
    ).toBeTruthy();
    fireEvent.click(screen.getByTestId('native-storage-emergency-cancel'));
    expect(mockStorageCall).toHaveBeenCalledTimes(attempts);
    fireEvent.click(screen.getByTestId('native-storage-emergency-open'));
    mockStorageCall.mockResolvedValueOnce({
      mode: 'emergency',
      phase: 'active',
      epoch: '1-test',
      policy: 'retain-current-without-legacy-merge-v1',
    });
    mockBootstrap.mockResolvedValueOnce(undefined);
    mockHydrate.mockRejectedValueOnce(new Error('jotai unavailable'));
    fireEvent.click(screen.getByTestId('native-storage-emergency-confirm'));
    await flush();
    expect(mockStorageCall).toHaveBeenLastCalledWith({
      scope: 'recovery',
      operation: 'enableEmergencyAppStorage',
      confirmed: true,
    });
    expect(screen.getByText('Emergency storage mode enabled')).toBeTruthy();
    expect(screen.queryByText('Storage repair complete')).toBeNull();
    expect(screen.getByText(/Migration is NOT complete/)).toBeTruthy();
    expect(
      screen.getByText(/app state could not be refreshed or restarted/),
    ).toBeTruthy();
    expect(screen.queryByTestId('business-app')).toBeNull();
    expect(screen.queryByTestId('native-storage-repair-back')).toBeNull();
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(mockRestart).not.toHaveBeenCalled();
    mockRestart.mockRejectedValueOnce(new Error('restart unavailable'));
    fireEvent.click(screen.getByTestId('native-storage-emergency-close'));
    await flush();
    expect(mockRestart).toHaveBeenLastCalledWith({
      mode: 'all',
      reason: 'storage.migration.emergency',
    });
    expect(screen.getByTestId('native-storage-emergency-close')).toBeTruthy();
    expect(screen.queryByTestId('business-app')).toBeNull();
    fireEvent.click(screen.getByTestId('native-storage-emergency-close'));
    await flush();
    expect(mockRestart).toHaveBeenCalledTimes(2);
    expect(mockStorageCall).toHaveBeenCalledTimes(attempts + 1);
    expect(screen.getByTestId('native-storage-repair-progress')).toBeTruthy();
  });
});

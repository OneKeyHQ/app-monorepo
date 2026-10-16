/** @jest-environment jsdom */

import { act, fireEvent, render, screen } from '@testing-library/react';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
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
const mockLoadErrorScreen = jest.fn();
const SCREEN_SEGMENT_KEY =
  'seg:apps.mobile.src.backgroundThread.NativeStorageBootstrapErrorScreen';

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

describe('native storage recovery after fast startup', () => {
  afterAll(() => {
    jest.useRealTimers();
  });

  it('requires force for incomplete results, automatically completes success, and only restarts on close', async () => {
    const loader = jest.requireActual<
      typeof import('../splitBundle/installProdBundleLoader')
    >('../splitBundle/installProdBundleLoader');
    const nativeLoad = jest.fn<Promise<void>, [unknown]>(async () => undefined);
    nativeLoad.mockRejectedValueOnce(
      new OneKeyLocalError('Recovery screen segment unavailable'),
    );
    loader.setNativeLoader({
      getRuntimeBundleContext: async () => ({
        runtimeKind: 'main',
        sourceKind: 'builtin',
        bundleRoot: '/app',
        nativeVersion: '1.0',
      }),
      loadSegment: nativeLoad,
    });
    let cachedSegmentError: Error = new OneKeyLocalError(
      'Expected the first segment load to fail',
    );
    try {
      await loader.loadSegment(SCREEN_SEGMENT_KEY);
    } catch (error) {
      if (!(error instanceof Error)) {
        throw new OneKeyLocalError('Expected a segment load Error');
      }
      cachedSegmentError = error;
    }
    expect(cachedSegmentError).toEqual(
      expect.objectContaining({ segmentKey: SCREEN_SEGMENT_KEY }),
    );
    // An ordinary import cannot dispatch native again after a fatal failure.
    await expect(loader.loadSegment(SCREEN_SEGMENT_KEY)).rejects.toBe(
      cachedSegmentError,
    );
    expect(nativeLoad).toHaveBeenCalledTimes(1);
    mockLoadErrorScreen.mockImplementation(() => {
      if (loader.getSegmentState(SCREEN_SEGMENT_KEY) === 'failed') {
        throw cachedSegmentError;
      }
    });
    render(<NativeStorageBootstrapRoot />);
    await flush();
    expect(screen.getByTestId('business-app')).toBeTruthy();
    expect(mockLoadErrorScreen).not.toHaveBeenCalled();
    act(() => requestNativeStorageRecovery('appStorage'));
    await flush();
    expect(mockLoadErrorScreen).toHaveBeenCalledTimes(1);
    expect(
      screen.getByText(/Could not load the storage repair screen/),
    ).toBeTruthy();
    expect(mockStorageCall).not.toHaveBeenCalled();
    mockRestart.mockRejectedValueOnce(new Error('restart unavailable'));
    fireEvent.click(screen.getByTestId('native-storage-error-screen-restart'));
    await flush();
    expect(mockRestart).toHaveBeenCalledWith({
      mode: 'all',
      reason: 'storage.recovery-screen.restart',
    });
    expect(
      screen.getByTestId('native-storage-error-screen-retry'),
    ).toBeTruthy();
    mockRestart.mockClear();
    fireEvent.click(screen.getByTestId('native-storage-error-screen-retry'));
    await flush();
    expect(mockLoadErrorScreen).toHaveBeenCalledTimes(2);
    expect(nativeLoad).toHaveBeenCalledTimes(2);
    expect(loader.getSegmentState(SCREEN_SEGMENT_KEY)).toBe('ready');
    expect(screen.queryByTestId('business-app')).toBeNull();
    expect(screen.queryByTestId('native-storage-repair-back')).toBeNull();
    const partial = {
      repairId: 'attempt-1',
      successfulCount: 3,
      failedCount: 2,
      preservedCount: 1,
      recoveredCount: 2,
      scanComplete: false,
    };
    mockStorageCall.mockResolvedValueOnce(partial);
    fireEvent.click(
      screen.getByTestId('native-storage-migration-repair-attempt'),
    );
    await flush();
    expect(mockStorageCall).toHaveBeenLastCalledWith({
      scope: 'recovery',
      operation: 'prepareMigrationRepair',
      target: 'appStorage',
    });
    expect(screen.getByText(/Successful: 3. Failed: 2/)).toBeTruthy();
    expect(screen.getByText(/counts cover known items only/)).toBeTruthy();
    expect(mockRestart).not.toHaveBeenCalled();
    expect(mockBootstrap).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('native-storage-repair-back')).toBeNull();
    mockRestart.mockRejectedValueOnce(new Error('restart unavailable'));
    fireEvent.click(screen.getByTestId('native-storage-repair-restart'));
    await flush();
    expect(mockRestart).toHaveBeenCalledWith({
      mode: 'all',
      reason: 'storage.migration.incomplete',
    });
    expect(screen.queryByTestId('business-app')).toBeNull();
    expect(screen.queryByTestId('native-storage-repair-back')).toBeNull();
    expect(screen.getByTestId('native-storage-repair-restart')).toBeTruthy();
    expect(mockStorageCall).toHaveBeenCalledTimes(1);
    mockRestart.mockClear();
    fireEvent.click(screen.getByTestId('native-storage-repair-complete'));
    expect(screen.getByText(/Force completion\?/)).toBeTruthy();
    fireEvent.click(
      screen.getByTestId('native-storage-migration-repair-cancel'),
    );
    expect(mockStorageCall).toHaveBeenCalledTimes(1);
    expect(mockRestart).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('native-storage-repair-complete'));
    mockStorageCall.mockRejectedValueOnce(new Error('sync failed'));
    fireEvent.click(
      screen.getByTestId('native-storage-migration-repair-confirm'),
    );
    await flush();
    expect(mockStorageCall).toHaveBeenLastCalledWith({
      scope: 'recovery',
      operation: 'completeMigrationRepair',
      target: 'appStorage',
      repairId: 'attempt-1',
      force: true,
    });
    expect(screen.getByText(/Storage repair failed/)).toBeTruthy();
    expect(mockRestart).not.toHaveBeenCalled();
    expect(screen.getByText(/Successful: 3. Failed: 2/)).toBeTruthy();
    expect(screen.queryByTestId('native-storage-repair-back')).toBeNull();
    expect(screen.queryByTestId('business-app')).toBeNull();

    const complete = {
      ...partial,
      repairId: 'attempt-2',
      failedCount: 0,
      scanComplete: true,
    };
    mockStorageCall
      .mockResolvedValueOnce(complete)
      .mockRejectedValueOnce(new Error('automatic sync failed'));
    fireEvent.click(screen.getByTestId('native-storage-repair-retry'));
    await flush();
    expect(mockStorageCall).toHaveBeenLastCalledWith({
      scope: 'recovery',
      operation: 'completeMigrationRepair',
      target: 'appStorage',
      repairId: 'attempt-2',
      force: false,
    });
    expect(screen.getByText(/Storage repair failed/)).toBeTruthy();
    expect(screen.queryByTestId('native-storage-repair-close')).toBeNull();
    expect(screen.queryByTestId('native-storage-repair-complete')).toBeNull();
    expect(mockRestart).not.toHaveBeenCalled();

    mockStorageCall.mockResolvedValueOnce({
      ...complete,
      repairId: 'attempt-incomplete',
      scanComplete: false,
    });
    const callsBeforeIncomplete = mockStorageCall.mock.calls.length;
    fireEvent.click(screen.getByTestId('native-storage-repair-retry'));
    await flush();
    expect(mockStorageCall).toHaveBeenCalledTimes(callsBeforeIncomplete + 1);
    expect(screen.getByText('Force completion')).toBeTruthy();
    expect(screen.getByText(/counts cover known items only/)).toBeTruthy();
    expect(screen.queryByTestId('native-storage-repair-close')).toBeNull();

    let finishCompletion: ((value: unknown) => void) | undefined;
    mockStorageCall
      .mockResolvedValueOnce({ ...complete, repairId: 'attempt-3' })
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishCompletion = resolve;
          }),
      );
    mockBootstrap.mockResolvedValueOnce(undefined);
    mockHydrate.mockRejectedValueOnce(new Error('state hydration failed'));
    fireEvent.click(screen.getByTestId('native-storage-repair-retry'));
    await flush();
    expect(mockStorageCall).toHaveBeenLastCalledWith({
      scope: 'recovery',
      operation: 'completeMigrationRepair',
      target: 'appStorage',
      repairId: 'attempt-3',
      force: false,
    });
    expect(screen.getByTestId('native-storage-repair-progress')).toBeTruthy();
    expect(screen.queryByTestId('native-storage-repair-close')).toBeNull();
    expect(mockHydrate).not.toHaveBeenCalled();
    expect(mockRestart).not.toHaveBeenCalled();
    finishCompletion?.(undefined);
    await flush();
    expect(screen.getByText('Storage repair complete')).toBeTruthy();
    expect(screen.getByText(/app state could not be refreshed/)).toBeTruthy();
    expect(
      screen.getByText(/legacy storage has been kept unchanged/),
    ).toBeTruthy();
    expect(screen.getByText(/Successful: 3. Failed: 0/)).toBeTruthy();
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.getByTestId('native-storage-repair-close').textContent).toBe(
      'Close',
    );
    expect(screen.queryByTestId('native-storage-repair-complete')).toBeNull();
    expect(screen.queryByTestId('native-storage-repair-retry')).toBeNull();
    expect(screen.queryByTestId('native-storage-repair-back')).toBeNull();
    expect(mockHydrate).toHaveBeenCalledTimes(1);
    expect(mockRestart).not.toHaveBeenCalled();

    const callsAfterCompletion = mockStorageCall.mock.calls.length;
    mockRestart.mockRejectedValueOnce(new Error('restart failed'));
    fireEvent.click(screen.getByTestId('native-storage-repair-close'));
    await flush();
    expect(
      screen.getByText(/repair is complete, but the app could not restart/),
    ).toBeTruthy();
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.getByTestId('native-storage-repair-close')).toBeTruthy();
    expect(mockStorageCall).toHaveBeenCalledTimes(callsAfterCompletion);
    fireEvent.click(screen.getByTestId('native-storage-repair-close'));
    await flush();
    expect(mockRestart).toHaveBeenCalledTimes(2);
    expect(mockStorageCall).toHaveBeenCalledTimes(callsAfterCompletion);
    expect(mockHydrate.mock.invocationCallOrder[0]).toBeLessThan(
      mockRestart.mock.invocationCallOrder[0],
    );
    expect(screen.getByTestId('native-storage-repair-progress')).toBeTruthy();
    expect(screen.queryByTestId('business-app')).toBeNull();
  });
});

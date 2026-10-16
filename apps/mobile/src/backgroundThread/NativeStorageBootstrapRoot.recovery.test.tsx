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
    render(<NativeStorageBootstrapRoot />);
    await flush();
    expect(screen.getByTestId('business-app')).toBeTruthy();
    act(() => requestNativeStorageRecovery('appStorage'));
    expect(screen.queryByTestId('business-app')).toBeNull();
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

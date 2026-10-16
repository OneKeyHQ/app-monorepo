/** @jest-environment jsdom */

import { act, fireEvent, render, screen } from '@testing-library/react';

import { requestNativeStorageRecovery } from '@onekeyhq/shared/src/storage/nativeStorageRecovery';
import type {
  INativeStorageRecoveryTestRequest,
  INativeStorageRecoveryTestResult,
} from '@onekeyhq/shared/src/storage/nativeStorageRecoveryTestTypes';

const mockMismatch = new Error(
  'Native storage migration target is inconsistent:appStorage; App-storage MMKV migration marker is missing after migration completed',
);
const mockBootstrap = jest.fn<Promise<void>, []>(async () => {
  throw mockMismatch;
});
const mockStorageCall = jest.fn<Promise<unknown>, [unknown]>(
  async () => undefined,
);
const mockSnapshot = {
  faultActive: false,
  markerComplete: false,
  newDataPersisted: false,
  legacyRetained: true,
  rows: [],
};
const mockTestCall = jest.fn<
  Promise<INativeStorageRecoveryTestResult>,
  [INativeStorageRecoveryTestRequest]
>(async () => ({ snapshot: mockSnapshot }));
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
  default: {
    initializeJotaiFromBackground: () => mockHydrate(),
    serviceDevSetting: {
      nativeStorageRecoveryTest: (request: INativeStorageRecoveryTestRequest) =>
        mockTestCall(request),
    },
  },
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

describe('isolated recovery test screen', () => {
  afterAll(() => {
    jest.useRealTimers();
  });
  it('uses only the test service, releases a fault, verifies automatically and closes with a runtime restart', async () => {
    render(<NativeStorageBootstrapRoot />);
    await flush();
    act(() => requestNativeStorageRecovery('appStorage', 'isolated-session'));
    await flush();
    expect(screen.getByText(/Isolated storage recovery test/)).toBeTruthy();
    const summary = {
      repairId: 'test-repair-1',
      successfulCount: 3,
      failedCount: 0,
      preservedCount: 1,
      recoveredCount: 2,
      scanComplete: true,
    };
    mockTestCall
      .mockResolvedValueOnce({ snapshot: mockSnapshot, summary })
      .mockRejectedValueOnce(new Error('injected sync failure'));
    fireEvent.click(
      screen.getByTestId('native-storage-migration-repair-attempt'),
    );
    await flush();
    expect(screen.getByText(/Storage repair failed/)).toBeTruthy();
    expect(mockTestCall).toHaveBeenLastCalledWith({
      action: 'complete',
      sessionId: 'isolated-session',
      repairId: summary.repairId,
      force: false,
    });
    expect(mockStorageCall).not.toHaveBeenCalled();
    expect(mockHydrate).not.toHaveBeenCalled();
    expect(mockRestart).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByTestId('native-storage-recovery-test-release-fault'),
    );
    await flush();
    expect(mockTestCall).toHaveBeenLastCalledWith({
      action: 'releaseFault',
      sessionId: 'isolated-session',
    });
    expect(screen.getByText(/Simulated fault cleared/)).toBeTruthy();
    mockTestCall
      .mockResolvedValueOnce({
        snapshot: mockSnapshot,
        summary: { ...summary, repairId: 'test-repair-2' },
      })
      .mockResolvedValueOnce({ snapshot: mockSnapshot })
      .mockResolvedValueOnce({
        snapshot: {
          ...mockSnapshot,
          markerComplete: true,
          verification: {
            passed: true,
            successfulKeysReadable: true,
            failedKeysAbsent: true,
            newDataWritable: true,
            expectedSuccessfulCount: 3,
            expectedFailedCount: 0,
          },
        },
      });
    fireEvent.click(screen.getByTestId('native-storage-repair-retry'));
    await flush();
    expect(mockTestCall).toHaveBeenLastCalledWith({
      action: 'verify',
      sessionId: 'isolated-session',
    });
    expect(screen.getByText('Storage repair complete')).toBeTruthy();
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.getByTestId('native-storage-repair-close')).toBeTruthy();
    expect(mockStorageCall).not.toHaveBeenCalled();
    expect(mockHydrate).not.toHaveBeenCalled();
    expect(mockBootstrap).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTestId('native-storage-repair-close'));
    await flush();
    expect(mockRestart).toHaveBeenCalledWith({
      mode: 'all',
      reason: 'storage.migration.test.repaired',
    });
  });
});

/** @jest-environment jsdom */

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';

import type { IDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type {
  INativeStorageRecoveryTestRequest,
  INativeStorageRecoveryTestResult,
  INativeStorageRecoveryTestScenario,
} from '@onekeyhq/shared/src/storage/nativeStorageRecoveryTestTypes';

const mockReact = jest.requireActual<typeof import('react')>('react');
type IScalar = string | boolean | number;
const mockStores = new Map<string, Map<string, IScalar>>();
const mockLegacy = new Map<string, string>();
const mockDevListeners = new Set<() => void>();
let mockDevSettings: IDevSettingsPersistAtom;
let mockFocused = true;
let mockNative = true;
let mockRun: (
  request: INativeStorageRecoveryTestRequest,
) => Promise<INativeStorageRecoveryTestResult>;
let mockDismissRecovery = () => {};
const mockProductionAccess = jest.fn(() => {
  throw new OneKeyLocalError('Test flow accessed production storage');
});
const mockRpc = jest.fn(async (request: INativeStorageRecoveryTestRequest) => {
  try {
    return await mockRun(request);
  } catch (error) {
    const { toPlainErrorObject } = jest.requireActual<
      typeof import('@onekeyhq/shared/src/errors/utils/errorUtils')
    >('@onekeyhq/shared/src/errors/utils/errorUtils');
    throw toPlainErrorObject(error);
  }
});
function reloadBackground() {
  // Recreate the owner runtime while preserving only its native stores.
  jest.isolateModules(() => {
    mockRun =
      require('@onekeyhq/kit-bg/src/services/ServiceDevSetting/nativeStorageRecoveryTest').runNativeStorageRecoveryTest;
  });
}
const mockRestart = jest.fn(async (_options: unknown) => {
  reloadBackground();
  mockDismissRecovery();
});
type IToast = { title: string; actions?: import('react').ReactNode };
let mockToast: IToast | undefined;
const mockToastListeners = new Set<() => void>();
function updateToast(toast?: IToast) {
  mockToast = toast;
  mockToastListeners.forEach((listener) => listener());
}
const mockToastError = jest.fn((toast: IToast) => updateToast(toast));
function TestToastHost() {
  const toast = mockReact.useSyncExternalStore(
    (listener) => {
      mockToastListeners.add(listener);
      return () => {
        mockToastListeners.delete(listener);
      };
    },
    () => mockToast,
  );
  return toast ? (
    <div>
      {toast.title}
      {toast.actions}
    </div>
  ) : null;
}
type IElementProps = {
  children?: import('react').ReactNode;
  testID?: string;
  onPress?: () => void;
  disabled?: boolean;
};
function TestView({ children, testID }: IElementProps) {
  return <div data-testid={testID}>{children}</div>;
}
function TestButton({ children, testID, onPress, disabled }: IElementProps) {
  return (
    <button
      type="button"
      data-testid={testID}
      onClick={onPress}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

jest.mock('react-native', () => ({
  ScrollView: TestView,
  View: TestView,
  Text: TestView,
  Pressable: TestButton,
  ActivityIndicator: TestView,
  StyleSheet: { create: (styles: unknown) => styles },
  useColorScheme: () => 'light',
}));
jest.mock('@onekeyhq/components', () => ({
  Button: TestButton,
  ScrollView: TestView,
  SizableText: TestView,
  XStack: TestView,
  YStack: TestView,
  Toast: {
    error: mockToastError,
    dismiss: () => updateToast(),
    message: jest.fn(),
    success: jest.fn(),
    warning: jest.fn(),
  },
  globalNetInfo: { currentState: () => ({ isInternetReachable: true }) },
}));
jest.mock('react-intl', () => ({
  ...jest.requireActual<typeof import('react-intl')>('react-intl'),
  useIntl: () => ({ formatMessage: () => 'Retry' }),
}));
jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocusedWhenEnabled: ({ enabled }: { enabled: boolean }) =>
    enabled && mockFocused,
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings', () => ({
  devSettingsPersistAtom: {
    get: async () => mockDevSettings,
    set: async (
      update: (previous: IDevSettingsPersistAtom) => IDevSettingsPersistAtom,
    ) => {
      mockDevSettings = update(mockDevSettings);
      mockDevListeners.forEach((listener) => listener());
    },
  },
  useDevSettingsPersistAtom: () => [
    mockReact.useSyncExternalStore(
      (listener) => {
        mockDevListeners.add(listener);
        return () => {
          mockDevListeners.delete(listener);
        };
      },
      () => mockDevSettings,
    ),
  ],
}));
jest.mock('react-native-mmkv', () => ({
  createMMKV: ({ id }: { id: string }) => {
    if (
      ![
        'onekey-dev-storage-recovery-target-v1',
        'onekey-dev-storage-recovery-control-v1',
      ].includes(id)
    )
      return mockProductionAccess();
    const values = mockStores.get(id) ?? new Map<string, IScalar>();
    mockStores.set(id, values);
    return {
      getString: (key: string) =>
        typeof values.get(key) === 'string' ? values.get(key) : undefined,
      getNumber: (key: string) =>
        typeof values.get(key) === 'number' ? values.get(key) : undefined,
      getBoolean: (key: string) =>
        typeof values.get(key) === 'boolean' ? values.get(key) : undefined,
      set: (key: string, value: IScalar) => values.set(key, value),
      remove: (key: string) => values.delete(key),
      clearAll: () => values.clear(),
      getAllKeys: () => [...values.keys()],
      trim: () => {},
    };
  },
}));
jest.mock('@onekeyhq/shared/src/storage/legacyAsyncStorageMigration', () => ({
  getLegacyAsyncStorageForMigration: () => {
    const assertKeys = (keys: string[]) => {
      if (
        keys.some((key) => !key.startsWith('$$test_native_storage_recovery/'))
      )
        mockProductionAccess();
    };
    return {
      multiGet: async (keys: string[]) => {
        assertKeys(keys);
        return keys.map((key) => [key, mockLegacy.get(key) ?? null]);
      },
      multiSet: async (entries: Array<[string, string]>) => {
        assertKeys(entries.map(([key]) => key));
        entries.forEach(([key, value]) => mockLegacy.set(key, value));
      },
      multiRemove: async (keys: string[]) => {
        assertKeys(keys);
        keys.forEach((key) => mockLegacy.delete(key));
      },
    };
  },
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  ...jest.requireActual<typeof import('@onekeyhq/shared/src/platformEnv')>(
    '@onekeyhq/shared/src/platformEnv',
  ),
  __esModule: true,
  default: {
    get isNative() {
      return mockNative;
    },
    isNativeBackgroundThread: true,
  },
}));
jest.mock('@onekeyhq/shared/src/storage/nativeStorageMigrationModule', () => ({
  NATIVE_STORAGE_MIGRATION_LEDGER_COMPLETE: 'complete-v1',
  getNativeStorageMigrationLedger: mockProductionAccess,
  setNativeStorageMigrationLedgerComplete: mockProductionAccess,
  syncNativeStorageMMKV: mockProductionAccess,
}));
jest.mock('@onekeyhq/shared/src/storage/nativeStorageBridge', () => ({
  callNativeStorage: mockProductionAccess,
}));
jest.mock('@onekeyhq/shared/src/utils/timerUtils', () => ({
  __esModule: true,
  default: { wait: async () => undefined },
}));
jest.mock(
  '@onekeyhq/shared/src/modules3rdParty/react-native-file-logger',
  () => ({ LogLevel: { Info: 'info' }, NativeLogger: { write: jest.fn() } }),
);
jest.mock('@onekeyhq/shared/src/travelMode', () => ({ travelModeManager: {} }));
jest.mock(
  '@onekeyhq/shared/src/travelMode/runtimeLaunchAcknowledgement',
  () => ({ completeTravelModeRuntimeLaunchAcknowledgement: async () => true }),
);
jest.mock('@onekeyhq/shared/src/modules3rdParty/appRestart', () => ({
  appRestart: (options: unknown) => mockRestart(options),
  EAppRestartMode: { All: 'all' },
}));
jest.mock(
  '@onekeyhq/shared/src/storage/nativeStorageContractViolationSubscription',
  () => ({ subscribeNativeStorageContractViolations: () => () => {} }),
);
jest.mock(
  '@onekeyhq/kit/src/provider/Container/ErrorToastContainer/ErrorToasts',
  () => ({ getErrorAction: () => undefined }),
);
jest.mock('@onekeyhq/kit/src/utils/swrCacheMutationInvalidation', () => ({
  registerSwrCacheMutationInvalidation: jest.fn(),
}));
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
    initializeJotaiFromBackground: async () => undefined,
    serviceDevSetting: {
      nativeStorageRecoveryTest: (request: INativeStorageRecoveryTestRequest) =>
        mockRpc(request),
    },
  },
}));
jest.mock('./jotaiMainHydrationGate', () => ({
  runJotaiMainHydration: (initialize: () => Promise<void>) => initialize(),
}));
jest.mock('./bootstrapNativeStorage', () => ({
  bootstrapNativeStorage: async () => undefined,
  hydrateColdStartSnapshotAfterRuntimeLaunch: jest.fn(),
  waitForColdStartCriticalImagesBeforeMount: async () => undefined,
}));
jest.mock('./nativeStorageBootstrapSplash', () => ({
  hideNativeStorageBootstrapSplash: jest.fn(),
}));
jest.mock('../../App', () => ({
  __esModule: true,
  default: function TestHome() {
    const { NativeStorageRecoveryTestOnHome } =
      require('@onekeyhq/kit/src/views/Home/components/NativeStorageRecoveryTestOnHome') as typeof import('@onekeyhq/kit/src/views/Home/components/NativeStorageRecoveryTestOnHome');
    const { ErrorToastContainer } =
      require('@onekeyhq/kit/src/provider/Container/ErrorToastContainer/ErrorToastContainer') as typeof import('@onekeyhq/kit/src/provider/Container/ErrorToastContainer/ErrorToastContainer');
    return (
      <>
        <div data-testid="home-page">Home</div>
        <ErrorToastContainer />
        <NativeStorageRecoveryTestOnHome />
        <TestToastHost />
      </>
    );
  },
}));

describe('manual fault → restarted Home Toast → repair → healthy Home', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.doMock('react', () => mockReact);
    jest.clearAllMocks();
    mockStores.clear();
    mockLegacy.clear();
    mockLegacy.set('business-sentinel', 'untouched');
    mockDevSettings = {
      enabled: true,
      settings: { enableTestEndpoint: false },
    };
    mockFocused = true;
    mockNative = true;
    mockToast = undefined;
    mockDismissRecovery = () => {};
    reloadBackground();
  });

  it.each<INativeStorageRecoveryTestScenario>([
    'success',
    'partialFailure',
    'allFailed',
    'incompleteScan',
    'syncFailure',
    'expiredAttempt',
  ])(
    '%s completes through the actual panel, Home probe, Toast action and repair screen',
    async (scenario) => {
      const { NativeStorageRecoveryTestPanel } =
        require('@onekeyhq/kit/src/views/Setting/pages/Tab/DevSettingsSection/NativeStorageRecoveryTestPanel') as typeof import('@onekeyhq/kit/src/views/Setting/pages/Tab/DevSettingsSection/NativeStorageRecoveryTestPanel');
      const panel = render(<NativeStorageRecoveryTestPanel />);
      await waitFor(() =>
        expect(
          screen
            .getByTestId(`storage-recovery-scenario-${scenario}`)
            .hasAttribute('disabled'),
        ).toBe(false),
      );
      fireEvent.click(
        screen.getByTestId(`storage-recovery-scenario-${scenario}`),
      );
      await waitFor(() => expect(mockRestart).toHaveBeenCalledTimes(1));
      expect(mockRestart).toHaveBeenLastCalledWith({
        mode: 'all',
        reason: 'storage.migration.test.reproduce',
      });
      panel.unmount();
      const { NativeStorageBootstrapRoot } =
        require('./NativeStorageBootstrapRoot') as typeof import('./NativeStorageBootstrapRoot');
      render(<NativeStorageBootstrapRoot />);
      await screen.findByTestId('home-page');
      fireEvent.click(
        await screen.findByTestId('native-storage-repair-toast-action'),
      );
      await screen.findByText(/Isolated storage recovery test/);
      expect(screen.queryByTestId('home-page')).toBeNull();
      fireEvent.click(
        screen.getByTestId('native-storage-migration-repair-attempt'),
      );
      if (scenario === 'syncFailure' || scenario === 'expiredAttempt') {
        await screen.findByText(/Storage repair failed/);
        if (scenario === 'syncFailure') {
          fireEvent.click(
            screen.getByTestId('native-storage-recovery-test-release-fault'),
          );
          await screen.findByText(/Simulated fault cleared/);
        }
        fireEvent.click(screen.getByTestId('native-storage-repair-retry'));
      }
      if (
        scenario === 'partialFailure' ||
        scenario === 'allFailed' ||
        scenario === 'incompleteScan'
      ) {
        fireEvent.click(
          await screen.findByTestId('native-storage-repair-complete'),
        );
        fireEvent.click(
          await screen.findByTestId('native-storage-migration-repair-confirm'),
        );
      }
      await screen.findByText('Storage repair complete');
      expect(screen.queryByTestId('home-page')).toBeNull();
      expect(mockRestart).toHaveBeenCalledTimes(1);
      expect(mockDevSettings.settings?.nativeStorageRecoveryTestOnHome).toBe(
        true,
      );
      expect(
        (await mockRun({ action: 'inspect' })).snapshot.homeReadPassed,
      ).toBe(false);
      const { dismissNativeStorageRecovery } =
        require('@onekeyhq/shared/src/storage/nativeStorageRecovery') as typeof import('@onekeyhq/shared/src/storage/nativeStorageRecovery');
      mockDismissRecovery = dismissNativeStorageRecovery;
      fireEvent.click(screen.getByTestId('native-storage-repair-close'));
      await screen.findByTestId('home-page');
      await waitFor(() =>
        expect(mockDevSettings.settings?.nativeStorageRecoveryTestOnHome).toBe(
          false,
        ),
      );
      expect(mockRestart).toHaveBeenLastCalledWith({
        mode: 'all',
        reason: 'storage.migration.test.repaired',
      });
      expect(mockToastError).toHaveBeenCalledTimes(1);
      const result = await mockRun({ action: 'inspect' });
      expect(result.snapshot).toMatchObject({
        homeReadPassed: true,
        homeFlowActive: false,
        legacyRetained: true,
      });
      const verified = await mockRun({
        action: 'verify',
        sessionId: result.snapshot.sessionId ?? '',
      });
      expect(verified.snapshot.verification).toMatchObject({
        passed: true,
        newDataWritable: true,
      });
      expect(mockLegacy.get('business-sentinel')).toBe('untouched');
      expect(mockDevSettings.settings?.enableTestEndpoint).toBe(false);
      expect(mockProductionAccess).not.toHaveBeenCalled();
      render(<NativeStorageRecoveryTestPanel />);
      await waitFor(() =>
        expect(
          screen.getByTestId('storage-recovery-test-home-result').textContent,
        ).toContain('PASS'),
      );
    },
  );

  it.each([
    'ordinary user',
    'no pending test',
    'unfocused or locked',
    'non-native',
  ])('%s does not call the test service from Home', async (condition) => {
    mockDevSettings = {
      enabled: condition !== 'ordinary user',
      settings: {
        nativeStorageRecoveryTestOnHome: condition !== 'no pending test',
      },
    };
    mockFocused = condition !== 'unfocused or locked';
    mockNative = condition !== 'non-native';
    const { NativeStorageRecoveryTestOnHome } =
      require('@onekeyhq/kit/src/views/Home/components/NativeStorageRecoveryTestOnHome') as typeof import('@onekeyhq/kit/src/views/Home/components/NativeStorageRecoveryTestOnHome');
    render(<NativeStorageRecoveryTestOnHome />);
    await act(async () => {
      for (let index = 0; index < 20; index += 1) await Promise.resolve();
    });
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('discards a pending Home error after losing focus or locking', async () => {
    mockDevSettings = {
      enabled: true,
      settings: { nativeStorageRecoveryTestOnHome: true },
    };
    let rejectRead: (error: unknown) => void = () => {};
    mockRpc.mockImplementationOnce(
      () =>
        new Promise<INativeStorageRecoveryTestResult>((_resolve, reject) => {
          rejectRead = reject;
        }),
    );
    const { NativeStorageRecoveryTestOnHome } =
      require('@onekeyhq/kit/src/views/Home/components/NativeStorageRecoveryTestOnHome') as typeof import('@onekeyhq/kit/src/views/Home/components/NativeStorageRecoveryTestOnHome');
    const { ErrorToastContainer } =
      require('@onekeyhq/kit/src/provider/Container/ErrorToastContainer/ErrorToastContainer') as typeof import('@onekeyhq/kit/src/provider/Container/ErrorToastContainer/ErrorToastContainer');
    const view = render(
      <>
        <ErrorToastContainer />
        <NativeStorageRecoveryTestOnHome />
      </>,
    );
    await waitFor(() =>
      expect(mockRpc).toHaveBeenCalledWith({ action: 'homeRead' }),
    );
    mockFocused = false;
    view.rerender(
      <>
        <ErrorToastContainer />
        <NativeStorageRecoveryTestOnHome />
      </>,
    );
    await act(async () => {
      rejectRead({
        message:
          'Native storage migration target is inconsistent:appStorage; migration marker is missing',
        data: {
          nativeStorageRecoveryTestSessionId: 'storage-repair-test-cancelled',
        },
      });
    });
    expect(mockToastError).not.toHaveBeenCalled();
  });
});

/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { act, fireEvent, render, screen } from '@testing-library/react';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  dismissNativeStorageRecovery,
  requestNativeStorageRecovery,
} from '@onekeyhq/shared/src/storage/nativeStorageRecovery';
import {
  type INativeStorageRequest,
  createNativeStorageMigrationInconsistentErrorMessage,
} from '@onekeyhq/shared/src/storage/nativeStorageTypes';

const diagnostic =
  createNativeStorageMigrationInconsistentErrorMessage('appStorage');
let mockMissingMarker = true;
const mockCanonicalState = jest.fn(async () => {
  if (mockMissingMarker) throw new OneKeyLocalError(diagnostic);
});
const mockStorageCall = jest.fn(
  async (request: INativeStorageRequest): Promise<unknown> => {
    if (request.scope !== 'recovery')
      throw new OneKeyLocalError('Unexpected business storage call');
    switch (request.operation) {
      case 'inspectAppStorageMigration':
        return { errorMessage: mockMissingMarker ? diagnostic : null };
      case 'prepareMigrationRepair':
        return {
          repairId: 'public-repair',
          successfulCount: 1,
          failedCount: 0,
          preservedCount: 1,
          recoveredCount: 0,
          scanComplete: true,
        };
      case 'completeMigrationRepair':
        mockMissingMarker = false;
        return undefined;
      default:
        throw new OneKeyLocalError('Unexpected storage mutation');
    }
  },
);
const mockRestart = jest.fn(async () => {
  dismissNativeStorageRecovery();
});
const mockDevService = jest.fn(() => {
  throw new OneKeyLocalError('Public repair used a developer service');
});

type IViewProps = {
  children?: ReactNode;
  testID?: string;
  onPress?: () => void;
  accessibilityElementsHidden?: boolean;
  pointerEvents?: string;
};
function TestView({
  children,
  testID,
  accessibilityElementsHidden,
  pointerEvents,
}: IViewProps) {
  return (
    <div
      data-testid={testID}
      aria-hidden={accessibilityElementsHidden}
      data-pointer-events={pointerEvents}
    >
      {children}
    </div>
  );
}
function TestButton({ children, testID, onPress }: IViewProps) {
  return (
    <button type="button" data-testid={testID} onClick={onPress}>
      {children}
    </button>
  );
}

jest.mock('react-native', () => ({
  Modal: ({
    children,
    onRequestClose,
    presentationStyle,
    allowSwipeDismissal,
  }: IViewProps & {
    onRequestClose: () => void;
    presentationStyle: string;
    allowSwipeDismissal: boolean;
  }) => (
    <div
      data-testid="repair-native-modal"
      data-presentation={presentationStyle}
      data-swipe-dismissal={String(allowSwipeDismissal)}
    >
      <button type="button" data-testid="system-back" onClick={onRequestClose}>
        Android system back gesture/button
      </button>
      {children}
    </div>
  ),
  View: TestView,
  Text: TestView,
  ScrollView: TestView,
  ActivityIndicator: TestView,
  Pressable: TestButton,
  StyleSheet: { create: (styles: unknown) => styles },
  useColorScheme: () => 'light',
  AppState: {
    currentState: 'active',
    addEventListener: () => ({ remove: () => {} }),
  },
}));
jest.mock('@onekeyhq/components', () => ({
  Button: TestButton,
  Stack: TestView,
  YStack: TestView,
  XStack: TestView,
  SizableText: TestView,
  ScrollView: TestView,
  Icon: () => null,
  Keyboard: { dismiss: jest.fn() },
  useSafeAreaInsets: () => ({ top: 24 }),
}));
jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: () => 'Retry' }),
}));
jest.mock('@onekeyhq/kit/src/utils/swrCacheMutationInvalidation', () => ({
  registerSwrCacheMutationInvalidation: jest.fn(),
}));
jest.mock('@onekeyhq/shared/src/modules3rdParty/appRestart', () => ({
  appRestart: () => mockRestart(),
  EAppRestartMode: { All: 'all' },
}));
jest.mock('@onekeyhq/shared/src/storage/nativeStorageBridge', () => ({
  callNativeStorage: (request: INativeStorageRequest) =>
    mockStorageCall(request),
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
    initializeJotaiFromBackground: () => mockCanonicalState(),
    serviceDevSetting: { nativeStorageRecoveryTest: mockDevService },
  },
}));
jest.mock('./jotaiMainHydrationGate', () => ({
  runJotaiMainHydration: (initialize: () => Promise<void>) => initialize(),
}));
jest.mock('./bootstrapNativeStorage', () => ({
  bootstrapNativeStorage: () => mockCanonicalState(),
  hydrateColdStartSnapshotAfterRuntimeLaunch: jest.fn(),
  waitForColdStartCriticalImagesBeforeMount: async () => undefined,
}));
jest.mock('./nativeStorageBootstrapSplash', () => ({
  hideNativeStorageBootstrapSplash: jest.fn(),
}));
jest.mock('../../App', () => ({
  __esModule: true,
  default: function LockedApp() {
    const {
      NativeStorageLockError,
      NativeStorageLockToast,
      useNativeStorageLockError,
    } = jest.requireActual<
      typeof import('@onekeyhq/kit/src/provider/Container/AppStateLockContainer/components/NativeStorageLockRecovery.native')
    >(
      '@onekeyhq/kit/src/provider/Container/AppStateLockContainer/components/NativeStorageLockRecovery.native',
    );
    const message = useNativeStorageLockError();
    // Deliberately no NavigationContainer, Toaster, ErrorToastContainer or atom
    // providers: those can be absent or unreconciled during a cold-start lock.
    return (
      <div data-testid="locked-app">
        <input data-testid="retained-input" />
        <NativeStorageLockError message={message} />
        <NativeStorageLockToast message={message} />
      </div>
    );
  },
}));

jest.useFakeTimers();
const { NativeStorageBootstrapRoot } =
  require('./NativeStorageBootstrapRoot') as typeof import('./NativeStorageBootstrapRoot');
async function flush() {
  await act(async () => {
    for (let index = 0; index < 30; index += 1) await Promise.resolve();
  });
}

describe('locked app to public storage repair', () => {
  afterAll(() => {
    jest.useRealTimers();
  });
  it('replaces the locked app and repairs without canonical state or developer mode', async () => {
    render(<NativeStorageBootstrapRoot />);
    await flush();
    expect(screen.getByTestId('lock-storage-error').textContent).toContain(
      diagnostic,
    );
    const input = screen.getByTestId('retained-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'unsaved test input' } });
    const beforeEntryCalls = mockCanonicalState.mock.calls.length;
    for (const entry of [
      'inline',
      'toast',
      'home',
      'developer-test',
      'jotai',
    ] as const) {
      if (entry === 'inline' || entry === 'toast') {
        fireEvent.click(
          screen.getByTestId(
            entry === 'inline'
              ? 'lock-storage-repair'
              : 'native-storage-repair-toast-action',
          ),
        );
      } else {
        act(() =>
          requestNativeStorageRecovery(
            entry === 'jotai' ? 'jotai' : 'appStorage',
            entry === 'developer-test' ? 'isolated-back-test' : undefined,
          ),
        );
      }
      await flush();
      expect(
        screen
          .getByTestId('native-storage-retained-app')
          .getAttribute('aria-hidden'),
      ).toBe('true');
      expect(
        screen
          .getByTestId('native-storage-retained-app')
          .getAttribute('data-pointer-events'),
      ).toBe('none');
      expect(
        screen
          .getByTestId('repair-native-modal')
          .getAttribute('data-swipe-dismissal'),
      ).toBe('false');
      expect(
        screen
          .getByTestId('repair-native-modal')
          .getAttribute('data-presentation'),
      ).toBe('fullScreen');
      fireEvent.click(
        screen.getByTestId(
          entry === 'inline' ? 'native-storage-repair-back' : 'system-back',
        ),
      );
      await flush();
      expect(screen.queryByTestId('repair-native-modal')).toBeNull();
      expect(screen.getByTestId('retained-input')).toBe(input);
      expect(input.value).toBe('unsaved test input');
      expect(
        screen
          .getByTestId('native-storage-retained-app')
          .getAttribute('aria-hidden'),
      ).toBe('false');
      expect(mockCanonicalState).toHaveBeenCalledTimes(beforeEntryCalls);
      expect(mockRestart).not.toHaveBeenCalled();
      expect(
        mockStorageCall.mock.calls.every(
          ([request]) =>
            request.scope === 'recovery' &&
            request.operation === 'inspectAppStorageMigration',
        ),
      ).toBe(true);
    }
    for (const result of ['failed', 'incomplete'] as const) {
      fireEvent.click(screen.getByTestId('lock-storage-repair'));
      await flush();
      if (result === 'failed') {
        mockStorageCall.mockRejectedValueOnce(
          new OneKeyLocalError('prepare failed'),
        );
      } else {
        mockStorageCall.mockResolvedValueOnce({
          repairId: 'incomplete-return',
          successfulCount: 0,
          failedCount: 1,
          preservedCount: 0,
          recoveredCount: 0,
          scanComplete: false,
        });
      }
      fireEvent.click(
        screen.queryByTestId('native-storage-migration-repair-attempt') ??
          screen.getByTestId('native-storage-repair-retry'),
      );
      await flush();
      const callsBeforeBack = mockCanonicalState.mock.calls.length;
      const storageCallsBeforeBack = mockStorageCall.mock.calls.length;
      // The normal mirror and canonical read can recover independently of the
      // unsuccessful repair. Back must resume both under the new generation.
      if (result === 'incomplete') {
        mockCanonicalState
          .mockResolvedValueOnce(undefined)
          .mockResolvedValueOnce(undefined);
      }
      fireEvent.click(screen.getByTestId('native-storage-repair-back'));
      await flush();
      expect(mockCanonicalState).toHaveBeenCalledTimes(
        callsBeforeBack + (result === 'failed' ? 1 : 2),
      );
      expect(
        mockStorageCall.mock.calls
          .slice(storageCallsBeforeBack)
          .every(
            ([request]) =>
              request.scope === 'recovery' &&
              request.operation === 'inspectAppStorageMigration',
          ),
      ).toBe(true);
      expect(screen.getByTestId('retained-input')).toBe(input);
      expect(input.value).toBe('unsaved test input');
      expect(mockRestart).not.toHaveBeenCalled();
      if (result === 'incomplete') {
        const settledCalls = mockCanonicalState.mock.calls.length;
        await act(async () => {
          jest.advanceTimersByTime(20_000);
        });
        await flush();
        expect(mockCanonicalState).toHaveBeenCalledTimes(settledCalls);
      }
    }
    fireEvent.click(screen.getByTestId('lock-storage-repair'));
    await flush();
    expect(
      screen
        .getByTestId('native-storage-retained-app')
        .getAttribute('aria-hidden'),
    ).toBe('true');
    expect(
      screen.queryByTestId('native-storage-migration-repair-attempt') ??
        screen.getByTestId('native-storage-repair-retry'),
    ).toBeTruthy();
    expect(screen.getByTestId('native-storage-repair-back')).toBeTruthy();
    let finishPrepare: (value: unknown) => void = () => {};
    mockStorageCall.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishPrepare = resolve;
        }),
    );
    const staleBack = screen.getByTestId('native-storage-repair-back');
    const systemBack = screen.getByTestId('system-back');
    act(() => {
      fireEvent.click(
        screen.queryByTestId('native-storage-migration-repair-attempt') ??
          screen.getByTestId('native-storage-repair-retry'),
      );
      // Same-frame Back callbacks still carry pre-repair props. The root must
      // check its synchronous operation state before detaching this request.
      fireEvent.click(staleBack);
      fireEvent.click(systemBack);
    });
    await flush();
    expect(screen.getByTestId('native-storage-repair-progress')).toBeTruthy();
    expect(screen.getByTestId('repair-native-modal')).toBeTruthy();
    expect(mockRestart).not.toHaveBeenCalled();
    await act(async () => {
      finishPrepare({
        repairId: 'public-repair',
        successfulCount: 1,
        failedCount: 0,
        preservedCount: 1,
        recoveredCount: 0,
        scanComplete: true,
      });
    });
    await flush();
    expect(screen.getByText('Storage repair complete')).toBeTruthy();
    expect(mockStorageCall).toHaveBeenCalledWith({
      scope: 'recovery',
      operation: 'completeMigrationRepair',
      target: 'appStorage',
      repairId: 'public-repair',
      force: false,
    });
    expect(mockDevService).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('native-storage-repair-close'));
    await flush();
    expect(mockRestart).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('locked-app')).toBeTruthy();
    expect(screen.queryByTestId('lock-storage-error')).toBeNull();
    expect(screen.queryByTestId('lock-storage-toast')).toBeNull();
  });
});

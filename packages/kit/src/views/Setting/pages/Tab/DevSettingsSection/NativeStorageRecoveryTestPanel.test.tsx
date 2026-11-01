/** @jest-environment jsdom */
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { NATIVE_STORAGE_REAL_MARKER_TEST_CONFIRMATION } from '@onekeyhq/shared/src/storage/nativeStorageRecoveryTestTypes';

import { NativeStorageRecoveryTestPanel } from './NativeStorageRecoveryTestPanel';

let mockEnabled = true;
const mockInspect = jest.fn(async (_request?: unknown) => ({ snapshot: {} }));
const mockSimulate = jest.fn<Promise<{ restartRequired: true }>, unknown[]>();
const mockRestart = jest.fn<Promise<void>, unknown[]>();
const mockDialog = jest.fn<unknown, unknown[]>();
const mockOpenRepair = jest.fn();

jest.mock('@onekeyhq/shared/src/storage/nativeStorageRecovery', () => ({
  requestNativeStorageRecovery: (...args: unknown[]) => {
    mockOpenRepair(...args);
  },
}));

jest.mock('@onekeyhq/components', () => ({
  Button: ({
    children,
    onPress,
    disabled,
    testID,
  }: {
    children: import('react').ReactNode;
    onPress: () => void;
    disabled?: boolean;
    testID?: string;
  }) => (
    <button
      type="button"
      onClick={onPress}
      disabled={disabled}
      data-testid={testID}
    >
      {children}
    </button>
  ),
  Input: ({
    value,
    onChangeText,
    testID,
    disabled,
  }: {
    value: string;
    onChangeText: (value: string) => void;
    testID: string;
    disabled: boolean;
  }) => (
    <input
      data-testid={testID}
      value={value}
      disabled={disabled}
      onChange={(event) => onChangeText(event.target.value)}
    />
  ),
  ScrollView: ({ children }: { children: import('react').ReactNode }) => (
    <div>{children}</div>
  ),
  SizableText: ({ children }: { children: import('react').ReactNode }) => (
    <span>{children}</span>
  ),
  XStack: ({ children }: { children: import('react').ReactNode }) => (
    <div>{children}</div>
  ),
  YStack: ({ children }: { children: import('react').ReactNode }) => (
    <div>{children}</div>
  ),
  Dialog: { show: (...args: unknown[]) => mockDialog(...args) },
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings', () => ({
  useDevSettingsPersistAtom: () => [{ enabled: mockEnabled }],
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceDevSetting: {
      nativeStorageRecoveryTest: (...args: unknown[]) => mockInspect(...args),
      simulateRealAppStorageMissingMarker: (...args: unknown[]) =>
        mockSimulate(...args),
    },
  },
}));
jest.mock('@onekeyhq/shared/src/modules3rdParty/appRestart', () => ({
  EAppRestartMode: { All: 'all' },
  appRestart: (...args: unknown[]) => mockRestart(...args),
}));

function openConfirmation() {
  const button = screen.getByTestId('real-storage-marker-remove');
  expect((button as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(screen.getByTestId('real-storage-marker-confirmation'), {
    target: { value: NATIVE_STORAGE_REAL_MARKER_TEST_CONFIRMATION },
  });
  fireEvent.click(button);
  return mockDialog.mock.calls[0][0] as {
    onConfirm: () => Promise<void>;
    onClose: () => void;
  };
}

describe('real marker developer test UI', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEnabled = true;
    mockSimulate.mockResolvedValue({ restartRequired: true });
    mockRestart.mockResolvedValue(undefined);
  });
  it('exposes no simulation entry and makes no test request in ordinary mode', () => {
    mockEnabled = false;
    render(<NativeStorageRecoveryTestPanel />);
    expect(screen.queryByTestId('real-storage-marker-remove')).toBeNull();
    expect(mockInspect).not.toHaveBeenCalled();
    expect(mockSimulate).not.toHaveBeenCalled();
  });
  it('requires the exact typed acknowledgement and a second confirmation; cancellation changes nothing', async () => {
    render(<NativeStorageRecoveryTestPanel />);
    await waitFor(() => expect(mockInspect).toHaveBeenCalled());
    const dialog = openConfirmation();
    dialog.onClose();
    expect(mockSimulate).not.toHaveBeenCalled();
    expect(mockRestart).not.toHaveBeenCalled();
  });
  it('deduplicates confirmation and restarts both runtimes after the backend mutation', async () => {
    let finish!: () => void;
    mockSimulate.mockImplementationOnce(
      () =>
        new Promise<{ restartRequired: true }>((resolve) => {
          finish = () => resolve({ restartRequired: true });
        }),
    );
    render(<NativeStorageRecoveryTestPanel />);
    await waitFor(() => expect(mockInspect).toHaveBeenCalled());
    const dialog = openConfirmation();
    await act(async () => {
      const request = dialog.onConfirm();
      await dialog.onConfirm();
      expect(mockSimulate).toHaveBeenCalledTimes(1);
      expect(mockRestart).not.toHaveBeenCalled();
      finish();
      await request;
    });
    expect(mockSimulate).toHaveBeenCalledWith(
      NATIVE_STORAGE_REAL_MARKER_TEST_CONFIRMATION,
    );
    expect(mockRestart).toHaveBeenCalledWith({
      mode: 'all',
      reason: 'storage.migration.test.realMissingMarker',
    });
  });
  it('shows the fault recovery instructions if restart fails and does not repeat the mutation', async () => {
    mockRestart.mockRejectedValueOnce(
      new OneKeyLocalError('restart unavailable'),
    );
    render(<NativeStorageRecoveryTestPanel />);
    await waitFor(() => expect(mockInspect).toHaveBeenCalled());
    const dialog = openConfirmation();
    await act(async () => dialog.onConfirm());
    expect(
      screen.getByText(/real marker is missing but restart failed/),
    ).not.toBeNull();
    expect(mockSimulate).toHaveBeenCalledTimes(1);
    expect(
      (screen.getByTestId('real-storage-marker-remove') as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });
  it('does not run a stale confirmation after leaving the panel', async () => {
    const view = render(<NativeStorageRecoveryTestPanel />);
    await waitFor(() => expect(mockInspect).toHaveBeenCalled());
    const dialog = openConfirmation();
    view.unmount();
    await dialog.onConfirm();
    expect(mockSimulate).not.toHaveBeenCalled();
  });
  it('opens the existing public repair without storage reads or a test session', async () => {
    render(<NativeStorageRecoveryTestPanel />);
    await waitFor(() => expect(mockInspect).toHaveBeenCalled());
    mockInspect.mockClear();
    fireEvent.click(screen.getByTestId('real-storage-marker-open-repair'));
    expect(mockOpenRepair).toHaveBeenCalledWith('appStorage');
    expect(mockInspect).not.toHaveBeenCalled();
    expect(mockSimulate).not.toHaveBeenCalled();
  });
});

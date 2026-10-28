/** @jest-environment jsdom */
import type { ReactNode } from 'react';

import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
} from '@testing-library/react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import {
  chooseCloudSyncKey,
  useHardwareCloudSyncKey,
} from './HardwareCloudSyncKeySection';

const mockToggle = jest.fn<
  Promise<{ requiresHardware: boolean } | undefined>,
  [unknown]
>();
const mockEnable = jest.fn(async (_params: unknown) => undefined);
type IDialogParams = {
  title?: string;
  renderContent?: ReactNode;
  onConfirm?: () => Promise<void> | void;
  onClose?: () => Promise<void> | void;
};
const mockDialogClose = jest.fn(async () => undefined);
const mockDialogShow = jest.fn((_params: IDialogParams) => ({
  close: mockDialogClose,
}));
const mockClearForceTransport = jest.fn(async () => undefined);
const mockOpenExpandTab = jest.fn(async (_params: unknown) => undefined);
const mockCancel = jest.fn(async () => true);
const mockSyncNow = jest.fn(async (_params: unknown) => true);
const mockToast = jest.fn((_params: unknown) => undefined);
const credentialId = `hardware-cloud-v1-0123456789abcdef${'0'.repeat(48)}`;
type IMockConfig = {
  isCloudSyncEnabled: boolean;
  isCloudSyncEnabledKeyless: boolean;
  hardwareCloudSyncKeySource?: {
    credentialId: string;
    deviceName: string;
    deviceType: string;
  };
};
let mockConfig: IMockConfig;
let mockKeyMissing = false;
const mockIntl = {
  formatMessage: ({ id }: { id: string }) => id,
} as unknown as Parameters<typeof chooseCloudSyncKey>[0];
let mockOnSyncLoading: (() => void) | undefined;

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isDev: false, isDesktop: true, isExtensionUiPopup: false },
}));
jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/shared/src/utils/deviceUtils', () => ({
  __esModule: true,
  default: { getDefaultDeviceLabel: () => 'OneKey Pro' },
}));
jest.mock('@onekeyhq/components', () => {
  const { createElement } = jest.requireActual<typeof import('react')>('react');
  type IProps = {
    children?: ReactNode;
    testID?: string;
    disabled?: boolean;
    loading?: boolean;
    onPress?: () => Promise<void>;
    title?: string;
    description?: string;
  };
  return {
    YStack: ({ children }: IProps) => createElement('div', {}, children),
    Spinner: () => null,
    Dialog: { show: (params: IDialogParams) => mockDialogShow(params) },
  };
});
jest.mock('@onekeyhq/kit/src/components/ListItem', () => {
  const { createElement } = jest.requireActual<typeof import('react')>('react');
  return {
    ListItem: ({
      testID,
      title,
      onPress,
    }: {
      testID?: string;
      title?: string;
      onPress?: () => void;
    }) =>
      createElement(
        'button',
        { 'data-testid': testID, onClick: onPress },
        title,
      ),
  };
});
// The connect window is covered by the picker's own test; here the user
// picks device A in it.
jest.mock('./HardwareCloudSyncDevicePicker', () => {
  const { createElement } = jest.requireActual<typeof import('react')>('react');
  return {
    HardwareCloudSyncDevicePicker: ({
      onPick,
    }: {
      onPick: (connectId: string) => Promise<void>;
    }) =>
      createElement('button', {
        'data-testid': 'mock-device-picker',
        onClick: () => onPick('connect-A'),
      }),
  };
});
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceHardware: {
      clearForceTransportType: () => mockClearForceTransport(),
    },
    serviceApp: {
      openExtensionExpandTab: (params: unknown) => mockOpenExpandTab(params),
      showDialogLoading: async () => undefined,
      hideDialogLoading: async () => undefined,
      showToast: (params: unknown) => mockToast(params),
    },
    serviceSetting: {
      setHardwareTransportType: async () => undefined,
    },
    serviceKeylessCloudSync: {
      toggleCloudSyncKeyless: (params: unknown) => mockToggle(params),
      enableHardwareCloudSync: (params: unknown) => mockEnable(params),
      cancelHardwareCloudKeyOperation: () => mockCancel(),
    },
    servicePrimeCloudSync: {
      syncNowKeyless: (params: unknown) => mockSyncNow(params),
    },
  },
}));
jest.mock('@onekeyhq/shared/src/utils/timerUtils', () => ({
  __esModule: true,
  default: { wait: async () => undefined },
}));
jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: { ShowDialogLoading: 'ShowDialogLoading' },
  appEventBus: {
    once: (_name: string, fn: () => void) => {
      mockOnSyncLoading = fn;
    },
    off: () => {
      mockOnSyncLoading = undefined;
    },
  },
}));
jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: () => ({ result: mockKeyMissing }),
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useSettingsPersistAtom: () => [{ hardwareTransportType: 'WEBUSB' }],
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms/prime', () => ({
  usePrimeCloudSyncPersistAtom: () => [mockConfig],
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockConfig = {
    isCloudSyncEnabled: false,
    isCloudSyncEnabledKeyless: false,
    hardwareCloudSyncKeySource: {
      credentialId,
      deviceName: 'My OneKey',
      deviceType: 'pro',
    },
  };
  mockKeyMissing = false;
  mockToggle.mockResolvedValue({ requiresHardware: false });
});
afterEach(() => jest.restoreAllMocks());

function lastDialog() {
  const [params] =
    mockDialogShow.mock.calls[mockDialogShow.mock.calls.length - 1];
  return params;
}

test('the key chooser resolves the picked key once the dialog closes', async () => {
  const choice = chooseCloudSyncKey(mockIntl);
  const dialog = lastDialog();
  render(<>{dialog.renderContent}</>);
  fireEvent.click(screen.getByTestId('cloud-sync-key-hardware'));
  expect(mockDialogClose).toHaveBeenCalled();
  void dialog.onClose?.();
  await expect(choice).resolves.toBe('hardware');
});

test('dismissing the key chooser picks nothing', async () => {
  const choice = chooseCloudSyncKey(mockIntl);
  void lastDialog().onClose?.();
  await expect(choice).resolves.toBeUndefined();
});

test('turns sync on by picking a device, without adding a wallet first', async () => {
  mockConfig.hardwareCloudSyncKeySource = undefined;
  const { result } = renderHook(() => useHardwareCloudSyncKey());
  await act(() => result.current.openPicker());
  const dialog = lastDialog();
  render(<>{dialog.renderContent}</>);
  await act(async () => {
    fireEvent.click(screen.getByTestId('mock-device-picker'));
  });
  expect(mockDialogClose).toHaveBeenCalled();
  expect(mockEnable).toHaveBeenCalledWith({
    connectId: 'connect-A',
    switchDevice: false,
  });
  expect(mockClearForceTransport).toHaveBeenCalled();
});

test('closing the connect window does not turn sync on', async () => {
  const { result } = renderHook(() => useHardwareCloudSyncKey());
  await act(() => result.current.openPicker());
  void lastDialog().onClose?.();
  expect(mockEnable).not.toHaveBeenCalled();
  expect(mockClearForceTransport).toHaveBeenCalled();
});

test('the extension popup connects in a full tab, as onboarding does', async () => {
  jest.replaceProperty(platformEnv, 'isExtensionUiPopup', true);
  const { result } = renderHook(() => useHardwareCloudSyncKey());
  await act(() => result.current.openPicker());
  expect(mockOpenExpandTab).toHaveBeenCalled();
  expect(mockDialogShow).not.toHaveBeenCalled();
});

test('Sync now uses the hardware key and asks for a password only when needed', async () => {
  mockConfig.isCloudSyncEnabledKeyless = true;
  const { result } = renderHook(() => useHardwareCloudSyncKey());
  await act(() => result.current.syncNow());
  expect(mockSyncNow).toHaveBeenCalledWith(
    expect.objectContaining({ askPasswordOnlyIfHdXfpMissing: true }),
  );
  expect(mockToast).toHaveBeenCalledWith(
    expect.objectContaining({ method: 'success' }),
  );
});

test('leaving the page cancels a pending device request', () => {
  const { unmount } = renderHook(() => useHardwareCloudSyncKey());
  unmount();
  expect(mockCancel).toHaveBeenCalled();
});

test('unsupported runtimes expose no hardware key', () => {
  jest.replaceProperty(platformEnv, 'isDesktop', false);
  const { result } = renderHook(() => useHardwareCloudSyncKey());
  expect(result.current.supported).toBe(false);
  expect(result.current.source).toBeUndefined();
});

async function pickDeviceA() {
  const { result } = renderHook(() => useHardwareCloudSyncKey());
  await act(() => result.current.openPicker());
  render(<>{lastDialog().renderContent}</>);
  await act(async () => {
    fireEvent.click(screen.getByTestId('mock-device-picker'));
  });
  return lastDialog();
}

test('the waiting dialog closes when the sync loading shows, without cancelling', async () => {
  mockEnable.mockImplementationOnce(() => new Promise<undefined>(() => {}));
  const waiting = await pickDeviceA();
  mockDialogClose.mockClear();
  act(() => mockOnSyncLoading?.());
  expect(mockDialogClose).toHaveBeenCalled();
  await waiting.onClose?.();
  expect(mockCancel).not.toHaveBeenCalled();
});

test('closing the waiting dialog before signing cancels the device request', async () => {
  mockEnable.mockImplementationOnce(() => new Promise<undefined>(() => {}));
  const waiting = await pickDeviceA();
  await waiting.onClose?.();
  expect(mockCancel).toHaveBeenCalled();
});

test('a mismatched hardware wallet continues after the user confirms', async () => {
  mockEnable.mockRejectedValueOnce({
    key: 'cloud_sync_hardware_wallet_mismatch__msg',
  });
  const { result } = renderHook(() => useHardwareCloudSyncKey());
  await act(() => result.current.openPicker());
  render(<>{lastDialog().renderContent}</>);
  const picking = act(async () => {
    fireEvent.click(screen.getByTestId('mock-device-picker'));
  });
  await act(async () => {
    await Promise.resolve();
  });
  await picking;
  const confirm = mockDialogShow.mock.calls.find(
    ([params]) => params.title === 'cloud_sync_hardware_mismatch__title',
  )?.[0];
  expect(confirm).toBeDefined();
  await act(async () => {
    await confirm?.onConfirm?.();
    await confirm?.onClose?.();
  });
  expect(mockEnable).toHaveBeenLastCalledWith({
    connectId: 'connect-A',
    switchDevice: true,
  });
});

/** @jest-environment jsdom */
import type { ReactNode } from 'react';

import { HardwareErrorCode } from '@onekeyfe/hd-shared';
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
} from '@testing-library/react';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import { HardwareCloudSyncCancelledError } from '@onekeyhq/shared/src/hardware/hardwareCloudSyncError';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EHardwareUiStateAction } from '@onekeyhq/shared/types/hardwareUi';

import {
  chooseCloudSyncKey,
  useHardwareCloudSyncKey,
} from './HardwareCloudSyncKeySection';

const mockToggle = jest.fn<
  Promise<{ requiresHardware: boolean } | undefined>,
  [unknown]
>();
const mockEnable = jest.fn(async (_params: unknown) => undefined);
const mockReset = jest.fn(async (_params: unknown) => undefined);
type IDialogParams = {
  title?: string;
  description?: string;
  onConfirmText?: string;
  tone?: string;
  dismissOnOverlayPress?: boolean;
  disableDrag?: boolean;
  renderContent?: ReactNode;
  onConfirm?: () => Promise<void> | void;
  onClose?: () => Promise<void> | void;
};
const mockDialogClose = jest.fn<Promise<void>, []>(async () => undefined);
const mockDialogShow = jest.fn((_params: IDialogParams) => ({
  close: mockDialogClose,
}));
const mockClearForceTransport = jest.fn(async () => undefined);
const mockOpenExpandTab = jest.fn(async (_params: unknown) => undefined);
const mockCancel = jest.fn(async () => true);
const mockSyncNow = jest.fn(
  async (_params: unknown): Promise<string> => 'completed',
);
const mockHideLoading = jest.fn<Promise<void>, []>(async () => undefined);
const mockToast = jest.fn((_params: unknown) => undefined);
const mockAutoToast = jest.fn<void, unknown[]>();
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
let mockHoldAvailabilityUntilRecheck = false;
let mockEndpointMismatch = false;
let mockReadHardwareStatus: (() => Promise<unknown>) | undefined;
const mockCheckHardwareSession = jest.fn(async () => undefined);
function getMockAvailability() {
  if (mockEndpointMismatch) return 'endpoint-mismatch';
  return mockKeyMissing ? 'missing' : 'available';
}
const mockAvailability = jest.fn(async () => getMockAvailability());
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
      hideDialogLoading: () => mockHideLoading(),
      showToast: (params: unknown) => mockToast(params),
    },
    serviceSetting: {
      setHardwareTransportType: async () => undefined,
    },
    serviceKeylessCloudSync: {
      getSelectedHardwareCloudKeyAvailability: () => mockAvailability(),
      checkHardwareCloudSyncSessionThrottled: () => mockCheckHardwareSession(),
      toggleCloudSyncKeyless: (params: unknown) => mockToggle(params),
      enableHardwareCloudSync: (params: unknown) => mockEnable(params),
      resetHardwareCloudSyncKey: (params: unknown) => mockReset(params),
      cancelHardwareCloudKeyOperation: () => mockCancel(),
    },
    servicePrimeCloudSync: {
      syncNowKeylessWithResult: (params: unknown) => mockSyncNow(params),
    },
  },
}));
jest.mock('@onekeyhq/shared/src/utils/timerUtils', () => ({
  __esModule: true,
  default: { wait: async () => undefined },
}));
jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: {
    ShowDialogLoading: 'ShowDialogLoading',
    HardwareCloudKeyDropped: 'HardwareCloudKeyDropped',
    RequestHardwareUIDialog: 'RequestHardwareUIDialog',
    ShowHardwareErrorDialog: 'ShowHardwareErrorDialog',
    ShowFirmwareUpdateForce: 'ShowFirmwareUpdateForce',
  },
  HARDWARE_ERROR_DIALOG_TYPES: {
    DEVICE_NOT_OPENED_PASSPHRASE: 'DeviceNotOpenedPassphrase',
  },
  appEventBus: {
    emit: (...params: unknown[]) => mockAutoToast(...params),
    on: () => undefined,
    once: (_name: string, fn: () => void) => {
      mockOnSyncLoading = fn;
    },
    off: (name: string) => {
      if (name === 'ShowDialogLoading') mockOnSyncLoading = undefined;
    },
  },
}));
jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => {
  const { useState } = jest.requireActual<typeof import('react')>('react');
  return {
    usePromiseResult: (
      readStatus: () => Promise<ReturnType<typeof getMockAvailability>>,
    ) => {
      mockReadHardwareStatus = readStatus;
      const [cached, setCached] = useState(getMockAvailability);
      return {
        result: mockHoldAvailabilityUntilRecheck
          ? cached
          : getMockAvailability(),
        run: async () => {
          if (mockHoldAvailabilityUntilRecheck) setCached(await readStatus());
        },
      };
    },
  };
});
jest.mock(
  '@onekeyhq/kit/src/provider/Container/DeviceStageContainer/waitForDeviceStageExit',
  () => ({
    yieldDeviceStageToDialog: jest.fn(async () => true),
  }),
);
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useDevSettingsPersistAtom: () => [{ enabled: false }],
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
  mockHoldAvailabilityUntilRecheck = false;
  mockEndpointMismatch = false;
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

test.each([
  'cloud_sync_hardware_hidden_wallet__msg',
  'cloud_sync_hardware_unlock_failed__msg',
  'cloud_sync_data_unreadable__msg',
  'error_network',
])(
  'a wallet refusal shows an explanation after the waiting dialog closes (%s)',
  async (key) => {
    mockEnable.mockRejectedValueOnce({
      key,
      autoToast: false,
    });
    let finishWaitingClose: (() => void) | undefined;
    mockDialogClose.mockResolvedValueOnce(undefined).mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishWaitingClose = resolve;
        }),
    );
    const { result } = renderHook(() => useHardwareCloudSyncKey());
    await act(() => result.current.openPicker());
    render(<>{lastDialog().renderContent}</>);
    await act(async () => {
      fireEvent.click(screen.getByTestId('mock-device-picker'));
    });
    expect(mockDialogShow).toHaveBeenCalledTimes(2);
    expect(finishWaitingClose).toBeDefined();

    await act(async () => finishWaitingClose?.());

    expect(lastDialog()).toMatchObject({
      description: key,
      onConfirmText: 'global.ok',
    });
    expect(result.current.pending).toBe(false);
    expect(mockConfig.isCloudSyncEnabledKeyless).toBe(false);
    expect(mockEnable).toHaveBeenCalledTimes(1);
  },
);

test('manual sync shows the original failure after loading closes', async () => {
  mockSyncNow.mockRejectedValueOnce({
    key: 'cloud_sync_data_unreadable__msg',
    message: 'Synthetic cloud data failure',
    autoToast: false,
  });
  const { result } = renderHook(() => useHardwareCloudSyncKey());
  await act(() => result.current.syncNow());
  expect(lastDialog().description).toBe('cloud_sync_data_unreadable__msg');
  expect(mockToast).not.toHaveBeenCalled();
});

test.each(['enable', 'reset'] as const)(
  'a toast-enabled %s failure has one owner while the waiting dialog closes',
  async (action) => {
    jest.useFakeTimers();
    try {
      const failure = Object.assign(new Error('Synthetic cloud failure'), {
        key: 'cloud_sync_data_unreadable__msg',
        autoToast: true,
      });
      (action === 'enable' ? mockEnable : mockReset).mockImplementationOnce(
        async () => {
          // BackgroundApiProxyBase schedules its toast before rethrowing to UI.
          setTimeout(() => errorToastUtils.showToastOfError(failure), 50);
          throw failure;
        },
      );
      let finishWaitingClose: (() => void) | undefined;
      mockDialogClose.mockResolvedValueOnce(undefined).mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            finishWaitingClose = resolve;
          }),
      );
      if (action === 'reset') {
        await pickResetDevice();
      } else {
        await pickDeviceA();
      }
      await act(async () => {
        jest.advanceTimersByTime(50);
      });
      expect(mockAutoToast).not.toHaveBeenCalled();
      expect(mockDialogShow).toHaveBeenCalledTimes(action === 'reset' ? 3 : 2);
      await act(async () => finishWaitingClose?.());
      expect(lastDialog().description).toBe(failure.key);
      expect(mockDialogShow).toHaveBeenCalledTimes(action === 'reset' ? 4 : 3);
    } finally {
      jest.useRealTimers();
    }
  },
);

test('manual sync claims a business failure before awaiting loading dismissal', async () => {
  jest.useFakeTimers();
  try {
    const failure = Object.assign(new Error('Synthetic manual sync failure'), {
      autoToast: true,
    });
    mockSyncNow.mockImplementationOnce(async () => {
      setTimeout(() => errorToastUtils.showToastOfError(failure), 50);
      throw failure;
    });
    let finishLoading: (() => void) | undefined;
    mockHideLoading.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishLoading = resolve;
        }),
    );
    const { result } = renderHook(() => useHardwareCloudSyncKey());
    let syncing: Promise<void> | undefined;
    await act(async () => {
      syncing = result.current.syncNow();
    });
    await act(async () => {
      jest.advanceTimersByTime(50);
    });
    expect(mockAutoToast).not.toHaveBeenCalled();
    expect(mockDialogShow).not.toHaveBeenCalled();
    await act(async () => {
      finishLoading?.();
      await syncing;
    });
    expect(lastDialog().description).toBe(failure.message);
  } finally {
    jest.useRealTimers();
  }
});

test('an error already shown by the proxy does not open a second business dialog', async () => {
  const failure = Object.assign(
    new Error('Synthetic previously shown failure'),
    {
      autoToast: true,
    },
  );
  mockEnable.mockImplementationOnce(async () => {
    errorToastUtils.showToastOfError(failure);
    throw failure;
  });
  await pickDeviceA();
  expect(mockAutoToast).toHaveBeenCalledTimes(1);
  expect(mockDialogShow).toHaveBeenCalledTimes(2);
});

test.each(['enable', 'reset'] as const)(
  'standard-wallet PIN refusal during %s has a persistent Cloud dialog',
  async (action) => {
    const failure = Object.assign(
      new Error('The entered PIN does not correspond to the current wallet'),
      {
        code: 118,
        key: 'hardware.device_pin_state_error',
        $isHardwareError: true,
        autoToast: false,
        info: { hardwareCloudSyncRefusal: 'standardPinRequired' },
      },
    );
    (action === 'enable' ? mockEnable : mockReset).mockRejectedValueOnce(
      failure,
    );
    if (action === 'enable') await pickDeviceA();
    else await pickResetDevice();
    expect(lastDialog()).toMatchObject({
      description: 'cloud_sync_hardware_hidden_wallet__msg',
      onConfirmText: 'global.ok',
      dismissOnOverlayPress: false,
      disableDrag: true,
    });
    expect(mockAutoToast).not.toHaveBeenCalled();
    expect(failure).toMatchObject({
      code: 118,
      key: 'hardware.device_pin_state_error',
    });
  },
);

test('setup preserves a failure without a translation key', async () => {
  mockEnable.mockRejectedValueOnce(new Error('Synthetic network failure'));
  const dialog = await pickDeviceA();
  expect(dialog.description).toBe('Synthetic network failure');
});

test.each([
  [
    HardwareErrorCode.BlePoweredOff,
    EHardwareUiStateAction.BLUETOOTH_PERMISSION,
  ],
  [
    HardwareErrorCode.BlePermissionError,
    EHardwareUiStateAction.BLUETOOTH_PERMISSION,
  ],
  [
    HardwareErrorCode.BleLocationError,
    EHardwareUiStateAction.LOCATION_PERMISSION,
  ],
  [
    HardwareErrorCode.BleLocationServicesDisabled,
    EHardwareUiStateAction.LOCATION_SERVICE_PERMISSION,
  ],
] as const)(
  'direct SDK code %s opens the shared recovery dialog',
  async (code, uiRequestType) => {
    mockEnable.mockRejectedValueOnce(
      Object.assign(new Error('Synthetic SDK permission error'), {
        code,
        $isHardwareError: true,
        autoToast: false,
        info: { hardwareCloudSyncErrorOrigin: 'directSdk' },
      }),
    );
    await pickDeviceA();
    expect(mockAutoToast).toHaveBeenCalledWith('RequestHardwareUIDialog', {
      uiRequestType,
    });
    expect(mockAutoToast).toHaveBeenCalledTimes(1);
  },
);

test.each([
  [HardwareErrorCode.DeviceNotOpenedPassphrase, 'ShowHardwareErrorDialog'],
  [HardwareErrorCode.NewFirmwareForceUpdate, 'ShowFirmwareUpdateForce'],
] as const)(
  'direct SDK code %s hands off to its dedicated recovery owner',
  async (code, event) => {
    mockEnable.mockRejectedValueOnce(
      Object.assign(new Error('Synthetic SDK recovery error'), {
        code,
        $isHardwareError: true,
        autoToast: false,
        payload: { code, connectId: 'connect-A' },
        info: { hardwareCloudSyncErrorOrigin: 'directSdk' },
      }),
    );
    await pickDeviceA();
    expect(mockAutoToast).toHaveBeenCalledWith(
      event,
      expect.objectContaining(
        code === HardwareErrorCode.NewFirmwareForceUpdate
          ? { connectId: 'connect-A' }
          : {
              errorType: 'DeviceNotOpenedPassphrase',
              payload: { code, connectId: 'connect-A' },
            },
      ),
    );
    expect(mockAutoToast).toHaveBeenCalledTimes(1);
  },
);

test('hardware failures already owned by DeviceStage do not open a generic dialog', async () => {
  mockEnable.mockRejectedValueOnce({
    key: 'hardware.device_pin_state_error',
    code: 118,
    $isHardwareError: true,
    autoToast: false,
  });
  await pickDeviceA();
  expect(mockDialogShow).toHaveBeenCalledTimes(2);
});

test('a cancelled Cloud operation stays silent', async () => {
  mockEnable.mockRejectedValueOnce({ key: 'update.operation_canceled' });
  await pickDeviceA();
  expect(mockDialogShow).toHaveBeenCalledTimes(2);
});

test('closing the connect window does not turn sync on', async () => {
  const { result } = renderHook(() => useHardwareCloudSyncKey());
  await act(() => result.current.openPicker());
  void lastDialog().onClose?.();
  expect(mockEnable).not.toHaveBeenCalled();
  expect(mockClearForceTransport).toHaveBeenCalled();
});

test('a connection that completes after dismissal does not reopen the signing flow', async () => {
  const { result } = renderHook(() => useHardwareCloudSyncKey());
  await act(async () => result.current.openPicker());
  const dialog = lastDialog();
  render(<>{dialog.renderContent}</>);
  await act(async () => dialog.onClose?.());
  await act(async () => {
    fireEvent.click(screen.getByTestId('mock-device-picker'));
  });
  expect(mockEnable).not.toHaveBeenCalled();
  expect(mockDialogShow).toHaveBeenCalledTimes(1);
});

test('the extension popup connects in a full tab, as onboarding does', async () => {
  jest.replaceProperty(platformEnv, 'isExtensionUiPopup', true);
  const { result } = renderHook(() => useHardwareCloudSyncKey());
  await act(() => result.current.openPicker());
  expect(mockOpenExpandTab).toHaveBeenCalled();
  expect(mockDialogShow).not.toHaveBeenCalled();
});

test('a different selected API node does not re-sign, probe or run sync; switching back restores sync', async () => {
  mockConfig.isCloudSyncEnabledKeyless = true;
  mockEndpointMismatch = true;
  const { result, rerender } = renderHook(() => useHardwareCloudSyncKey());
  expect(result.current.endpointMismatch).toBe(true);
  expect(result.current.keyMissing).toBe(false);
  await expect(mockReadHardwareStatus?.()).resolves.toBe('endpoint-mismatch');
  expect(mockCheckHardwareSession).not.toHaveBeenCalled();
  await act(async () => {
    await result.current.openPicker();
    await result.current.resetKey();
    await result.current.syncNow();
  });
  expect(mockSyncNow).not.toHaveBeenCalled();
  expect(mockEnable).not.toHaveBeenCalled();
  expect(mockReset).not.toHaveBeenCalled();
  expect(mockDialogShow).not.toHaveBeenCalled();
  mockEndpointMismatch = false;
  rerender();
  await expect(mockReadHardwareStatus?.()).resolves.toBe('available');
  expect(mockCheckHardwareSession).toHaveBeenCalledTimes(1);
  await act(() => result.current.syncNow());
  expect(mockSyncNow).toHaveBeenCalledTimes(1);
});

test.each(['re-signed', 'cancelled', 'error', 'node changed'] as const)(
  'refreshes the mounted missing-key result only after a successful re-sign (%s)',
  async (outcome) => {
    mockConfig.isCloudSyncEnabledKeyless = true;
    mockKeyMissing = true;
    mockHoldAvailabilityUntilRecheck = true;
    mockEnable.mockImplementationOnce(async () => {
      if (outcome === 'cancelled') throw new HardwareCloudSyncCancelledError();
      if (outcome === 'error')
        throw new OneKeyLocalError('Fixture sign-in failed');
      mockKeyMissing = false;
      if (outcome === 'node changed') mockEndpointMismatch = true;
    });
    const originalConfig = mockConfig;
    const { result } = renderHook(() => useHardwareCloudSyncKey());
    expect(result.current.keyMissing).toBe(true);

    await act(() => result.current.openPicker());
    render(<>{lastDialog().renderContent}</>);
    await act(async () => {
      fireEvent.click(screen.getByTestId('mock-device-picker'));
    });

    expect(mockEnable).toHaveBeenCalledTimes(1);
    expect(mockConfig).toBe(originalConfig);
    expect(result.current.keyMissing).toBe(
      outcome === 'cancelled' || outcome === 'error',
    );
    expect(result.current.endpointMismatch).toBe(outcome === 'node changed');
    expect(mockCheckHardwareSession).toHaveBeenCalledTimes(
      outcome === 're-signed' ? 1 : 0,
    );
  },
);

test('checks the real read-only action guard when node changes while the device picker is open', async () => {
  mockConfig.isCloudSyncEnabledKeyless = true;
  mockKeyMissing = true;
  const { result } = renderHook(() => useHardwareCloudSyncKey());
  expect(result.current.keyMissing).toBe(true);
  await act(() => result.current.openPicker());
  const dialog = lastDialog();
  render(<>{dialog.renderContent}</>);

  // Do not re-render availability. Simulate switching the selected node
  // while device selection remains open, then release this delayed read.
  let releaseStatus: undefined | ((state: 'endpoint-mismatch') => void);
  mockAvailability.mockImplementationOnce(
    async () =>
      new Promise<'endpoint-mismatch'>((resolve) => {
        releaseStatus = resolve;
      }),
  );
  await act(async () => {
    fireEvent.click(screen.getByTestId('mock-device-picker'));
  });
  expect(releaseStatus).toBeDefined();
  expect(mockEnable).not.toHaveBeenCalled();
  await act(async () => {
    releaseStatus?.('endpoint-mismatch');
  });
  expect(result.current.keyMissing).toBe(true);
  expect(mockEnable).not.toHaveBeenCalled();
  expect(mockReset).not.toHaveBeenCalled();
  expect(mockClearForceTransport).toHaveBeenCalled();
});

test('stale rendered availability cannot start a picker or an explicit sync against another node', async () => {
  mockConfig.isCloudSyncEnabledKeyless = true;
  const { result } = renderHook(() => useHardwareCloudSyncKey());
  expect(result.current.endpointMismatch).toBe(false);
  mockEndpointMismatch = true;
  await act(async () => {
    await result.current.openPicker();
    await result.current.resetKey();
    await result.current.syncNow();
  });
  expect(mockDialogShow).not.toHaveBeenCalled();
  expect(mockSyncNow).not.toHaveBeenCalled();
});

test.each([false, true])(
  'pauses on a credential read failure without a wrong-node action (visible mismatch=%s)',
  async (knownMismatch) => {
    mockConfig.isCloudSyncEnabledKeyless = true;
    mockEndpointMismatch = knownMismatch;
    mockAvailability.mockRejectedValueOnce(
      new Error('Synthetic secure storage read error'),
    );
    const { result } = renderHook(() => useHardwareCloudSyncKey());
    await act(() => result.current.syncNow());
    expect(mockSyncNow).not.toHaveBeenCalled();
    expect(mockDialogShow).toHaveBeenCalledTimes(knownMismatch ? 0 : 1);
    if (!knownMismatch) {
      expect(lastDialog().description).toBe('global.unknown_error');
      expect(lastDialog().description).not.toContain(
        'Synthetic secure storage read error',
      );
    }
  },
);

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

test.each(['local-deferred', 'cancelled', 'incomplete', 'sync-disabled'])(
  'hardware sync does not toast for %s',
  async (outcome) => {
    mockConfig.isCloudSyncEnabledKeyless = true;
    mockSyncNow.mockResolvedValueOnce(outcome);
    const { result } = renderHook(() => useHardwareCloudSyncKey());

    await act(() => result.current.syncNow());

    expect(mockHideLoading).toHaveBeenCalledTimes(1);
    expect(mockToast).not.toHaveBeenCalled();
    expect(mockDialogShow).not.toHaveBeenCalled();
  },
);

test.each([
  ['network-unavailable', 'global.network_error'],
  ['server-unavailable', 'global.server_error'],
  ['sync-blocked', 'global.sync_error'],
  ['hardware-key-unavailable', 'cloud_sync_hardware_key_missing__desc'],
])('hardware sync surfaces attributable %s', async (outcome, title) => {
  mockConfig.isCloudSyncEnabledKeyless = true;
  mockSyncNow.mockResolvedValueOnce(outcome);
  const { result } = renderHook(() => useHardwareCloudSyncKey());

  await act(() => result.current.syncNow());

  expect(mockToast).toHaveBeenCalledWith({ method: 'error', title });
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

async function pickResetDevice() {
  const { result } = renderHook(() => useHardwareCloudSyncKey());
  let resetting: Promise<void> | undefined;
  await act(async () => {
    resetting = result.current.resetKey();
  });
  const resetConfirm = lastDialog();
  await act(async () => {
    await resetConfirm.onConfirm?.();
    await resetConfirm.onClose?.();
    await resetting;
  });
  render(<>{lastDialog().renderContent}</>);
  await act(async () => {
    fireEvent.click(screen.getByTestId('mock-device-picker'));
  });
}

test('reset offers a confirmed migration bound to the selected wallet identity', async () => {
  const targetCredentialId = `hardware-cloud-v1-${'b'.repeat(64)}`;
  mockReset.mockRejectedValueOnce({
    key: 'cloud_sync_hardware_wallet_mismatch__msg',
    autoToast: false,
    info: { targetCredentialId },
  });
  await pickResetDevice();
  const migrationConfirm = mockDialogShow.mock.calls.find(
    ([params]) => params.title === 'cloud_sync_hardware_switch__title',
  )?.[0];
  expect(migrationConfirm).toBeDefined();
  await act(async () => {
    await migrationConfirm?.onConfirm?.();
    await migrationConfirm?.onClose?.();
  });
  expect(mockReset).toHaveBeenLastCalledWith({
    connectId: 'connect-A',
    targetCredentialId,
  });
});

test.each([true, false])(
  'populated target continues only after the second confirmation: %s',
  async (confirmed) => {
    const targetCredentialId = `hardware-cloud-v1-${'b'.repeat(64)}`;
    const targetSnapshotHash = 'c'.repeat(64);
    mockReset
      .mockRejectedValueOnce({
        key: 'cloud_sync_hardware_wallet_mismatch__msg',
        autoToast: false,
        info: { targetCredentialId },
      })
      .mockRejectedValueOnce({
        key: 'cloud_sync_hardware_switch_target_has_data__msg',
        autoToast: false,
        info: { targetCredentialId, targetSnapshotHash },
      });
    await pickResetDevice();
    const switchConfirm = lastDialog();
    await act(async () => {
      await switchConfirm.onConfirm?.();
      await switchConfirm.onClose?.();
    });
    const overwriteConfirm = lastDialog();
    expect(overwriteConfirm).toMatchObject({
      title: 'cloud_sync_hardware_overwrite__title',
      description: 'cloud_sync_hardware_switch_target_has_data__msg',
      onConfirmText: 'cloud_sync_hardware_overwrite__action',
      tone: 'destructive',
    });
    expect(mockReset).toHaveBeenCalledTimes(2);
    await act(async () => {
      if (confirmed) await overwriteConfirm.onConfirm?.();
      await overwriteConfirm.onClose?.();
    });
    expect(mockReset).toHaveBeenCalledTimes(confirmed ? 3 : 2);
    if (confirmed) {
      expect(mockReset).toHaveBeenLastCalledWith({
        connectId: 'connect-A',
        targetCredentialId,
        overwriteTargetSnapshot: targetSnapshotHash,
      });
    }
  },
);

test('a changed target snapshot asks again before the replacement continues', async () => {
  const targetCredentialId = `hardware-cloud-v1-${'b'.repeat(64)}`;
  const firstSnapshot = 'c'.repeat(64);
  const latestSnapshot = 'd'.repeat(64);
  mockReset
    .mockRejectedValueOnce({
      key: 'cloud_sync_hardware_wallet_mismatch__msg',
      autoToast: false,
      info: { targetCredentialId },
    })
    .mockRejectedValueOnce({
      key: 'cloud_sync_hardware_switch_target_has_data__msg',
      autoToast: false,
      info: { targetCredentialId, targetSnapshotHash: firstSnapshot },
    })
    .mockRejectedValueOnce({
      key: 'cloud_sync_hardware_switch_target_has_data__msg',
      autoToast: false,
      info: { targetCredentialId, targetSnapshotHash: latestSnapshot },
    });
  await pickResetDevice();
  for (let index = 0; index < 2; index += 1) {
    const dialog = lastDialog();
    await act(async () => {
      await dialog.onConfirm?.();
      await dialog.onClose?.();
    });
  }
  expect(mockReset).toHaveBeenCalledTimes(3);
  expect(mockReset).toHaveBeenLastCalledWith({
    connectId: 'connect-A',
    targetCredentialId,
    overwriteTargetSnapshot: firstSnapshot,
  });
  const changedDataConfirm = lastDialog();
  expect(changedDataConfirm.tone).toBe('destructive');
  await act(async () => {
    await changedDataConfirm.onConfirm?.();
    await changedDataConfirm.onClose?.();
  });
  expect(mockReset).toHaveBeenCalledTimes(4);
  expect(mockReset).toHaveBeenLastCalledWith({
    connectId: 'connect-A',
    targetCredentialId,
    overwriteTargetSnapshot: latestSnapshot,
  });
});

/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EHardwareTransportType } from '@onekeyhq/shared/types';

import { OnboardingTestIDs } from '../testIDs';

import { ConnectDeviceChannels } from './ConnectYourDevice';

const mockIntl = { formatMessage: ({ id }: { id: string }) => id };
let mockTransport = EHardwareTransportType.BLE;
const mockPermission = jest.fn<Promise<boolean>, []>();
const mockCheckState = jest.fn(async () => 'on');
const mockWebAccess = jest.fn(async () => undefined);
const mockScanner = {
  startDeviceScan: jest.fn<
    void,
    [
      (response: {
        success: boolean;
        payload: { name: string; connectId: string }[];
      }) => void,
      ...unknown[],
    ]
  >(),
  stopScan: jest.fn(),
  stopScanAndWait: jest.fn(async () => {}),
};
const mockShowDialog = jest.fn<void, [unknown]>();
const mockHandleScanError = jest.fn();
const mockResetScanError = jest.fn();
const mockRegisterFooter = jest.fn((_props: { showFooter: boolean }) => null);
let mockPublishBluetoothStatus: ((status: string) => void) | undefined;

jest.mock('react-intl', () => ({ useIntl: () => mockIntl }));
jest.mock('@react-navigation/core', () => ({ useIsFocused: () => true }));
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({}) }));
jest.mock('react-native', () => ({ StyleSheet: { hairlineWidth: 1 } }));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: true, isDesktop: false, isSupportDesktopBle: false },
}));
jest.mock('@onekeyhq/shared/src/hardware/blePermissions', () => ({
  checkBLEPermissions: () => mockPermission(),
}));
jest.mock('@onekeyhq/shared/src/hardware/bleManager', () => ({
  __esModule: true,
  default: { checkState: () => mockCheckState() },
}));
jest.mock('@onekeyhq/shared/src/utils/deviceUtils', () => ({
  __esModule: true,
  default: {
    getDeviceScanner: () => mockScanner,
    isBluetoothSearchDevice: () => true,
  },
}));
jest.mock('../../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceHardware: { setForceTransportType: jest.fn(async () => {}) },
  },
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useSettingsPersistAtom: () => [{ hardwareTransportType: mockTransport }],
}));
jest.mock(
  '@onekeyhq/kit/src/hooks/useOnboardingDeviceScanErrorHandler',
  () => ({
    useOnboardingDeviceScanErrorHandler: () => ({
      handleScanError: mockHandleScanError,
      resetScanError: mockResetScanError,
    }),
  }),
);
jest.mock('@onekeyhq/shared/src/utils/openUrlUtils', () => ({
  openUrlExternal: jest.fn(),
}));
jest.mock('@onekeyhq/kit/src/views/Intercom/client', () => ({
  showIntercom: jest.fn(),
}));
jest.mock('@onekeyhq/kit/src/hooks/usePromptWebDeviceAccess', () => ({
  usePromptWebDeviceAccess: () => ({ promptWebUsbDeviceAccess: mockWebAccess }),
}));
jest.mock('../utils', () => ({
  getForceTransportType: async () => mockTransport,
  getThirdPartySearchTarget: () => undefined,
  sortDevicesData: <T,>(devices: T[]) => devices,
}));
jest.mock('../hooks/useDeviceConnect', () => ({
  EBluetoothStatus: {
    checking: 'checking',
    enabled: 'enabled',
    disabledInApp: 'disabledInApp',
    disabledInSystem: 'disabledInSystem',
    noSystemPermission: 'noSystemPermission',
  },
  useDesktopBluetoothStatusPolling: (
    _channel: unknown,
    onChange: (status: string) => void,
  ) => {
    mockPublishBluetoothStatus = onChange;
    return {};
  },
}));
jest.mock('../../../hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({}),
}));
jest.mock('../../../hooks/useDeviceStageBurst', () => ({
  useDeviceStageBurst: () => ({}),
}));
jest.mock(
  '../../../provider/Container/HardwareUiStateContainer/hardwareUiStateDialogLifecycle',
  () => ({ hardwareUiStateDialogLifecycle: {} }),
);
jest.mock(
  '../../../components/AccountSelector/AccountSelectorProvider',
  () => ({ AccountSelectorProviderMirror: () => null }),
);
jest.mock('../../../components/Hardware/HardwareDialog', () => ({
  OpenBleSettingsDialog: () => null,
  RequireBlePermissionDialog: () => null,
}));
jest.mock('../components/Layout', () => ({ OnboardingPage: () => null }));
jest.mock('../components/FoundDevicesFooter', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    FoundDevicesFooter: ({
      isPreparing,
      isScanning,
      devices,
      variant,
    }: {
      isPreparing?: boolean;
      isScanning: boolean;
      devices: unknown[];
      variant?: string;
    }) => {
      let phase = 'idle';
      if (isPreparing) phase = 'preparing';
      else if (isScanning) phase = 'scanning';
      return React.createElement(
        React.Fragment,
        null,
        React.createElement('div', { 'data-testid': 'search-phase' }, phase),
        variant === 'dialog'
          ? React.createElement(mockRegisterFooter, {
              showFooter: devices.length > 0,
            })
          : null,
      );
    },
  };
});
jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const Container = ({ children }: { children?: ReactNode }) =>
    React.createElement('div', null, children);
  return {
    Button: ({
      children,
      onPress,
      testID,
    }: {
      children?: ReactNode;
      onPress?: () => void;
      testID?: string;
    }) =>
      React.createElement(
        'button',
        { onClick: onPress, 'data-testid': testID },
        children,
      ),
    YStack: Container,
    XStack: Container,
    SizableText: Container,
    LottieView: () => null,
    Video: () => null,
    EVideoResizeMode: { COVER: 'cover' },
    Empty: ({ title }: { title: string }) =>
      React.createElement('div', null, title),
    SegmentControl: ({
      options,
      onChange,
    }: {
      options: { label: string; value: string }[];
      onChange: (value: string) => void;
    }) =>
      React.createElement(
        'div',
        null,
        options.map(({ label, value }) =>
          React.createElement(
            'button',
            { key: value, onClick: () => onChange(value) },
            label,
          ),
        ),
      ),
    Dialog: {
      show: (props: unknown) => mockShowDialog(props),
      Footer: (props: { showFooter: boolean }) => mockRegisterFooter(props),
    },
    useMedia: () => ({ gtMd: false }),
  };
});
jest.mock('./ConnectionIndicator', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const Container = ({ children }: { children?: ReactNode }) =>
    React.createElement('div', null, children);
  return {
    ConnectionIndicator: Object.assign(Container, {
      Card: Container,
      Animation: () => null,
      Content: Container,
      Title: Container,
      Footer: Container,
    }),
  };
});

const mockPlatform = platformEnv;
function renderChannels(dialog = true) {
  return render(
    <ConnectDeviceChannels
      deviceTypeItems={[]}
      connectDevice={jest.fn()}
      onWebDeviceConnected={jest.fn()}
      variant={dialog ? 'dialog' : undefined}
    />,
  );
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockPlatform.isNative = true;
  mockPlatform.isDesktop = false;
  mockPlatform.isSupportDesktopBle = false;
  mockPublishBluetoothStatus = undefined;
  mockTransport = EHardwareTransportType.BLE;
  mockPermission.mockResolvedValue(true);
});
afterEach(() => {
  cleanup();
  jest.useRealTimers();
});

test('Cloud never flashes the start button while permission checks and automatic scanning begin', async () => {
  let grant = (_value: boolean) => {};
  mockPermission.mockImplementation(
    () =>
      new Promise((resolve) => {
        grant = resolve;
      }),
  );
  renderChannels();
  expect(
    screen.queryByTestId(
      OnboardingTestIDs.connectYourDeviceBluetoothConnectBtn,
    ),
  ).toBeNull();
  expect(screen.getByTestId('search-phase').textContent).toBe('preparing');
  await act(async () => {
    jest.advanceTimersByTime(120);
  });
  expect(mockPermission).toHaveBeenCalledTimes(1);
  expect(
    screen.queryByTestId(
      OnboardingTestIDs.connectYourDeviceBluetoothConnectBtn,
    ),
  ).toBeNull();
  await act(async () => grant(true));
  expect(mockScanner.startDeviceScan).toHaveBeenCalled();
  expect(screen.getByTestId('search-phase').textContent).toBe('scanning');
  expect(
    screen.queryByTestId(
      OnboardingTestIDs.connectYourDeviceBluetoothConnectBtn,
    ),
  ).toBeNull();
});

test('the original onboarding start state is preserved', () => {
  renderChannels(false);
  expect(
    screen.getByTestId(OnboardingTestIDs.connectYourDeviceBluetoothConnectBtn),
  ).toBeDefined();
});

test('Cloud offers a manual retry after the Bluetooth permission dialog closes', async () => {
  mockPermission.mockResolvedValue(false);
  renderChannels();
  await act(async () => {
    jest.advanceTimersByTime(120);
  });
  const dialog = mockShowDialog.mock.calls[0][0] as { onClose: () => void };
  act(() => dialog.onClose());
  expect(
    screen.getByTestId(OnboardingTestIDs.connectYourDeviceBluetoothConnectBtn),
  ).toBeDefined();
  expect(screen.getByTestId('search-phase').textContent).toBe('idle');
});

test('WebUSB still waits for a user click instead of pretending to scan', async () => {
  mockPlatform.isNative = false;
  mockTransport = EHardwareTransportType.WEBUSB;
  renderChannels();
  await act(async () => {
    jest.advanceTimersByTime(200);
  });
  expect(mockWebAccess).not.toHaveBeenCalled();
  expect(mockScanner.startDeviceScan).not.toHaveBeenCalled();
  await act(async () =>
    fireEvent.click(
      screen.getByTestId(OnboardingTestIDs.connectYourDeviceUSBConnectBtn),
    ),
  );
  expect(mockWebAccess).toHaveBeenCalledTimes(1);
});

test.each(['disabledInApp', 'disabledInSystem', 'noSystemPermission'])(
  'Cloud clears the registered connection action when desktop Bluetooth becomes %s',
  async (status) => {
    mockPlatform.isNative = false;
    mockPlatform.isDesktop = true;
    mockPlatform.isSupportDesktopBle = true;
    renderChannels();
    fireEvent.click(screen.getByRole('button', { name: 'global.bluetooth' }));
    await act(async () => mockPublishBluetoothStatus?.('enabled'));
    const receiveScan = mockScanner.startDeviceScan.mock.calls.at(-1)?.[0];
    expect(receiveScan).toBeDefined();
    act(() => {
      receiveScan?.({
        success: true,
        payload: [{ name: 'OneKey Pro', connectId: 'test-connect' }],
      });
    });
    expect(mockRegisterFooter.mock.calls.at(-1)?.[0]).toEqual({
      showFooter: true,
    });
    act(() => mockPublishBluetoothStatus?.(status));
    expect(mockRegisterFooter.mock.calls.at(-1)?.[0]).toEqual({
      showFooter: false,
    });
  },
);

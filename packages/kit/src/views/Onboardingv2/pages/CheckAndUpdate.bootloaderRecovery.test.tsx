/** @jest-environment jsdom */

import type { ComponentProps, PropsWithChildren } from 'react';

import { act, fireEvent, render, screen } from '@testing-library/react';

import type { IOneKeyDeviceFeatures } from '@onekeyhq/shared/types/device';

import type { useDeviceConnect } from '../hooks/useDeviceConnect';
import { OnboardingTestIDs } from '../testIDs';

import CheckAndUpdate from './CheckAndUpdate';

import type { SearchDevice } from '@onekeyfe/hd-core';

const mockDevice = {
  connectId: 'usb-before-update',
  serialNo: 'same-serial',
  uuid: 'same-uuid',
  deviceId: 'same-device-id',
  deviceType: 'pro2',
  name: 'OneKey Pro 2',
  commType: 'usb',
} as SearchDevice;
const mockReconnectedDevice = {
  ...mockDevice,
  connectId: 'usb-after-update',
};
const mockApplicationFeatures = {
  bootloader_mode: false,
  device_id: mockDevice.deviceId,
} as IOneKeyDeviceFeatures;
const mockGetFeatures = jest.fn();
const mockCheckRelease = jest.fn();
const mockOpenChangeLog = jest.fn();
const mockPrepareUSBConnect = jest.fn();
const mockEventHandlers = new Map<string, () => void>();
const mockIntl = { formatMessage: ({ id }: { id: string }) => id };
let mockActualRebind: ReturnType<
  typeof useDeviceConnect
>['rebindDeviceAfterFirmwareUpdate'];
const mockRebind = jest.fn((...args: Parameters<typeof mockActualRebind>) =>
  mockActualRebind(...args),
);
const mockConnection = {
  verifyHardware: jest.fn(),
  ensureActiveConnection: jest.fn(),
};
const mockDeviceScanner = { stopScanAndWait: jest.fn(), stopScan: jest.fn() };
const mockResolveTransport = jest.fn(
  async ({ connectId }: { connectId: string }) => ({
    connectId,
    transportType: 'usb',
  }),
);
const mockBurst = { ensureBurst: jest.fn(), endBurst: jest.fn() };
const mockActions = { openChangeLogModal: mockOpenChangeLog };
const mockTransport = {
  prepareUSBConnect: mockPrepareUSBConnect,
  restoreOriginalTransport: jest.fn(),
};
const mockNavigation = {
  addListener: jest.fn(() => jest.fn()),
  push: jest.fn(),
};

jest.mock('@react-navigation/native', () => {
  const React = jest.requireActual('react') as typeof import('react');
  return {
    useNavigation: () => mockNavigation,
    useFocusEffect: (callback: () => void | (() => void)) =>
      React.useEffect(callback, [callback]),
  };
});
jest.mock('react-intl', () => ({
  ...jest.requireActual('react-intl'),
  useIntl: () => mockIntl,
}));
jest.mock('react-native', () => ({
  StyleSheet: { hairlineWidth: 1 },
}));
jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual('react') as typeof import('react');
  const Container = ({ children }: PropsWithChildren) =>
    React.createElement('div', null, children);
  return {
    AnimatePresence: Container,
    HeightTransition: Container,
    SizableText: Container,
    Theme: Container,
    XStack: Container,
    YStack: Container,
    Dialog: { show: jest.fn() },
    DialogContainer: Container,
    EInPageDialogType: { inOnboardingPage: 'onboarding' },
    useInPageDialog: () => ({ show: jest.fn() }),
    Button: ({
      children,
      testID,
      onPress,
      disabled,
    }: PropsWithChildren<{
      testID?: string;
      onPress?: () => void;
      disabled?: boolean;
    }>) =>
      React.createElement(
        'button',
        {
          'data-testid': testID,
          onClick: onPress,
          disabled,
        },
        children,
      ),
  };
});
jest.mock('@onekeyhq/kit/src/hooks/useDeviceStageBurst', () => ({
  useDeviceStageBurst: () => mockBurst,
}));
jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: {
    BeginFirmwareUpdate: 'begin',
    FinishFirmwareUpdate: 'finish',
  },
  appEventBus: {
    on: (name: string, handler: () => void) =>
      mockEventHandlers.set(name, handler),
    off: (name: string) => mockEventHandlers.delete(name),
  },
}));
jest.mock('@onekeyhq/shared/src/utils/deviceUtils', () => ({
  __esModule: true,
  default: {
    getDefaultDeviceLabel: () => 'OneKey Pro 2',
    getDeviceScanner: () => mockDeviceScanner,
  },
}));
jest.mock('../../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceHardware: {
      searchDevices: jest.fn(async () => ({
        success: true,
        payload: [mockReconnectedDevice],
      })),
      getFeaturesWithoutCache: (...args: unknown[]) => mockGetFeatures(...args),
      resolveHardwareTransport: (
        ...args: Parameters<typeof mockResolveTransport>
      ) => mockResolveTransport(...args),
      cancel: jest.fn(),
      clearForceTransportType: jest.fn(),
    },
    serviceFirmwareUpdate: {
      checkAllFirmwareRelease: (...args: unknown[]) =>
        mockCheckRelease(...args),
    },
  },
}));
jest.mock('../../../components/AccountSelector', () => {
  const React = jest.requireActual('react') as typeof import('react');
  return {
    AccountSelectorProviderMirror: ({ children }: PropsWithChildren) =>
      React.createElement(React.Fragment, null, children),
  };
});
jest.mock('../../../hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => mockNavigation,
}));
jest.mock('../../FirmwareUpdate/hooks/useFirmwareUpdateActions', () => ({
  useFirmwareUpdateActions: () => mockActions,
}));
jest.mock('../components/CheckStepIllustration', () => ({
  CheckStepIllustration: () => null,
}));
jest.mock('../components/Confetti', () => ({ Confetti: () => null }));
jest.mock('../components/Layout', () => {
  const React = jest.requireActual('react') as typeof import('react');
  return {
    OnboardingPage: ({ children }: PropsWithChildren) =>
      React.createElement('div', null, children),
  };
});
jest.mock('../hooks/useDeviceConnect', () => ({
  useDeviceConnect: (...args: Parameters<typeof useDeviceConnect>) => {
    const actual = jest.requireActual(
      '../hooks/useDeviceConnect',
    ) as typeof import('../hooks/useDeviceConnect');
    const connection = actual.useDeviceConnect(...args);
    mockActualRebind = connection.rebindDeviceAfterFirmwareUpdate;
    return {
      ...connection,
      ...mockConnection,
      rebindDeviceAfterFirmwareUpdate: mockRebind,
    };
  },
  useConnectDeviceError: jest.fn(),
}));
jest.mock('../hooks/usePrepareUSBConnectForFirmwareUpdate', () => ({
  usePrepareUSBConnectForFirmwareUpdate: () => mockTransport,
}));
jest.mock('../utils', () => ({ getForceTransportType: jest.fn() }));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useSettingsPersistAtom: () => [{}],
}));
jest.mock('@onekeyhq/shared/src/errors/utils/deviceErrorUtils', () => ({}));
jest.mock('@onekeyhq/shared/src/errors/utils/errorToastUtils', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    hardware: { sdkLog: { log: jest.fn() } },
  },
}));
jest.mock('@onekeyhq/shared/src/modules3rdParty/intercom', () => ({}));
jest.mock('../../../components/ListItem', () => ({}));
jest.mock('../../../hooks/useUserWalletProfile', () => ({
  useUserWalletProfile: () => ({}),
}));
jest.mock(
  '../../../provider/Container/HardwareUiStateContainer/hardwareUiStateDialogLifecycle',
  () => ({
    hardwareUiStateDialogLifecycle: {},
  }),
);
jest.mock('../../../states/jotai/contexts/accountSelector/actions', () => ({
  useAccountSelectorActions: () => ({}),
}));
jest.mock('../../FirmwareUpdate/hooks/bootloaderModeDialogManager', () => ({
  bootloaderModeDialogManager: { close: jest.fn() },
}));
jest.mock(
  '../../Onboarding/pages/ConnectHardwareWallet/FirmwareVerifyDialog',
  () => ({ useFirmwareVerifyDialog: () => ({}) }),
);
jest.mock(
  '../../Onboarding/pages/ConnectHardwareWallet/SelectAddWalletTypeDialog',
  () => ({ useSelectAddWalletTypeDialog: () => ({}) }),
);
jest.mock(
  '../../Onboarding/pages/ConnectHardwareWallet/walletCreationMode',
  () => ({}),
);

async function advanceTime(ms: number) {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
}

async function startUpdateAttempt() {
  const props = {
    route: { params: { deviceData: { device: mockDevice } } },
    navigation: mockNavigation,
  } as unknown as ComponentProps<typeof CheckAndUpdate>;
  render(<CheckAndUpdate {...props} />);
  fireEvent.click(
    screen.getByTestId(OnboardingTestIDs.checkAndUpdateVerifyBtn),
  );
  await advanceTime(1500);
  expect(
    screen.getByTestId(OnboardingTestIDs.checkAndUpdateUpdateBtn),
  ).toBeTruthy();
  // Failed/cancelled attempts never emit FinishFirmwareUpdate.
  act(() => {
    mockEventHandlers.get('begin')?.();
  });
}

describe('CheckAndUpdate post-update bootloader recovery', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockEventHandlers.clear();
    mockGetFeatures.mockReset().mockResolvedValue({
      ...mockApplicationFeatures,
      bootloader_mode: true,
    });
    mockConnection.verifyHardware.mockResolvedValue({ verified: true });
    mockCheckRelease.mockReset().mockResolvedValue({
      hasUpgrade: true,
      features: mockApplicationFeatures,
    });
    mockPrepareUSBConnect.mockImplementation(
      async ({ device }: { device: SearchDevice }) => ({
        connectId: device.connectId,
      }),
    );
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('restores Update now after an interrupted/cancelled update without accepting bootloader as application firmware', async () => {
    await startUpdateAttempt();
    await advanceTime(10_000);
    expect(
      screen.queryByTestId(OnboardingTestIDs.checkAndUpdateUpdateBtn),
    ).toBeNull();
    await advanceTime(64_000);
    expect(mockRebind).toHaveBeenCalledTimes(11);
    expect(
      mockRebind.mock.calls
        .slice(0, 10)
        .every((call) => !call[2]?.allowBootloaderRecovery),
    ).toBe(true);
    expect(mockRebind.mock.calls[10][2]?.allowBootloaderRecovery).toBe(true);
    expect(
      screen.queryByTestId(OnboardingTestIDs.checkAndUpdateSkipUpdateBtn),
    ).toBeNull();
    expect(
      screen.queryByTestId(OnboardingTestIDs.checkAndUpdateContinueToSetupBtn),
    ).toBeNull();
    expect(mockCheckRelease).toHaveBeenCalledTimes(1);
    fireEvent.click(
      screen.getByTestId(OnboardingTestIDs.checkAndUpdateUpdateBtn),
    );
    await advanceTime(0);
    expect(mockPrepareUSBConnect).toHaveBeenCalledWith({
      device: mockReconnectedDevice,
      features: expect.objectContaining({ bootloader_mode: true }),
    });
    expect(mockOpenChangeLog).toHaveBeenCalledWith(
      expect.objectContaining({
        connectId: mockReconnectedDevice.connectId,
      }),
    );
  });

  it('allows Retry after connection failure to recover a still-bootloader device', async () => {
    await startUpdateAttempt();
    mockGetFeatures.mockRejectedValue(new Error('Disconnected'));
    await advanceTime(74_000);
    fireEvent.click(
      screen.getByTestId(OnboardingTestIDs.checkAndUpdateRetryBtn),
    );
    mockGetFeatures.mockResolvedValue({
      ...mockApplicationFeatures,
      bootloader_mode: true,
    });
    await advanceTime(64_000);
    expect(
      screen.getByTestId(OnboardingTestIDs.checkAndUpdateUpdateBtn),
    ).toBeTruthy();
    expect(mockRebind).toHaveBeenCalledTimes(22);
    expect(mockCheckRelease).toHaveBeenCalledTimes(1);
  });

  it('rechecks application firmware with hashes and completes normally after a second update', async () => {
    await startUpdateAttempt();
    await advanceTime(74_000);
    mockGetFeatures.mockResolvedValue(mockApplicationFeatures);
    mockCheckRelease.mockResolvedValue({
      hasUpgrade: false,
      features: mockApplicationFeatures,
    });
    act(() => {
      mockEventHandlers.get('begin')?.();
    });
    await advanceTime(10_000);
    expect(mockCheckRelease).toHaveBeenLastCalledWith(
      expect.objectContaining({
        connectId: mockReconnectedDevice.connectId,
        checkFirmwareHash: true,
      }),
    );
    expect(
      screen.getByTestId(OnboardingTestIDs.checkAndUpdateContinueToSetupBtn),
    ).toBeTruthy();
    expect(
      screen.queryByTestId(OnboardingTestIDs.checkAndUpdateUpdateBtn),
    ).toBeNull();
  });

  it('keeps connection failure as Error with Retry and does not offer recovery', async () => {
    await startUpdateAttempt();
    mockGetFeatures.mockRejectedValue(new Error('Disconnected'));
    await advanceTime(74_000);
    expect(
      screen.getByTestId(OnboardingTestIDs.checkAndUpdateRetryBtn),
    ).toBeTruthy();
    expect(
      screen.queryByTestId(OnboardingTestIDs.checkAndUpdateUpdateBtn),
    ).toBeNull();
    expect(mockCheckRelease).toHaveBeenCalledTimes(1);
  });

  it('does not expose recovery for a different device reporting bootloader mode', async () => {
    await startUpdateAttempt();
    mockGetFeatures.mockResolvedValue({
      bootloader_mode: true,
      device_id: 'other-device-id',
    });
    await advanceTime(74_000);
    expect(
      screen.getByTestId(OnboardingTestIDs.checkAndUpdateRetryBtn),
    ).toBeTruthy();
    expect(
      screen.queryByTestId(OnboardingTestIDs.checkAndUpdateUpdateBtn),
    ).toBeNull();
    expect(mockOpenChangeLog).not.toHaveBeenCalled();
  });
});

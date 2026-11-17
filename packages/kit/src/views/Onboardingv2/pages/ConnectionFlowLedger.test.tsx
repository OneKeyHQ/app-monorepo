/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { DeviceScannerUtils } from '@onekeyhq/shared/src/utils/DeviceScannerUtils';
import { EConnectDeviceChannel } from '@onekeyhq/shared/types/connectDevice';
import type { IThirdPartyHardwareSearchTarget } from '@onekeyhq/shared/types/device';
import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import { OnboardingTestIDs } from '../testIDs';

import LedgerConnectionFlow from './ConnectionFlowLedger';

import type { SearchDevice } from '@onekeyfe/hd-core';

const mockPlatform = platformEnv;
let mockFocused = true;
const mockPush = jest.fn();
const mockHidPermission = jest.fn();
const mockIntl = { formatMessage: ({ id }: { id: string }) => id };
const mockScanner = {
  startDeviceScan: jest.fn<
    void,
    Parameters<DeviceScannerUtils['startDeviceScan']>
  >(),
  stopScan: jest.fn(),
  stopScanAndWait: jest.fn<Promise<void>, []>(),
};

jest.mock('@react-navigation/core', () => ({
  useIsFocused: () => mockFocused,
}));
jest.mock('react-intl', () => ({ useIntl: () => mockIntl }));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isNative: false,
    isExtension: false,
    isSupportDesktopBle: true,
  },
}));
jest.mock('@onekeyhq/shared/src/utils/deviceUtils', () => ({
  __esModule: true,
  default: { getDeviceScanner: () => mockScanner },
}));
jest.mock('../../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('../../../hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({ push: mockPush }),
}));
jest.mock('../../../hooks/useThemeVariant', () => ({
  useThemeVariant: () => 'light',
}));
jest.mock('@onekeyhq/kit/src/hooks/usePromptWebDeviceAccess', () => ({
  usePromptWebDeviceAccess: () => ({
    promptHidDeviceAccess: mockHidPermission,
  }),
}));
jest.mock('@onekeyhq/shared/src/utils/avatarUtils', () => ({
  ThirdPartyWalletAvatarImages: { ledger: 'ledger' },
  getThirdPartyDeviceAvatarImage: () => 'ledger',
}));
jest.mock('../utils', () => ({
  getThirdPartySearchTarget: (candidate?: {
    raw?: { searchTarget?: IThirdPartyHardwareSearchTarget };
  }) => candidate?.raw?.searchTarget,
  sortDevicesData: <T,>(devices: T[]) => devices,
}));
jest.mock('../../../components/WalletAvatar', () => ({
  WalletAvatar: () => null,
}));
jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const Container = ({ children }: { children?: ReactNode }) =>
    React.createElement('div', null, children);
  return {
    Button: ({
      children,
      onPress,
      disabled,
      testID,
    }: {
      children?: ReactNode;
      onPress?: () => void;
      disabled?: boolean;
      testID?: string;
    }) =>
      React.createElement(
        'button',
        { onClick: onPress, disabled, 'data-testid': testID },
        children,
      ),
    SegmentControl: ({
      options,
      onChange,
      value,
    }: {
      options: { value: string; label: string; testID: string }[];
      onChange: (next: string) => void;
      value: string;
    }) =>
      React.createElement(
        'div',
        null,
        options.map((option) =>
          React.createElement(
            'button',
            {
              key: option.value,
              'data-testid': option.testID,
              'aria-pressed': value === option.value,
              onClick: () => onChange(option.value),
            },
            option.label,
          ),
        ),
      ),
    EVideoResizeMode: { COVER: 'cover' },
    HeightTransition: Container,
    LottieView: () => null,
    Video: () => null,
    SizableText: Container,
    Stack: Container,
    XStack: Container,
    YStack: Container,
    Toast: { error: jest.fn() },
  };
});
jest.mock('./ConnectionIndicator', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const Container = ({ children }: { children?: ReactNode }) =>
    React.createElement('div', null, children);
  return {
    ConnectionIndicator: Object.assign(Container, {
      Card: Container,
      Animation: Container,
      Content: Container,
      Title: Container,
      Footer: Container,
    }),
  };
});
jest.mock('../../../components/ListItem', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const Item = ({
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
    );
  return {
    ListItem: Object.assign(Item, {
      Text: ({ primary }: { primary?: string }) =>
        React.createElement('span', null, primary),
    }),
  };
});

function device(connectionType: 'usb' | 'ble'): SearchDevice {
  return {
    name: `Ledger ${connectionType}`,
    connectId: `test-${connectionType}`,
    deviceId: null,
    uuid: '',
    deviceType: 'unknown',
    commType: 'bridge',
    raw: {
      searchTarget: {
        searchTargetId: `test-${connectionType}`,
        vendor: EHardwareVendor.ledger,
        kind: 'physical',
        connectionType,
      },
    },
  } as SearchDevice;
}

describe('Ledger onboarding transport tabs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFocused = true;
    Object.assign(mockPlatform, {
      isNative: false,
      isExtension: false,
      isSupportDesktopBle: true,
    });
    mockScanner.stopScanAndWait.mockResolvedValue(undefined);
  });
  afterEach(cleanup);

  it('uses USB by default and starts BLE discovery without HID permission on the BLE tab', async () => {
    render(<LedgerConnectionFlow />);
    expect(
      screen
        .getByTestId(OnboardingTestIDs.connectionFlowLedgerUsbTab)
        .getAttribute('aria-pressed'),
    ).toBe('true');
    fireEvent.click(
      screen.getByTestId(OnboardingTestIDs.connectionFlowLedgerStartBtn),
    );
    await waitFor(() =>
      expect(mockScanner.startDeviceScan).toHaveBeenCalledTimes(1),
    );
    expect(mockScanner.startDeviceScan.mock.calls[0][6]).toMatchObject({
      transportType: 'usb',
      discoveryMethod: 'searchDeviceTargets',
    });
    fireEvent.click(
      screen.getByTestId(OnboardingTestIDs.connectionFlowLedgerBleTab),
    );
    await waitFor(() =>
      expect(mockScanner.startDeviceScan).toHaveBeenCalledTimes(2),
    );
    expect(mockScanner.startDeviceScan.mock.calls[1][6]).toMatchObject({
      transportType: 'ble',
      waitForAllTransports: true,
    });
    expect(mockHidPermission).not.toHaveBeenCalled();
    expect(
      screen
        .getByTestId(OnboardingTestIDs.connectionFlowLedgerBleTab)
        .getAttribute('aria-pressed'),
    ).toBe('true');
  });

  it('filters mixed results and hands the selected BLE target to wallet setup', async () => {
    render(<LedgerConnectionFlow />);
    fireEvent.click(
      screen.getByTestId(OnboardingTestIDs.connectionFlowLedgerBleTab),
    );
    await waitFor(() =>
      expect(mockScanner.startDeviceScan).toHaveBeenCalledTimes(1),
    );
    act(() =>
      mockScanner.startDeviceScan.mock.calls[0][0]({
        success: true,
        payload: [device('usb'), device('ble')],
      }),
    );
    expect(screen.queryByText('Ledger usb')).toBeNull();
    expect(screen.getByText('Ledger ble')).toBeTruthy();
    fireEvent.click(
      screen.getByTestId(OnboardingTestIDs.connectionFlowLedgerDeviceOption(0)),
    );
    await waitFor(() => expect(mockPush).toHaveBeenCalledTimes(1));
    expect(mockPush.mock.calls[0][1]).toMatchObject({
      tabValue: EConnectDeviceChannel.bluetooth,
      deviceData: {
        searchTarget: { searchTargetId: 'test-ble', connectionType: 'ble' },
      },
    });
  });

  it('drains the previous scan and ignores its late results while switching tabs', async () => {
    render(<LedgerConnectionFlow />);
    fireEvent.click(
      screen.getByTestId(OnboardingTestIDs.connectionFlowLedgerStartBtn),
    );
    await waitFor(() =>
      expect(mockScanner.startDeviceScan).toHaveBeenCalledTimes(1),
    );
    const oldCallback = mockScanner.startDeviceScan.mock.calls[0][0];
    let finishDrain: (() => void) | undefined;
    mockScanner.stopScanAndWait.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishDrain = resolve;
        }),
    );
    fireEvent.click(
      screen.getByTestId(OnboardingTestIDs.connectionFlowLedgerBleTab),
    );
    act(() => oldCallback({ success: true, payload: [device('usb')] }));
    expect(screen.queryByText('Ledger usb')).toBeNull();
    expect(mockScanner.startDeviceScan).toHaveBeenCalledTimes(1);
    await act(async () => {
      finishDrain?.();
    });
    await waitFor(() =>
      expect(mockScanner.startDeviceScan).toHaveBeenCalledTimes(2),
    );
  });

  it('does not restart a pending scan after leaving the page', async () => {
    let finishDrain: (() => void) | undefined;
    mockScanner.stopScanAndWait.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishDrain = resolve;
        }),
    );
    const view = render(<LedgerConnectionFlow />);
    fireEvent.click(
      screen.getByTestId(OnboardingTestIDs.connectionFlowLedgerBleTab),
    );
    mockFocused = false;
    view.rerender(<LedgerConnectionFlow />);
    await act(async () => {
      finishDrain?.();
    });
    expect(mockScanner.startDeviceScan).not.toHaveBeenCalled();
  });

  it('keeps native on BLE without exposing desktop tabs', async () => {
    Object.assign(mockPlatform, { isNative: true, isSupportDesktopBle: false });
    render(<LedgerConnectionFlow />);
    expect(
      screen.queryByTestId(OnboardingTestIDs.connectionFlowLedgerUsbTab),
    ).toBeNull();
    fireEvent.click(
      screen.getByTestId(OnboardingTestIDs.connectionFlowLedgerStartBtn),
    );
    await waitFor(() =>
      expect(mockScanner.startDeviceScan).toHaveBeenCalledTimes(1),
    );
    expect(mockScanner.startDeviceScan.mock.calls[0][6]).toMatchObject({
      transportType: 'ble',
    });
    expect(mockHidPermission).not.toHaveBeenCalled();
  });

  it('keeps the extension USB permission gate and does not expose BLE', async () => {
    Object.assign(mockPlatform, {
      isExtension: true,
      isSupportDesktopBle: false,
    });
    mockHidPermission.mockResolvedValue(null);
    render(<LedgerConnectionFlow />);
    expect(
      screen.queryByTestId(OnboardingTestIDs.connectionFlowLedgerBleTab),
    ).toBeNull();
    fireEvent.click(
      screen.getByTestId(OnboardingTestIDs.connectionFlowLedgerStartBtn),
    );
    await waitFor(() => expect(mockHidPermission).toHaveBeenCalledTimes(1));
    expect(mockScanner.startDeviceScan).not.toHaveBeenCalled();
  });
});

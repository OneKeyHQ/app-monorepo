/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { DeviceCard, getDeviceCardChip } from '.';

import { fireEvent, render } from '@testing-library/react';

import { DeviceManagementTestIDs } from '../../testIDs';

import type { IDeviceManagementListItem } from '.';

const mockIntl = { formatMessage: ({ id }: { id: string }) => id };
const mockUseMediaResult = { gtMd: true };
let mockVendorProfile = {
  isThirdParty: false,
  firmware: { showVersion: true, update: true },
};
let mockCanOpenDetails = true;

jest.mock('react-intl', () => ({
  useIntl: () => mockIntl,
}));

jest.mock('react-native-reanimated', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const View = ({ children }: { children?: ReactNode }) =>
    React.createElement('div', null, children);
  return {
    __esModule: true,
    default: { View },
    Easing: { out: () => undefined },
    useAnimatedStyle: () => ({}),
    useReducedMotion: () => false,
    useSharedValue: (value: number) => ({ value }),
    withTiming: (value: number) => value,
  };
});

jest.mock('@react-navigation/core', () => ({
  useNavigation: () => ({ setOptions: jest.fn() }),
}));

jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const Box = ({
    children,
    testID,
    onPress,
  }: {
    children?: ReactNode;
    testID?: string;
    onPress?: () => void;
  }) =>
    React.createElement(
      'div',
      { 'data-testid': testID, onClick: onPress },
      children,
    );
  const Text = ({ children }: { children?: ReactNode }) =>
    React.createElement('span', null, children);
  return {
    Icon: () => null,
    Page: Box,
    ScrollView: Box,
    SizableText: Text,
    Spinner: () => null,
    Stack: Box,
    XStack: Box,
    YStack: Box,
    useMedia: () => mockUseMediaResult,
    useTheme: () => ({ bgApp: { val: '' } }),
  };
});

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceAccount: {
      getDevice: jest.fn(async () => undefined),
      getAllHwQrWalletWithDevice: jest.fn(async () => ({})),
    },
  },
}));

jest.mock('@onekeyhq/kit/src/components/AccountSelector', () => ({
  AccountSelectorProviderMirror: ({ children }: { children?: ReactNode }) =>
    children ?? null,
}));

jest.mock('@onekeyhq/kit/src/hooks/useHardwareWalletConnectStatus', () => ({
  useHardwareWalletConnectStatus: () => ({ connectedDevices: new Set() }),
}));

jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: () => ({
    result: undefined,
    isLoading: false,
    run: jest.fn(),
  }),
}));

jest.mock(
  '@onekeyhq/kit/src/views/Onboarding/hooks/useToOnBoardingPage',
  () => ({
    useNavigateToPickYourDevicePage: () => jest.fn(),
  }),
);

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useFirmwareUpdatesDetectStatusPersistAtom: () => [{}],
}));

jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: {},
  appEventBus: { on: jest.fn(), off: jest.fn(), emit: jest.fn() },
}));

jest.mock('@onekeyhq/shared/src/hardware/config/vendorProfile', () => ({
  getVendorProfile: () => mockVendorProfile,
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => {
  const noopLogger: unknown = new Proxy(jest.fn(), {
    apply: () => undefined,
    get: () => noopLogger,
  });
  return { defaultLogger: noopLogger };
});

jest.mock('@onekeyhq/shared/src/utils/accountUtils', () => ({
  __esModule: true,
  default: {
    isQrWallet: () => false,
  },
}));

jest.mock('@onekeyhq/shared/src/utils/deviceUtils', () => ({
  __esModule: true,
  default: {
    buildDeviceBleName: () => 'OneKey Pro BLE',
    getFirmwareType: jest.fn(),
    getDeviceVersion: jest.fn(),
    getDeviceTypeFromFeatures: jest.fn(),
    getFirmwareTypeLabelByFirmwareType: jest.fn(),
  },
}));

jest.mock('@onekeyhq/shared/src/utils/hardwareDeviceColors', () => ({
  getHardwareDeviceColor: () => undefined,
}));

jest.mock('@onekeyhq/shared/src/utils/thirdPartyDeviceUtils', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('../../hooks/useDeviceManagerNavigation', () => ({
  useDeviceManagerNavigation: () => ({ pushToDeviceDetail: jest.fn() }),
}));

jest.mock('@onekeyhq/kit/src/hooks/useThemeVariant', () => ({
  useThemeVariant: () => 'light',
}));

jest.mock('../DeviceArt', () => ({
  DeviceArt: () => null,
}));

jest.mock('../DeviceCommonHeader', () => ({
  DeviceCommonHeader: () => null,
}));

jest.mock('../DeviceDetailsModal/utils', () => ({
  canOpenDeviceManagementDetails: () => mockCanOpenDetails,
}));

jest.mock('../DeviceGuideModal/DeviceGuideView', () => ({
  DeviceGuideView: () => null,
}));

jest.mock('./SectionHeader', () => ({
  __esModule: true,
  default: () => null,
}));

// verifiedAtVersion is set so the unverified-device diagnostic effect
// short-circuits and the test stays synchronous.
function makeItem(
  overrides: Partial<IDeviceManagementListItem> & {
    verifiedAtVersion?: string | null;
  } = {},
) {
  const { verifiedAtVersion = '4.10.0', ...rest } = overrides;
  return {
    wallet: { id: 'hw-1', name: 'OneKey Pro', avatarInfo: {} },
    device: {
      id: 'dev-1',
      deviceId: 'device-1',
      connectId: 'connect-1',
      verifiedAtVersion,
      featuresInfo: {},
    },
    isQrWallet: false,
    ...rest,
  } as unknown as IDeviceManagementListItem;
}

describe('getDeviceCardChip', () => {
  it('labels a QR wallet as QR, whatever else is set', () => {
    expect(
      getDeviceCardChip({
        item: makeItem({
          isQrWallet: true,
          shouldUpdate: true,
          verifiedAtVersion: null,
        }),
        isThirdParty: false,
      }),
    ).toBe('qr');
  });

  it('puts an unverified device ahead of an available update', () => {
    expect(
      getDeviceCardChip({
        item: makeItem({ shouldUpdate: true, verifiedAtVersion: null }),
        isThirdParty: false,
      }),
    ).toBe('unverified');
  });

  it('shows an available update on a verified device', () => {
    expect(
      getDeviceCardChip({
        item: makeItem({ shouldUpdate: true }),
        isThirdParty: false,
      }),
    ).toBe('update');
  });

  it('never marks a third-party device as unverified', () => {
    expect(
      getDeviceCardChip({
        item: makeItem({ verifiedAtVersion: null }),
        isThirdParty: true,
      }),
    ).toBeUndefined();
  });

  it('shows nothing when there is nothing to do', () => {
    expect(
      getDeviceCardChip({ item: makeItem(), isThirdParty: false }),
    ).toBeUndefined();
  });
});

describe('DeviceCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockVendorProfile = {
      isThirdParty: false,
      firmware: { showVersion: true, update: true },
    };
    mockCanOpenDetails = true;
  });

  it('shows the name, the Bluetooth name and the update label', () => {
    const view = render(
      <DeviceCard
        item={makeItem({ shouldUpdate: true })}
        onPress={jest.fn()}
        isConnected={false}
      />,
    );
    expect(view.getByText('OneKey Pro')).toBeTruthy();
    expect(view.getByText('OneKey Pro BLE')).toBeTruthy();
    expect(view.getByTestId('device-card-chip-update')).toBeTruthy();
  });

  it('marks the connection state on the picture area', () => {
    const connected = render(
      <DeviceCard item={makeItem()} onPress={jest.fn()} isConnected />,
    );
    expect(
      connected.getByTestId(DeviceManagementTestIDs.deviceStatusConnected),
    ).toBeTruthy();
    connected.unmount();

    const disconnected = render(
      <DeviceCard item={makeItem()} onPress={jest.fn()} isConnected={false} />,
    );
    expect(
      disconnected.getByTestId(
        DeviceManagementTestIDs.deviceStatusDisconnected,
      ),
    ).toBeTruthy();
  });

  it('opens the device when the card is pressed', () => {
    const onPress = jest.fn();
    const item = makeItem();
    const view = render(
      <DeviceCard item={item} onPress={onPress} isConnected={false} />,
    );
    fireEvent.click(view.getByTestId(DeviceManagementTestIDs.deviceListItem));
    expect(onPress).toHaveBeenCalledWith(item);
  });

  it('does nothing on press when the vendor has no details page', () => {
    mockCanOpenDetails = false;
    const onPress = jest.fn();
    const view = render(
      <DeviceCard item={makeItem()} onPress={onPress} isConnected={false} />,
    );
    fireEvent.click(view.getByTestId(DeviceManagementTestIDs.deviceListItem));
    expect(onPress).not.toHaveBeenCalled();
  });
});

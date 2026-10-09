/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { DeviceListItem } from '.';

import { render } from '@testing-library/react';

import type { IDeviceManagementListItem } from '.';

// One entry per ListItem render; used to compare render-prop identity across
// re-renders.
let capturedRenderItemTexts: unknown[] = [];
let capturedRenderAvatars: unknown[] = [];

// Identity-stable hook results: several of these values sit in the dependency
// arrays of the render-prop useCallbacks, so a fresh object per render would
// defeat the identity assertions below without exercising the memoization
// under test.
const mockIntl = { formatMessage: () => '' };
const mockUseMediaResult = { gtMd: false };
const mockVendorProfile = {
  isThirdParty: false,
  supportsFirmwareVersionDisplay: true,
  supportsFirmwareUpdate: true,
};

jest.mock('react-intl', () => ({
  useIntl: () => mockIntl,
}));

jest.mock('@react-navigation/core', () => ({
  useNavigation: () => ({ setOptions: jest.fn() }),
}));

jest.mock('@onekeyhq/components', () => {
  const Passthrough = ({ children }: { children?: ReactNode }) =>
    children ?? null;
  return {
    Badge: Passthrough,
    Divider: () => null,
    Icon: () => null,
    ListView: () => null,
    Page: Passthrough,
    SizableText: () => null,
    Spinner: () => null,
    Stack: Passthrough,
    XStack: Passthrough,
    YStack: Passthrough,
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

jest.mock('@onekeyhq/kit/src/components/ListItem', () => {
  const ListItemMock = ({
    renderItemText,
    renderAvatar,
  }: {
    renderItemText?: unknown;
    renderAvatar?: unknown;
  }) => {
    capturedRenderItemTexts.push(renderItemText);
    capturedRenderAvatars.push(renderAvatar);
    return null;
  };
  ListItemMock.Text = () => null;
  return { ListItem: ListItemMock };
});

jest.mock('@onekeyhq/kit/src/components/WalletAvatar', () => ({
  WalletAvatar: () => null,
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

jest.mock('@onekeyhq/shared/src/hardware/vendorProfile', () => ({
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
    getFirmwareTypeLabelByFirmwareType: jest.fn(),
  },
}));

jest.mock('@onekeyhq/shared/src/utils/thirdPartyDeviceUtils', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('../../hooks/useDeviceManagerNavigation', () => ({
  useDeviceManagerNavigation: () => ({ pushToDeviceDetail: jest.fn() }),
}));

jest.mock('../DeviceCommonHeader', () => ({
  DeviceCommonHeader: () => null,
}));

jest.mock('../DeviceDetailsModal/utils', () => ({
  canOpenDeviceManagementDetails: () => true,
}));

jest.mock('../DeviceGuideModal/DeviceGuideView', () => ({
  DeviceGuideView: () => null,
}));

jest.mock('./SectionHeader', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('./VerifiedBadge', () => ({
  VerifiedBadge: () => null,
}));

// verifiedAtVersion is set so the unverified-device diagnostic effect
// short-circuits and the test stays synchronous.
const deviceItem = {
  wallet: { id: 'hw-1', name: 'OneKey Pro', avatarInfo: {} },
  device: {
    id: 'dev-1',
    deviceId: 'device-1',
    connectId: 'connect-1',
    verifiedAtVersion: '4.10.0',
    featuresInfo: {},
  },
  isQrWallet: false,
} as unknown as IDeviceManagementListItem;

const onPress = jest.fn();

describe('DeviceListItem render prop stability', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    capturedRenderItemTexts = [];
    capturedRenderAvatars = [];
  });

  it('keeps renderItemText and renderAvatar identities stable when re-rendered with the same inputs', () => {
    // ListItem renders these props as component types (`<Render {...props} />`),
    // so a new function identity per render means React unmounts and remounts
    // the whole subtree instead of updating it in place. Reverting the
    // useCallbacks to inline arrows would fail this test.
    const view = render(
      <DeviceListItem
        item={deviceItem}
        onPress={onPress}
        isConnected={false}
      />,
    );
    view.rerender(
      <DeviceListItem
        item={deviceItem}
        onPress={onPress}
        isConnected={false}
      />,
    );

    expect(capturedRenderItemTexts.length).toBeGreaterThanOrEqual(2);
    expect(typeof capturedRenderItemTexts[0]).toBe('function');
    expect(capturedRenderItemTexts[1]).toBe(capturedRenderItemTexts[0]);
    expect(typeof capturedRenderAvatars[0]).toBe('function');
    expect(capturedRenderAvatars[1]).toBe(capturedRenderAvatars[0]);
  });

  it('keeps the renderItemText identity stable when the unrelated isConnected prop changes', () => {
    // Connection status only feeds the avatar; the text render prop must keep
    // its identity across that re-render or the text subtree remounts.
    const view = render(
      <DeviceListItem
        item={deviceItem}
        onPress={onPress}
        isConnected={false}
      />,
    );
    view.rerender(
      <DeviceListItem item={deviceItem} onPress={onPress} isConnected />,
    );

    expect(capturedRenderItemTexts.length).toBeGreaterThanOrEqual(2);
    expect(capturedRenderItemTexts[1]).toBe(capturedRenderItemTexts[0]);
  });
});

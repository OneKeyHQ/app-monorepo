/** @jest-environment jsdom */

import type { PropsWithChildren } from 'react';

import { EDeviceType } from '@onekeyfe/hd-shared';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';

import type { IPrimeCloudSyncPersistAtomData } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import PagePrimeCloudSync from './PagePrimeCloudSync';

let mockSettings: IPrimeCloudSyncPersistAtomData;
let mockHardwareSupported: boolean;
let mockHardwareEndpointMismatch: boolean;
const mockHardwareSyncNow = jest.fn(async () => undefined);
let mockKeylessExists: boolean;
let mockKeylessWalletEnabled: boolean;
const mockNavigate = jest.fn();
const mockPendingKeyless = jest.fn(async (_enabled: boolean) => undefined);
const mockLegacyToggle = jest.fn<Promise<boolean>, [{ enabled: boolean }]>();
const mockOffTelemetry = jest.fn<void, [{ status: string }]>();
const mockKeylessToggle = jest.fn<Promise<void>, [{ enabled: boolean }]>();
const mockPickHardware = jest.fn(async () => undefined);
const mockChoose = jest.fn(
  async (): Promise<'keyless' | 'hardware'> => 'keyless',
);
const mockSyncNow = jest.fn(
  async (_params: unknown): Promise<string> => 'local-deferred',
);
const mockToast = jest.fn();
const mockHideLoading = jest.fn(async () => undefined);
const mockMigrateKeyless = jest.fn(async () => undefined);

jest.mock('@react-navigation/core', () => ({ useFocusEffect: jest.fn() }));
jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('react-native', () => ({
  Platform: { OS: 'web', select: jest.fn() },
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isDev: false, isNative: false },
}));
jest.mock('@onekeyhq/components', () => {
  const Box = ({ children }: PropsWithChildren) => <div>{children}</div>;
  return {
    Page: Object.assign(Box, { Header: () => null, Body: Box }),
    Stack: Box,
    SizableText: Box,
    Icon: () => null,
    Divider: () => null,
    Button: Box,
    ActionList: Box,
    Dialog: { show: jest.fn() },
    ESwitchSize: { small: 'small' },
    Alert: ({
      action,
      description,
      testID,
      title,
    }: {
      action?: { primary?: string; onPrimaryPress?: () => Promise<void> };
      description?: string;
      testID?: string;
      title?: string;
    }) => (
      <div data-testid={testID}>
        {title ? <div>{title}</div> : null}
        {description}
        {action ? (
          <button type="button" onClick={action.onPrimaryPress}>
            {action.primary}
          </button>
        ) : null}
      </div>
    ),
    useMedia: () => ({}),
    Switch: ({
      testID,
      value,
      onChange,
    }: {
      testID: string;
      value: boolean;
      onChange: (value: boolean) => Promise<void>;
    }) => (
      <button
        type="button"
        data-testid={testID}
        onClick={() => void onChange(!value)}
      >
        {value ? 'on' : 'off'}
      </button>
    ),
  };
});
jest.mock('@onekeyhq/kit/src/components/ListItem', () => ({
  ListItem: ({
    children,
    title,
    onPress,
    disabled,
  }: PropsWithChildren<{
    title?: string;
    onPress?: () => void;
    disabled?: boolean;
  }>) =>
    onPress ? (
      <button type="button" onClick={onPress} disabled={disabled}>
        {title}
        {children}
      </button>
    ) : (
      <div>{children}</div>
    ),
}));
jest.mock('@onekeyhq/kit/src/components/WalletAvatar/WalletAvatar', () => ({
  WalletAvatar: () => null,
}));
jest.mock('@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth', () => ({
  useOneKeyAuth: () => ({ loginOneKeyId: jest.fn() }),
}));
jest.mock(
  '@onekeyhq/kit/src/components/KeylessWallet/useKeylessWallet',
  () => ({
    useKeylessWalletFeatureIsEnabled: () => mockKeylessWalletEnabled,
  }),
);
jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: () => ({
    result: { exists: mockKeylessExists },
    isLoading: false,
  }),
}));
jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({ navigate: mockNavigate }),
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useDevSettingsPersistAtom: () => [{ enabled: false }],
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms/prime', () => ({
  usePrimeCloudSyncPersistAtom: () => [mockSettings],
}));
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    prime: {
      usage: {
        onekeyCloudToggle: (event: { status: string }) =>
          mockOffTelemetry(event),
      },
    },
  },
}));
jest.mock('./HardwareCloudSyncKeySection', () => ({
  chooseCloudSyncKey: () => mockChoose(),
  useHardwareCloudSyncKey: () => ({
    supported: mockHardwareSupported,
    source: mockSettings.hardwareCloudSyncKeySource,
    pending: false,
    endpointMismatch: mockHardwareEndpointMismatch,
    openPicker: mockPickHardware,
    syncNow: mockHardwareSyncNow,
  }),
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    servicePrime: { apiFetchPrimeUserInfo: jest.fn() },
    servicePassword: {
      promptPasswordVerify: jest.fn(async () => ({ password: 'fixture' })),
    },
    serviceApp: {
      showDialogLoading: jest.fn(async () => undefined),
      hideDialogLoading: () => mockHideLoading(),
      showToast: (feedback: unknown) => {
        mockToast(feedback);
      },
    },
    servicePrimeCloudSync: {
      syncNowKeylessWithResult: (params: unknown) => mockSyncNow(params),
      toggleCloudSync: (params: { enabled: boolean }) =>
        mockLegacyToggle(params),
      showAlertDialogIfLocalPasswordNotSet: jest.fn(async () => undefined),
      backfillOneKeyIdSyncHistoryIfNeeded: jest.fn(),
    },
    serviceKeylessCloudSync: {
      toggleCloudSyncKeyless: (params: { enabled: boolean }) =>
        mockKeylessToggle(params),
      setPendingAutoEnableCloudSyncKeyless: (enabled: boolean) =>
        mockPendingKeyless(enabled),
      enableKeylessCloudSyncWithMigrationIfNeeded: () => mockMigrateKeyless(),
    },
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockHardwareSupported = false;
  mockHardwareEndpointMismatch = false;
  mockKeylessExists = true;
  mockKeylessWalletEnabled = true;
  mockSettings = {
    isCloudSyncEnabled: false,
    isCloudSyncEnabledKeyless: false,
    hasEverEnabledOneKeyIdSync: true,
  };
});

it('hides individual account issues during hardware sync and keeps update guidance', () => {
  mockHardwareSupported = true;
  mockKeylessWalletEnabled = false;
  mockSettings.isCloudSyncEnabledKeyless = true;
  mockSettings.hardwareCloudSyncKeySource = {
    type: 'hardware',
    credentialId: 'hardware-synthetic',
    derivationVersion: 1,
    deviceName: 'Synthetic device',
    deviceType: EDeviceType.Pro,
  };
  mockSettings.publicAccountSnapshotStatus = {
    needsUpdate: 0,
    pending: 0,
    conflicts: 2,
    rejected: 1,
    added: 0,
    unchanged: 0,
  };
  const view = render(<PagePrimeCloudSync />);
  expect(screen.queryByText(ETranslations.global_sync_error)).toBeNull();
  mockSettings.publicAccountSnapshotStatus.needsUpdate = 1;
  view.rerender(<PagePrimeCloudSync />);
  expect(screen.getByText(ETranslations.update_update_required)).toBeTruthy();
});

it('offers the chooser to a former ID user when both key types are supported', async () => {
  mockHardwareSupported = true;
  mockKeylessExists = false;
  mockChoose.mockResolvedValueOnce('hardware');
  render(<PagePrimeCloudSync />);
  expect(
    screen.getByRole('button', { name: ETranslations.switch_now__action }),
  ).toBeTruthy();
  fireEvent.click(screen.getByTestId('prime-switch'));
  await waitFor(() => expect(mockPickHardware).toHaveBeenCalledTimes(1));
  expect(mockChoose).toHaveBeenCalledTimes(1);
  expect(mockLegacyToggle).not.toHaveBeenCalled();
  expect(mockKeylessToggle).not.toHaveBeenCalled();
});

it('uses the hardware picker directly for a former ID user on a hardware-only platform', async () => {
  mockHardwareSupported = true;
  mockKeylessWalletEnabled = false;
  render(<PagePrimeCloudSync />);
  expect(
    screen.queryByRole('button', { name: ETranslations.switch_now__action }),
  ).toBeNull();
  await act(async () => fireEvent.click(screen.getByTestId('prime-switch')));
  expect(mockPickHardware).toHaveBeenCalledTimes(1);
  expect(mockChoose).not.toHaveBeenCalled();
  expect(mockNavigate).not.toHaveBeenCalled();
  expect(mockPendingKeyless).not.toHaveBeenCalled();
  expect(mockMigrateKeyless).not.toHaveBeenCalled();
  expect(mockKeylessToggle).not.toHaveBeenCalled();
  expect(mockLegacyToggle).not.toHaveBeenCalled();
});

it.each(['former ID', 'former Keyless', 'first-time'] as const)(
  'offers no unsupported activation for a %s user with neither capability',
  async (scenario) => {
    mockKeylessWalletEnabled = false;
    mockSettings.hasEverEnabledOneKeyIdSync = scenario === 'former ID';
    mockSettings.hasEverEnabledKeylessSync = scenario === 'former Keyless';
    render(<PagePrimeCloudSync />);
    expect(screen.queryByRole('button', { name: 'off' })).toBeNull();
    expect(
      screen.queryByRole('button', { name: ETranslations.switch_now__action }),
    ).toBeNull();
    expect(screen.queryByTestId('prime-btn')).toBeNull();
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(mockPendingKeyless).not.toHaveBeenCalled();
  },
);

it('lets a former Keyless user recover through hardware without a restore-Keyless CTA', async () => {
  mockHardwareSupported = true;
  mockKeylessWalletEnabled = false;
  mockSettings.hasEverEnabledKeylessSync = true;
  render(<PagePrimeCloudSync />);
  expect(
    screen.queryByRole('button', {
      name: ETranslations.restore_keyless_wallet__action,
    }),
  ).toBeNull();
  await act(async () =>
    fireEvent.click(screen.getByRole('button', { name: 'off' })),
  );
  expect(mockPickHardware).toHaveBeenCalledTimes(1);
  expect(mockChoose).not.toHaveBeenCalled();
  expect(mockPendingKeyless).not.toHaveBeenCalled();
});

it('shows original-node guidance while leaving hardware sync Off available', async () => {
  mockHardwareEndpointMismatch = true;
  mockHardwareSupported = true;
  mockKeylessWalletEnabled = false;
  mockSettings.isCloudSyncEnabledKeyless = true;
  mockSettings.hardwareCloudSyncKeySource = {
    type: 'hardware',
    credentialId: 'hardware-synthetic',
    derivationVersion: 1,
    deviceName: 'Synthetic device',
    deviceType: EDeviceType.Pro,
  };
  const view = render(<PagePrimeCloudSync />);
  expect(
    screen.getByTestId('cloud-hardware-key-endpoint-mismatch').textContent,
  ).toContain('switch back to the previous API node');
  const sync = screen.getByRole('button', {
    name: ETranslations.sync_now__action,
  });
  expect(sync.hasAttribute('disabled')).toBe(true);
  await act(async () => fireEvent.click(sync));
  expect(mockHardwareSyncNow).not.toHaveBeenCalled();
  expect(mockPickHardware).not.toHaveBeenCalled();
  await act(async () => fireEvent.click(screen.getByTestId('prime-switch')));
  expect(mockKeylessToggle).toHaveBeenCalledWith({ enabled: false });

  mockHardwareEndpointMismatch = false;
  view.rerender(<PagePrimeCloudSync />);
  expect(
    screen.queryByTestId('cloud-hardware-key-endpoint-mismatch'),
  ).toBeNull();
  expect(sync.hasAttribute('disabled')).toBe(false);
  await act(async () => fireEvent.click(sync));
  expect(mockHardwareSyncNow).toHaveBeenCalledTimes(1);
});

it('keeps active Keyless sync off available without a supported Keyless recovery', async () => {
  mockKeylessWalletEnabled = false;
  mockSettings.isCloudSyncEnabledKeyless = true;
  render(<PagePrimeCloudSync />);
  expect(
    screen.queryByRole('button', {
      name: ETranslations.restore_keyless_wallet__action,
    }),
  ).toBeNull();
  await act(async () => fireEvent.click(screen.getByTestId('prime-switch')));
  expect(mockKeylessToggle).toHaveBeenCalledWith({ enabled: false });
  expect(mockPendingKeyless).not.toHaveBeenCalled();
  expect(mockNavigate).not.toHaveBeenCalled();
});

it.each(['local-deferred', 'sync-disabled', 'network-unavailable'])(
  'uses this software Sync Now request outcome without showing generic pending (%s)',
  async (outcome) => {
    mockSettings.isCloudSyncEnabledKeyless = true;
    mockSyncNow.mockResolvedValueOnce(outcome);
    const wait = jest.spyOn(timerUtils, 'wait').mockResolvedValue(undefined);
    try {
      render(<PagePrimeCloudSync />);
      await act(async () =>
        fireEvent.click(
          screen.getByRole('button', {
            name: ETranslations.sync_now__action,
          }),
        ),
      );
      expect(mockSyncNow).toHaveBeenCalledWith(
        expect.objectContaining({
          password: 'fixture',
          forceSync: true,
        }),
      );
      expect(mockHideLoading).toHaveBeenCalledTimes(1);
      if (outcome === 'network-unavailable')
        expect(mockToast).toHaveBeenCalledWith({
          method: 'error',
          title: 'global.network_error',
        });
      else expect(mockToast).not.toHaveBeenCalled();
    } finally {
      wait.mockRestore();
    }
  },
);

it('keeps supported Keyless enable and explicit migration available for a former ID user', async () => {
  render(<PagePrimeCloudSync />);
  fireEvent.click(screen.getByTestId('prime-switch'));
  await waitFor(() =>
    expect(mockKeylessToggle).toHaveBeenCalledWith({ enabled: true }),
  );
  fireEvent.click(
    screen.getByRole('button', { name: ETranslations.switch_now__action }),
  );
  await waitFor(() => expect(mockMigrateKeyless).toHaveBeenCalledTimes(1));
  expect(mockChoose).not.toHaveBeenCalled();
  expect(mockLegacyToggle).not.toHaveBeenCalled();
});

it.each([true, false])(
  'only reports successful legacy disable when the service confirms it (%s)',
  async (disabled) => {
    mockSettings.isCloudSyncEnabled = true;
    mockHardwareSupported = true;
    mockKeylessWalletEnabled = false;
    mockLegacyToggle.mockResolvedValueOnce(disabled);
    render(<PagePrimeCloudSync />);
    expect(
      screen.queryByRole('button', { name: ETranslations.switch_now__action }),
    ).toBeNull();
    await act(async () => fireEvent.click(screen.getByTestId('prime-switch')));
    expect(mockLegacyToggle).toHaveBeenCalledWith({ enabled: false });
    if (disabled) {
      expect(mockOffTelemetry).toHaveBeenCalledWith({ status: 'off' });
    } else {
      expect(mockOffTelemetry).not.toHaveBeenCalled();
    }
    expect(mockKeylessToggle).not.toHaveBeenCalled();
    expect(mockPickHardware).not.toHaveBeenCalled();
  },
);

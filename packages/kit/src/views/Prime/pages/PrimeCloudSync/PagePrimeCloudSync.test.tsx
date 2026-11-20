/** @jest-environment jsdom */

import type { PropsWithChildren } from 'react';

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';

import type { IPrimeCloudSyncPersistAtomData } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import PagePrimeCloudSync from './PagePrimeCloudSync';

let mockSettings: IPrimeCloudSyncPersistAtomData;
let mockHardwareSupported: boolean;
let mockKeylessExists: boolean;
const mockLegacyToggle = jest.fn<Promise<boolean>, [{ enabled: boolean }]>();
const mockOffTelemetry = jest.fn<void, [{ status: string }]>();
const mockKeylessToggle = jest.fn<Promise<void>, [{ enabled: boolean }]>();
const mockPickHardware = jest.fn(async () => undefined);
const mockChoose = jest.fn(
  async (): Promise<'keyless' | 'hardware'> => 'keyless',
);
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
    }: {
      action?: { primary?: string; onPrimaryPress?: () => Promise<void> };
    }) =>
      action ? (
        <button type="button" onClick={action.onPrimaryPress}>
          {action.primary}
        </button>
      ) : null,
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
  ListItem: ({ children }: PropsWithChildren) => <div>{children}</div>,
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
    useKeylessWalletFeatureIsEnabled: () => true,
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
  default: () => ({ navigate: jest.fn() }),
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
    pending: false,
    openPicker: mockPickHardware,
  }),
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    servicePrime: { apiFetchPrimeUserInfo: jest.fn() },
    servicePassword: { promptPasswordVerify: jest.fn(async () => undefined) },
    servicePrimeCloudSync: {
      toggleCloudSync: (params: { enabled: boolean }) =>
        mockLegacyToggle(params),
      showAlertDialogIfLocalPasswordNotSet: jest.fn(async () => undefined),
      backfillOneKeyIdSyncHistoryIfNeeded: jest.fn(),
    },
    serviceKeylessCloudSync: {
      toggleCloudSyncKeyless: (params: { enabled: boolean }) =>
        mockKeylessToggle(params),
      setPendingAutoEnableCloudSyncKeyless: jest.fn(async () => undefined),
      enableKeylessCloudSyncWithMigrationIfNeeded: () => mockMigrateKeyless(),
    },
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockHardwareSupported = false;
  mockKeylessExists = true;
  mockSettings = {
    isCloudSyncEnabled: false,
    isCloudSyncEnabledKeyless: false,
    hasEverEnabledOneKeyIdSync: true,
  };
});

it('shows former ID users the supported hardware chooser rather than legacy reactivation', async () => {
  mockHardwareSupported = true;
  mockKeylessExists = false;
  mockChoose.mockResolvedValueOnce('hardware');
  render(<PagePrimeCloudSync />);
  expect(
    screen.getByRole('button', { name: ETranslations.switch_now__action }),
  ).toBeTruthy();
  fireEvent.click(screen.getByTestId('prime-switch'));
  await waitFor(() => expect(mockPickHardware).toHaveBeenCalledTimes(1));
  expect(mockLegacyToggle).not.toHaveBeenCalled();
  expect(mockKeylessToggle).not.toHaveBeenCalled();
});

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
  expect(mockLegacyToggle).not.toHaveBeenCalled();
});

it.each([true, false])(
  'only reports successful legacy disable when the service confirms it (%s)',
  async (disabled) => {
    mockSettings.isCloudSyncEnabled = true;
    mockLegacyToggle.mockResolvedValueOnce(disabled);
    render(<PagePrimeCloudSync />);
    await act(async () => fireEvent.click(screen.getByTestId('prime-switch')));
    expect(mockLegacyToggle).toHaveBeenCalledWith({ enabled: false });
    if (disabled) {
      expect(mockOffTelemetry).toHaveBeenCalledWith({ status: 'off' });
    } else {
      expect(mockOffTelemetry).not.toHaveBeenCalled();
    }
    expect(mockKeylessToggle).not.toHaveBeenCalled();
  },
);

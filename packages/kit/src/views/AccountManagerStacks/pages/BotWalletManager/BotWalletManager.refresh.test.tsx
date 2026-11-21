/** @jest-environment jsdom */

import type { PropsWithChildren, ReactNode } from 'react';

import { act, fireEvent, render, screen } from '@testing-library/react';

import { AccountManagerTestIDs } from '@onekeyhq/kit/src/views/AccountManagerStacks/testIDs';
import type { IManualCloudSyncResult } from '@onekeyhq/kit-bg/src/services/ServicePrimeCloudSync/ServicePrimeCloudSync';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import BotWalletManager from './BotWalletManager';

const mockParentId = 'keyless-test-parent';
const mockReadWallets = jest.fn(async (_params: unknown) => []);
const mockSync = jest.fn<Promise<IManualCloudSyncResult>, [unknown]>();
const mockLegacySync = jest.fn(async () => true);
const mockShowLoading = jest.fn(async () => undefined);
const mockHideLoading = jest.fn(async () => undefined);
const mockToast = jest.fn<void, [unknown]>();
const mockEmit = jest.fn<void, [unknown, unknown]>();

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/components', () => {
  const Box = ({ children }: PropsWithChildren) => <div>{children}</div>;
  return {
    Button: Box,
    Empty: () => null,
    IconButton: ({
      loading,
      onPress,
      testID,
    }: {
      loading: boolean;
      onPress: () => void;
      testID: string;
    }) => (
      <button
        type="button"
        data-testid={testID}
        disabled={loading}
        onClick={onPress}
      >
        Refresh
      </button>
    ),
    Page: Object.assign(Box, {
      Header: ({ headerRight }: { headerRight: () => ReactNode }) =>
        headerRight(),
      Body: Box,
      Footer: Box,
    }),
    SectionList: () => null,
    Spinner: () => null,
    Stack: Box,
  };
});
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceAccount: {
      getBotWallets: (params: unknown) => mockReadWallets(params),
    },
    serviceApp: {
      showDialogLoading: () => mockShowLoading(),
      hideDialogLoading: () => mockHideLoading(),
      showToast: (params: unknown) => mockToast(params),
    },
    servicePassword: { hasCachedPassword: async () => true },
    servicePrimeCloudSync: {
      syncNowKeyless: () => mockLegacySync(),
      syncNowKeylessWithResult: (params: unknown) => mockSync(params),
    },
  },
}));
jest.mock('@onekeyhq/kit/src/components/AccountSelector', () => ({
  AccountSelectorProviderMirror: ({ children }: PropsWithChildren) => children,
}));
jest.mock('@onekeyhq/kit/src/components/RenameDialog', () => ({}));
jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => jest.fn());
jest.mock('@onekeyhq/kit/src/hooks/useAppRoute', () => ({
  useAppRoute: () => ({ params: { parentKeylessWalletId: mockParentId } }),
}));
jest.mock(
  '@onekeyhq/kit/src/states/jotai/contexts/accountSelector/actions',
  () => ({ useAccountSelectorActions: jest.fn() }),
);
jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: { WalletUpdate: 'WalletUpdate' },
  appEventBus: {
    emit: (name: unknown, value: unknown) => mockEmit(name, value),
    on: jest.fn(),
    off: jest.fn(),
  },
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('./useExportBotWalletToCli', () => ({
  useExportBotWalletToCli: jest.fn(),
}));

async function startRefresh() {
  await act(async () => {
    render(<BotWalletManager />);
  });
  const refresh = screen.getByTestId(AccountManagerTestIDs.botWalletRefreshBtn);
  await act(async () => {
    fireEvent.click(refresh);
  });
  expect(mockSync).toHaveBeenCalledWith({
    callerName: 'Bot Wallet Manager Refresh',
    noDebounceUpload: true,
    forceSync: true,
  });
  expect(mockLegacySync).not.toHaveBeenCalled();
  expect(mockShowLoading).toHaveBeenCalledTimes(1);
  expect(mockHideLoading).toHaveBeenCalledTimes(1);
  expect(refresh).not.toHaveProperty('disabled', true);
}

beforeEach(() => {
  jest.clearAllMocks();
});

it('reloads the same parent and reports success only for a completed run', async () => {
  mockSync.mockResolvedValueOnce('completed');
  await startRefresh();
  expect(mockReadWallets.mock.calls).toEqual([
    [{ parentKeylessWalletId: mockParentId }],
    [{ parentKeylessWalletId: mockParentId }],
  ]);
  expect(mockEmit).toHaveBeenCalledWith('WalletUpdate', undefined);
  expect(mockToast).toHaveBeenCalledTimes(1);
  expect(mockToast).toHaveBeenCalledWith({
    method: 'success',
    title: ETranslations.global_sync_successfully,
  });
});

it.each(['local-deferred', 'incomplete'] as const)(
  'keeps %s quiet while rereading the local list for applied siblings',
  async (outcome) => {
    mockSync.mockResolvedValueOnce(outcome);
    await startRefresh();
    expect(mockReadWallets).toHaveBeenCalledTimes(2);
    expect(mockEmit).not.toHaveBeenCalled();
    expect(mockToast).not.toHaveBeenCalled();
  },
);

it('shows the existing turn-on guidance only when the current Keyless setting is Off', async () => {
  mockSync.mockResolvedValueOnce('sync-disabled');
  await startRefresh();
  expect(mockReadWallets).toHaveBeenCalledTimes(1);
  expect(mockEmit).not.toHaveBeenCalled();
  expect(mockToast).toHaveBeenCalledTimes(1);
  expect(mockToast).toHaveBeenCalledWith({
    method: 'error',
    title: '请先开启 Keyless 云同步',
  });
});

it('does not reread or show feedback for a cancelled run', async () => {
  mockSync.mockResolvedValueOnce('cancelled');
  await startRefresh();
  expect(mockReadWallets).toHaveBeenCalledTimes(1);
  expect(mockEmit).not.toHaveBeenCalled();
  expect(mockToast).not.toHaveBeenCalled();
});

it.each([
  ['software-key-unavailable', ETranslations.cloud_sync_data_unreadable__msg],
  ['network-unavailable', ETranslations.global_network_error],
  ['session-unavailable', ETranslations.syncing_paused__title],
] as const)('shows existing actionable copy for %s', async (outcome, title) => {
  mockSync.mockResolvedValueOnce(outcome);
  await startRefresh();
  expect(mockReadWallets).toHaveBeenCalledTimes(1);
  expect(mockEmit).not.toHaveBeenCalled();
  expect(mockToast).toHaveBeenCalledTimes(1);
  expect(mockToast).toHaveBeenCalledWith({ method: 'error', title });
});

it('keeps header refresh disabled while waiting and closes loading after the result', async () => {
  let finish: ((result: IManualCloudSyncResult) => void) | undefined;
  mockSync.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  await act(async () => {
    render(<BotWalletManager />);
  });
  const refresh = screen.getByTestId(AccountManagerTestIDs.botWalletRefreshBtn);
  await act(async () => {
    fireEvent.click(refresh);
  });
  expect(refresh).toHaveProperty('disabled', true);
  fireEvent.click(refresh);
  expect(mockSync).toHaveBeenCalledTimes(1);
  expect(mockHideLoading).not.toHaveBeenCalled();

  await act(async () => {
    finish?.('local-deferred');
  });
  expect(refresh).toHaveProperty('disabled', false);
  expect(mockHideLoading).toHaveBeenCalledTimes(1);
  expect(mockToast).not.toHaveBeenCalled();
});

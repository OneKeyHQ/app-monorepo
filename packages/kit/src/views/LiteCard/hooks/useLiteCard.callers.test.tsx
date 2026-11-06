/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { act, render, renderHook, waitFor } from '@testing-library/react';
import { createIntl } from 'react-intl';

import type { IDialogShowProps } from '@onekeyhq/components';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import type { ILiteCardParamList } from '@onekeyhq/shared/src/routes';

import { WalletBackupActions } from '../../../components/WalletBackup/WalletBackupActions';
import { showWalletBackupDialog } from '../../../components/WalletBackup/WalletBackupDialog';
import { useBackUpWallet } from '../../../hooks/useBackUpWallet';
import { HdWalletBackupButton } from '../../AccountManagerStacks/components/WalletEdit/HdWalletBackupButton';
import SelectWalletPage from '../pages/SelectWallet';

type ISelection = ILiteCardParamList['LiteCardSelectWallet'];
type IItem = { label: string; onPress?: () => void; onClose?: () => void };
const mockWallet: IDBWallet = {
  id: 'hd-1',
  name: 'Fixture',
  type: 'hd',
  backuped: false,
  accounts: [],
  nextIds: {},
  walletNo: 1,
};
const mockCard = {
  serialNum: 'fixture-card',
  isNewCard: true,
  hasBackup: false,
  pinRetryCount: 10,
};
const mockNativeSuccess = { error: null, data: true, cardInfo: mockCard };
const mockWrite = jest.fn<Promise<typeof mockNativeSuccess>, unknown[]>();
const mockRead = jest.fn(async () => mockNativeSuccess);
const mockPIN = jest.fn<Promise<string>, unknown[]>();
const mockPromptPassword = jest.fn(async () => ({
  password: 'fixture-password',
}));
const mockGetCredential = jest.fn(async () => ({
  mnemonic: 'fixture-mnemonic',
}));
const mockUpdateBackup = jest.fn(async () => undefined);
const mockResult = jest.fn<void, [{ isSuccess: boolean }]>();
const mockLegacyBackup = jest.fn<void, [string]>();
const mockSuccessDialog = jest.fn<void, []>();
const mockParentClose = jest.fn<Promise<void>, []>();
let mockSelection: ISelection | undefined;
const mockPushModal = jest.fn(
  (_route: unknown, config: { params: ISelection }) => {
    mockSelection = config.params;
  },
);
const mockPopStack = jest.fn(() => mockSelection?.onCancel?.());
let mockPageClose: (() => void) | undefined;
let mockContent: ReactNode;
let mockItems: IItem[] = [];
const mockIntl = createIntl({
  locale: 'en',
  onError: () => undefined,
});

jest.mock('react-intl', () => ({
  ...jest.requireActual<typeof import('react-intl')>('react-intl'),
  useIntl: () => mockIntl,
}));
jest.mock('@react-navigation/core', () => ({
  useRoute: () => ({ params: mockSelection }),
}));
jest.mock('@onekeyhq/components', () => {
  const Box = ({ children }: { children: ReactNode }) => children;
  return {
    ActionList: Object.assign(
      ({ items }: { items: IItem[] }) => {
        mockItems = items;
        return null;
      },
      { Item: () => null },
    ),
    Dialog: {
      show: (props: IDialogShowProps) => {
        mockContent = props.renderContent;
        return { close: mockParentClose };
      },
    },
    Page: ({ onClose }: { onClose?: () => void }) => {
      mockPageClose = onClose;
      return null;
    },
    Button: () => null,
    XStack: Box,
    YStack: Box,
    Empty: () => null,
    SizableText: () => null,
    Toast: { success: jest.fn() },
  };
});
jest.mock('@onekeyhq/kit/src/components/WalletBackup', () =>
  jest.requireActual<
    typeof import('../../../components/WalletBackup/WalletBackupActions')
  >('../../../components/WalletBackup/WalletBackupActions'),
);
jest.mock('@onekeyhq/kit/src/components/WalletListView', () => ({
  WalletListView: () => null,
}));
jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: () => ({ result: [mockWallet] }),
}));
jest.mock('../../../hooks/useAccountData', () => ({
  useAccountData: ({ walletId }: { walletId: string }) => ({
    wallet: walletId ? mockWallet : undefined,
  }),
}));
jest.mock('../../../hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({ pushModal: mockPushModal, popStack: mockPopStack }),
}));
jest.mock('../../../hooks/usePageNavigation', () => ({
  navigateToBackupWalletReminderPage: jest.fn(),
  navigateToKeyTagBackupDotMapPage: jest.fn(),
}));
jest.mock('../../../components/WalletBackup/getManualBackupMnemonic', () => ({
  getManualBackupMnemonic: jest.fn(),
}));
jest.mock('../../Onboardingv2/hooks/useCloudBackup', () => ({
  useCloudBackup: () => ({ supportCloudBackup: false, startBackup: jest.fn() }),
}));
jest.mock('@onekeyhq/kit/src/hooks/useUserWalletProfile', () => ({
  useUserWalletProfile: () => ({ isSoftwareWalletOnlyUser: false }),
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: true, isNativeIOSMacCatalyst: false },
}));
jest.mock('@onekeyhq/shared/src/utils/sensitiveTextUtils', () => ({
  ensureSensitiveTextEncoded: jest.fn(),
}));
jest.mock('./useLiteCard', () =>
  jest.requireActual<typeof import('./useLiteCard')>('./useLiteCard.tsx'),
);
jest.mock('./useNFC', () => ({
  __esModule: true,
  default: () => ({
    checkNFCEnabledPermission: async () => undefined,
    createNFCConnection: <T,>(callback: () => Promise<T>) => callback,
    handlerLiteCardError: async () => 'continue',
  }),
  LiteCard: {
    getLiteInfo: () => mockRead(),
    setMnemonic: (...args: unknown[]) => mockWrite(...args),
  },
  CardErrors: { NotInitializedError: 4002 },
}));
jest.mock('./usePIN', () => ({
  __esModule: true,
  default: () => ({
    showPINFormDialog: (...args: unknown[]) => mockPIN(...args),
  }),
}));
jest.mock('./useOperationDialog', () => ({
  __esModule: true,
  default: () => ({
    showBackupOverwrittenDialog: async () => undefined,
    showBackupSuccessDialog: () => mockSuccessDialog(),
  }),
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    servicePassword: {
      clearCachedPassword: async () => undefined,
      promptPasswordVerifyByWallet: () => mockPromptPassword(),
    },
    serviceAccount: {
      getCredentialDecrypt: () => mockGetCredential(),
      updateWalletBackupStatus: () => mockUpdateBackup(),
    },
    serviceLiteCardMnemonic: { encodeMnemonic: async () => 'encoded-fixture' },
  },
}));
jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  appEventBus: { emit: jest.fn() },
  EAppEventBusNames: { WalletUpdate: 'walletUpdate' },
}));
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    hardware: { liteCard: { diagnostic: jest.fn() } },
    setting: {
      page: {
        oneKeyLiteBackup: jest.fn(),
        oneKeyLiteBackupResult: (result: { isSuccess: boolean }) =>
          mockResult(result),
      },
    },
    account: {
      wallet: { backupWallet: (method: string) => mockLegacyBackup(method) },
    },
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockSelection = undefined;
  mockPageClose = undefined;
  mockContent = null;
  mockItems = [];
  mockWrite.mockReset().mockResolvedValue(mockNativeSuccess);
  mockPromptPassword
    .mockReset()
    .mockResolvedValue({ password: 'fixture-password' });
  mockPIN.mockReset().mockResolvedValue('000000');
  mockParentClose.mockReset().mockResolvedValue(undefined);
});

it('settles real wallet-picker cancellation and releases the backup lock for a new selection', async () => {
  const { result } = renderHook(() => useBackUpWallet({ walletId: '' }));
  const first = result.current.handleBackUpByLiteCard();
  await waitFor(() => expect(mockSelection).toBeDefined());
  const cancelled = mockSelection;
  const picker = render(<SelectWalletPage />);
  act(() => mockPageClose?.());
  await first;
  cancelled?.onPick?.(mockWallet);
  expect(mockPromptPassword).not.toHaveBeenCalled();
  expect(mockGetCredential).not.toHaveBeenCalled();
  expect(mockPopStack).not.toHaveBeenCalled();
  picker.unmount();
  const second = result.current.handleBackUpByLiteCard();
  await waitFor(() => expect(mockPushModal).toHaveBeenCalledTimes(2));
  mockSelection?.onPick?.(mockWallet);
  await second;
  expect(mockWrite).toHaveBeenCalledTimes(1);
  expect(mockResult.mock.calls).toEqual([
    [{ isSuccess: false }],
    [{ isSuccess: true }],
  ]);
});

it('settles a selected wallet before synchronous page close and ignores duplicate callbacks', async () => {
  const { result } = renderHook(() => useBackUpWallet({ walletId: '' }));
  const pending = result.current.handleBackUpByLiteCard();
  await waitFor(() => expect(mockSelection).toBeDefined());
  const selection = mockSelection;
  selection?.onPick?.(mockWallet);
  selection?.onCancel?.();
  selection?.onPick?.(mockWallet);
  await pending;
  expect(mockPromptPassword).toHaveBeenCalledTimes(1);
  expect(mockGetCredential).toHaveBeenCalledTimes(1);
  expect(mockPopStack).toHaveBeenCalledTimes(1);
  expect(mockResult).toHaveBeenCalledWith({ isSuccess: true });
});

it('ends a pending picker on owner unmount and blocks a late wallet selection', async () => {
  const { result, unmount } = renderHook(() =>
    useBackUpWallet({ walletId: '' }),
  );
  const pending = result.current.handleBackUpByLiteCard();
  await waitFor(() => expect(mockSelection).toBeDefined());
  const selection = mockSelection;
  unmount();
  await pending;
  selection?.onPick?.(mockWallet);
  expect(mockPromptPassword).not.toHaveBeenCalled();
  expect(mockGetCredential).not.toHaveBeenCalled();
  expect(mockPopStack).not.toHaveBeenCalled();
});

it('keeps the real reminder-dialog owner mounted until the Lite operation finishes', async () => {
  let finish: ((value: typeof mockNativeSuccess) => void) | undefined;
  let verify: ((value: { password: string }) => void) | undefined;
  mockPromptPassword.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        verify = resolve;
      }),
  );
  mockWrite.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  showWalletBackupDialog({ wallet: mockWallet, intl: mockIntl });
  const host = render(mockContent);
  mockParentClose.mockImplementation(async () => {
    host.unmount();
  });
  const lite = mockItems.find((item) => item.label === 'global.onekey_lite');
  expect(lite).toBeDefined();
  expect(lite?.onPress?.()).toBeUndefined();
  expect(lite?.onPress?.()).toBeUndefined();
  lite?.onClose?.();
  await waitFor(() => expect(mockPromptPassword).toHaveBeenCalledTimes(1));
  expect(mockParentClose).not.toHaveBeenCalled();
  expect(mockRead).not.toHaveBeenCalled();
  expect(mockWrite).not.toHaveBeenCalled();
  verify?.({ password: 'fixture-password' });
  await waitFor(() => expect(mockWrite).toHaveBeenCalledTimes(1));
  expect(mockParentClose).not.toHaveBeenCalled();
  finish?.(mockNativeSuccess);
  await waitFor(() => expect(mockParentClose).toHaveBeenCalledTimes(1));
  expect(mockResult).toHaveBeenCalledWith({ isSuccess: true });
  expect(mockUpdateBackup).toHaveBeenCalledTimes(1);
  expect(mockLegacyBackup).toHaveBeenCalledWith('liteCard');
});

it('defers the nested wallet-edit parent close while the child menu closes immediately', async () => {
  let finish: ((value: typeof mockNativeSuccess) => void) | undefined;
  mockWrite.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const host: { current?: ReturnType<typeof render> } = {};
  const closeParent = jest.fn(() => {
    host.current?.unmount();
  });
  host.current = render(
    <HdWalletBackupButton wallet={mockWallet} onClose={closeParent} />,
  );
  const lite = mockItems.find((item) => item.label === 'global.onekey_lite');
  expect(lite?.onPress?.()).toBeUndefined();
  expect(lite?.onClose).toBeUndefined();
  await waitFor(() => expect(mockWrite).toHaveBeenCalledTimes(1));
  expect(closeParent).not.toHaveBeenCalled();
  finish?.(mockNativeSuccess);
  await waitFor(() => expect(closeParent).toHaveBeenCalledTimes(1));
  expect(mockResult).toHaveBeenCalledWith({ isSuccess: true });
});

it('calls both parent completion callbacks once after a cancelled Lite operation', async () => {
  mockPIN.mockRejectedValue(new Error('cancelled fixture'));
  const onSelected = jest.fn();
  const onClose = jest.fn();
  render(
    <WalletBackupActions
      wallet={mockWallet}
      onSelected={onSelected}
      onClose={onClose}
    >
      <span />
    </WalletBackupActions>,
  );
  const lite = mockItems.find((item) => item.label === 'global.onekey_lite');
  lite?.onPress?.();
  lite?.onClose?.();
  await waitFor(() => expect(onSelected).toHaveBeenCalledTimes(1));
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(mockWrite).not.toHaveBeenCalled();
  expect(mockResult).toHaveBeenCalledWith({ isSuccess: false });
});

/** @jest-environment jsdom */

import { renderHook, waitFor } from '@testing-library/react';

import useLiteCard from './useLiteCard';

jest.mock('./useLiteCard', () =>
  jest.requireActual<typeof import('./useLiteCard')>('./useLiteCard.tsx'),
);

type ICard = {
  serialNum: string;
  hasBackup: boolean | null;
  isNewCard: boolean;
  pinRetryCount: number;
};
type IResult = {
  error: { code: number } | null;
  data: boolean | string;
  cardInfo: ICard;
};
const mockReadMnemonic = jest.fn<
  Promise<{ mnemonic: string; walletId: string }>,
  []
>();
const mockRead = jest.fn<Promise<IResult>, []>();
const mockWrite = jest.fn<Promise<IResult>, unknown[]>();
const mockDecision = jest.fn<
  Promise<'continue' | 'retry' | 'retryPin' | 'cancel'>,
  [{ error?: { code: number } | null; cardInfo?: ICard; lastCardInfo?: ICard }]
>();
const mockPIN = jest.fn<Promise<string>, unknown[]>();
const mockOverwrite = jest.fn<Promise<void>, []>();
const mockSuccess = jest.fn<void, []>();
const mockBackupResult = jest.fn<void, unknown[]>();
const mockUpdateBackup = jest.fn<Promise<void>, unknown[]>();
const mockEmit = jest.fn<void, unknown[]>();
const mockImport = jest.fn<Promise<IResult>, []>();
const mockValidate = jest.fn<Promise<void>, []>();
const mockPushModal = jest.fn<void, unknown[]>();
const mockNFC = {
  checkNFCEnabledPermission: jest.fn(async () => undefined),
  createNFCConnection: <T,>(callback: () => Promise<T>) => callback,
  handlerLiteCardError: (params: Parameters<typeof mockDecision>[0]) =>
    mockDecision(params),
  hideNFCConnectDialog: jest.fn(),
};

jest.mock('./useNFC', () => ({
  __esModule: true,
  default: () => mockNFC,
  LiteCard: {
    getLiteInfo: () => mockRead(),
    setMnemonic: (...args: unknown[]) => mockWrite(...args),
    getMnemonicWithPin: () => mockImport(),
  },
  CardErrors: { NotInitializedError: 4002 },
}));
jest.mock('./usePIN', () => ({
  __esModule: true,
  default: () => ({
    showPINFormDialog: (...args: unknown[]) => mockPIN(...args),
  }),
}));
jest.mock('./useReadMnemonic', () => ({
  __esModule: true,
  default: () => ({
    readMnemonicWithWalletId: () => mockReadMnemonic(),
  }),
}));
jest.mock('./useOperationDialog', () => ({
  __esModule: true,
  default: () => ({
    showBackupOverwrittenDialog: () => mockOverwrite(),
    showBackupSuccessDialog: () => mockSuccess(),
  }),
}));
jest.mock('../../../hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({ pushModal: mockPushModal }),
}));
jest.mock('@onekeyhq/kit/src/hooks/useUserWalletProfile', () => ({
  useUserWalletProfile: () => ({ isSoftwareWalletOnlyUser: false }),
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceLiteCardMnemonic: {
      encodeMnemonic: async () => 'encoded-fixture',
      decodeMnemonic: async () => 'decoded-fixture',
    },
    servicePassword: { encodeSensitiveText: async () => 'sensitive-fixture' },
    serviceAccount: {
      updateWalletBackupStatus: (...args: unknown[]) =>
        mockUpdateBackup(...args),
      validateMnemonic: () => mockValidate(),
    },
  },
}));
jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  appEventBus: { emit: (...args: unknown[]) => mockEmit(...args) },
  EAppEventBusNames: { WalletUpdate: 'walletUpdate' },
}));
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    hardware: { liteCard: { diagnostic: jest.fn() } },
    setting: {
      page: {
        oneKeyLiteBackup: jest.fn(),
        oneKeyLiteBackupResult: (...args: unknown[]) =>
          mockBackupResult(...args),
        oneKeyLiteImportResult: jest.fn(),
      },
    },
    account: {
      wallet: { addWalletStarted: jest.fn(), walletAdded: jest.fn() },
    },
  },
}));

const freshCard = {
  serialNum: 'fixture-card',
  hasBackup: false,
  isNewCard: true,
  pinRetryCount: 10,
};
const initializedCard = { ...freshCard, isNewCard: false };
const success = (cardInfo: ICard = freshCard) => ({
  error: null,
  data: true,
  cardInfo,
});

beforeEach(() => {
  jest.resetAllMocks();
  mockReadMnemonic.mockResolvedValue({
    mnemonic: 'fixture',
    walletId: 'wallet',
  });
  mockPIN.mockResolvedValue('000000');
  mockDecision.mockImplementation(async ({ error, cardInfo, lastCardInfo }) => {
    if (lastCardInfo && cardInfo?.serialNum !== lastCardInfo.serialNum)
      return 'cancel';
    return error ? 'retry' : 'continue';
  });
  mockRead.mockResolvedValue(success());
  mockWrite.mockResolvedValue(success());
});

it('refreshes initialized card state after an unsuccessful new-card write and confirms overwrite', async () => {
  mockRead
    .mockResolvedValueOnce(success())
    .mockResolvedValueOnce(success(initializedCard));
  mockWrite
    .mockResolvedValueOnce({
      ...success(initializedCard),
      error: { code: 4000 },
    })
    .mockResolvedValueOnce(success(initializedCard));
  const { result } = renderHook(() => useLiteCard());
  await expect(result.current.backupWallet()).resolves.toBe(true);
  expect(mockRead).toHaveBeenCalledTimes(2);
  expect(mockWrite.mock.calls).toEqual([
    ['encoded-fixture', '000000', false, 'fixture-card'],
    ['encoded-fixture', '000000', true, 'fixture-card'],
  ]);
  expect(mockOverwrite).toHaveBeenCalledTimes(1);
  expect(mockPIN.mock.calls).toEqual([[true], [true, '000000'], [false]]);
  expect(mockSuccess).toHaveBeenCalledTimes(1);
  expect(mockUpdateBackup).toHaveBeenCalledTimes(1);
  expect(mockEmit).toHaveBeenCalledTimes(1);
  expect(mockBackupResult.mock.calls).toEqual([[{ isSuccess: true }]]);
});

it('waits for native completion before success state and ignores reentry', async () => {
  let finish: ((value: ReturnType<typeof success>) => void) | undefined;
  mockWrite.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const { result } = renderHook(() => useLiteCard());
  const pending = result.current.backupWallet();
  await waitFor(() => expect(mockWrite).toHaveBeenCalledTimes(1));
  expect(mockBackupResult).not.toHaveBeenCalled();
  expect(mockSuccess).not.toHaveBeenCalled();
  await expect(result.current.backupWallet()).resolves.toBe(false);
  finish?.(success());
  await expect(pending).resolves.toBe(true);
  expect(mockBackupResult).toHaveBeenCalledTimes(1);
});

it('does not overwrite or mark backup when confirmation is cancelled', async () => {
  mockRead.mockResolvedValue(success(initializedCard));
  mockOverwrite.mockRejectedValue(new Error('cancelled'));
  const { result } = renderHook(() => useLiteCard());
  await expect(result.current.backupWallet()).resolves.toBe(false);
  expect(mockWrite).not.toHaveBeenCalled();
  expect(mockUpdateBackup).not.toHaveBeenCalled();
  expect(mockBackupResult.mock.calls).toEqual([[{ isSuccess: false }]]);
});

it('keeps the first card identity across retries', async () => {
  mockWrite.mockResolvedValue({ ...success(), error: { code: 4001 } });
  mockRead
    .mockResolvedValueOnce(success())
    .mockResolvedValueOnce(
      success({ ...initializedCard, serialNum: 'other-card' }),
    );
  const { result } = renderHook(() => useLiteCard());
  await expect(result.current.backupWallet()).resolves.toBe(false);
  expect(mockWrite).toHaveBeenCalledTimes(1);
  expect(mockSuccess).not.toHaveBeenCalled();
  expect(mockUpdateBackup).not.toHaveBeenCalled();
});

it('drops late native success after unmount', async () => {
  let finish: ((value: ReturnType<typeof success>) => void) | undefined;
  mockWrite.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const { result, unmount } = renderHook(() => useLiteCard());
  const pending = result.current.backupWallet();
  await waitFor(() => expect(mockWrite).toHaveBeenCalledTimes(1));
  unmount();
  finish?.(success());
  await expect(pending).resolves.toBe(false);
  expect(mockSuccess).not.toHaveBeenCalled();
  expect(mockBackupResult.mock.calls).toEqual([[{ isSuccess: false }]]);
});

it('does not import or report success until validation completes', async () => {
  mockImport.mockResolvedValue({ ...success(), data: 'encoded-fixture' });
  mockValidate.mockRejectedValue(new Error('invalid mnemonic'));
  const { result } = renderHook(() => useLiteCard());
  await result.current.importWallet();
  expect(mockPushModal).not.toHaveBeenCalled();
});

it('accepts the iOS unknown backup flag on a fresh card without losing the native identity guard', async () => {
  mockRead.mockResolvedValue(success({ ...freshCard, hasBackup: null }));
  const { result } = renderHook(() => useLiteCard());
  await expect(result.current.backupWallet()).resolves.toBe(true);
  expect(mockWrite).toHaveBeenCalledWith(
    'encoded-fixture',
    '000000',
    false,
    'fixture-card',
  );
  expect(mockOverwrite).not.toHaveBeenCalled();
});

it('requires explicit confirmation for an initialized iOS card with unknown backup state', async () => {
  mockRead.mockResolvedValue(success({ ...initializedCard, hasBackup: null }));
  mockOverwrite.mockRejectedValue(new Error('cancelled'));
  const { result } = renderHook(() => useLiteCard());
  await expect(result.current.backupWallet()).resolves.toBe(false);
  expect(mockOverwrite).toHaveBeenCalledTimes(1);
  expect(mockWrite).not.toHaveBeenCalled();
});

it('does not open the second PIN prompt when confirmation also unmounts the flow', async () => {
  const { result, unmount } = renderHook(() => useLiteCard());
  mockPIN.mockImplementationOnce(async () => {
    unmount();
    return '000000';
  });
  await expect(result.current.backupWallet()).resolves.toBe(false);
  expect(mockPIN).toHaveBeenCalledTimes(1);
  expect(mockWrite).not.toHaveBeenCalled();
  expect(mockBackupResult.mock.calls).toEqual([[{ isSuccess: false }]]);
});

it('retries an import PIN without reporting intermediate failure or importing the failed payload', async () => {
  mockDecision
    .mockResolvedValueOnce('retryPin')
    .mockResolvedValueOnce('continue');
  mockImport
    .mockResolvedValueOnce({ ...success(), error: { code: 3001 }, data: '' })
    .mockResolvedValueOnce({ ...success(), data: 'encoded-fixture' });
  const { result } = renderHook(() => useLiteCard());
  await result.current.importWallet();
  expect(mockImport).toHaveBeenCalledTimes(2);
  expect(mockPIN).toHaveBeenCalledTimes(2);
  expect(mockValidate).toHaveBeenCalledTimes(1);
  expect(mockPushModal).toHaveBeenCalledTimes(1);
});

it('does not read the mnemonic or open a PIN prompt if permission resolves while unmounting', async () => {
  const { result, unmount } = renderHook(() => useLiteCard());
  mockNFC.checkNFCEnabledPermission.mockImplementationOnce(async () => {
    unmount();
  });
  await expect(result.current.backupWallet()).resolves.toBe(false);
  expect(mockReadMnemonic).not.toHaveBeenCalled();
  expect(mockPIN).not.toHaveBeenCalled();
  expect(mockWrite).not.toHaveBeenCalled();
  expect(mockBackupResult.mock.calls).toEqual([[{ isSuccess: false }]]);
});

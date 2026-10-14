/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useCloudBackup } from './useCloudBackup';

const mockClosePassword = jest.fn(async () => undefined);
const mockCloseImport = jest.fn(async () => undefined);
const mockPrepareImport = jest.fn<Promise<string | undefined>, []>();
const mockPreparePrivateData = jest.fn(async () => undefined);
const mockRestore = jest.fn(async (_params: unknown) => ({ success: true }));
const mockResetImport = jest.fn(async () => undefined);
const mockShowImport = jest.fn((_params: unknown) => ({
  close: mockCloseImport,
}));
const mockNavigation = { pop: jest.fn(), navigate: jest.fn() };
const mockIntl = { formatMessage: ({ id }: { id: string }) => id };
let mockSubmitPassword: (password: string) => Promise<void>;
let mockPreventExit = false;
const mockShowPassword = jest.fn(
  ({ onSubmit }: { onSubmit: typeof mockSubmitPassword }) => {
    mockSubmitPassword = onSubmit;
    return { close: mockClosePassword };
  },
);

jest.mock('react-intl', () => ({ useIntl: () => mockIntl }));
jest.mock('@onekeyhq/components', () => ({
  Dialog: {},
  Toast: { error: jest.fn(), success: jest.fn() },
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  cloudBackupExitPreventAtom: {
    set: async (
      update: (state: { shouldPreventExit: boolean }) => {
        shouldPreventExit: boolean;
      },
    ) => {
      mockPreventExit = update({
        shouldPreventExit: mockPreventExit,
      }).shouldPreventExit;
    },
  },
  useCloudBackupStatusAtom: () => [{ supportCloudBackup: true }],
}));
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({ defaultLogger: {} }));
jest.mock('@onekeyhq/shared/src/modules3rdParty/intercom/utils', () => ({
  getInstanceId: async () => undefined,
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isDesktopMac: true },
}));
jest.mock('@onekeyhq/shared/src/utils/openUrlUtils', () => ({}));
jest.mock('../../../hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => mockNavigation,
}));
jest.mock('../../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceCloudBackupV2: {
      getCloudAccountInfo: async () => ({
        iCloud: {
          cloudKitAvailable: true,
          cloudKitContainerUserId: 'fixture-user',
        },
      }),
      restorePreparePrivateData: () => mockPreparePrivateData(),
      restore: (params: unknown) => mockRestore(params),
    },
    servicePrimeTransfer: {
      prepareImportTask: () => mockPrepareImport(),
      resetImportProgress: () => mockResetImport(),
    },
  },
}));
jest.mock('../components/CloudBackupDialogs', () => ({
  showCloudBackupPasswordDialog: (
    options: Parameters<typeof mockShowPassword>[0],
  ) => mockShowPassword(options),
}));
jest.mock(
  '../../Prime/pages/PagePrimeTransfer/components/PrimeTransferImportProcessingDialog',
  () => ({
    showPrimeTransferImportProcessingDialog: (params: unknown) =>
      mockShowImport(params),
  }),
);

beforeEach(() => {
  jest.clearAllMocks();
  mockPrepareImport.mockReset();
  mockPreventExit = false;
});

test('busy import keeps the password dialog open, shows feedback, and lets the same submission retry', async () => {
  const toast = jest.spyOn(appEventBus, 'emit');
  const busy = new OneKeyLocalError({
    key: ETranslations.global_request_limit,
    message: 'Too many requests, please try again later.',
  });
  mockPrepareImport
    .mockRejectedValueOnce(busy)
    .mockResolvedValueOnce('new-task');
  const { result } = renderHook(() => useCloudBackup());
  await act(async () => result.current.doRestoreBackup({ payload: undefined }));

  await act(async () => {
    await expect(mockSubmitPassword('fixture-password')).rejects.toBe(busy);
  });
  expect(toast).toHaveBeenCalledWith(
    EAppEventBusNames.ShowToast,
    expect.objectContaining({
      title: busy.message,
      i18nKey: ETranslations.global_request_limit,
    }),
  );
  expect(mockClosePassword).not.toHaveBeenCalled();
  expect(mockShowImport).not.toHaveBeenCalled();
  expect(mockRestore).not.toHaveBeenCalled();
  expect(mockResetImport).not.toHaveBeenCalled();
  expect(mockPreventExit).toBe(false);
  expect(result.current.checkLoading).toBe(false);

  await act(async () => mockSubmitPassword('fixture-password'));
  expect(mockShowPassword).toHaveBeenCalledTimes(1);
  expect(mockClosePassword).toHaveBeenCalledTimes(1);
  expect(mockShowImport).toHaveBeenCalledWith(
    expect.objectContaining({ taskUUID: 'new-task' }),
  );
  expect(mockRestore).toHaveBeenCalledWith({
    taskUUID: 'new-task',
    password: 'fixture-password',
    payload: undefined,
  });
  expect(mockResetImport).not.toHaveBeenCalled();
  expect(mockNavigation.pop).toHaveBeenCalledTimes(1);
  expect(mockPreventExit).toBe(false);
  toast.mockRestore();
});

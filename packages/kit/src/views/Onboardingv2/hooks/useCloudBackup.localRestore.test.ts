/** @jest-environment jsdom */
/* eslint-disable @typescript-eslint/unbound-method -- Jest mock functions do not use this binding. */

import { act, renderHook } from '@testing-library/react';

import { Toast } from '@onekeyhq/components';
import { cloudBackupExitPreventAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { IBackupDataEncryptedPayload } from '@onekeyhq/shared/src/cloudBackup/cloudBackupTypes';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { showPrimeTransferImportProcessingDialog } from '../../Prime/pages/PagePrimeTransfer/components/PrimeTransferImportProcessingDialog';
import { showCloudBackupPasswordDialog } from '../components/CloudBackupDialogs';

import { useCloudBackup } from './useCloudBackup';

const mockNavigation = { pop: jest.fn(), navigate: jest.fn() };
const mockPasswordDialog = { close: jest.fn(async () => undefined) };
const mockProgressDialog = { close: jest.fn(async () => undefined) };

jest.mock('@onekeyhq/shared/src/utils/openUrlUtils', () => ({
  openUrlExternal: jest.fn(),
}));

jest.mock('@onekeyhq/components', () => ({
  Dialog: { confirm: jest.fn(), loading: jest.fn(() => mockProgressDialog) },
  Toast: { success: jest.fn(), error: jest.fn() },
}));
jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  cloudBackupExitPreventAtom: { set: jest.fn() },
  useCloudBackupStatusAtom: () => [{ supportCloudBackup: true }],
}));
jest.mock('../../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    servicePrimeTransfer: {
      prepareImportTask: jest.fn(async () => 'import-task'),
      resetImportProgress: jest.fn(),
    },
    serviceCloudBackupV2: {
      getCloudAccountInfo: jest.fn(async () => ({
        iCloud: {
          cloudKitAvailable: true,
          cloudKitContainerUserId: 'synthetic-account',
        },
        googleDrive: {
          googlePlayServiceAvailable: true,
          userInfo: { user: { id: 'synthetic-google-id' } },
        },
      })),
      isBackupPasswordSet: jest.fn(async () => true),
      verifyBackupPassword: jest.fn(async () => true),
      backup: jest.fn(async () => ({ recordID: 'new-backup' })),
      prepareLocalRestore: jest.fn(),
      restorePreparedLocalBackup: jest.fn(),
      restorePreparePrivateData: jest.fn(),
      restore: jest.fn(async () => ({ success: true })),
    },
  },
}));
jest.mock('../../../hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => mockNavigation,
}));
jest.mock('../components/CloudBackupDialogs', () => ({
  showCloudBackupPasswordDialog: jest.fn(() => mockPasswordDialog),
  showCloudBackupDeleteDialog: jest.fn(),
}));
jest.mock(
  '../../Prime/pages/PagePrimeTransfer/components/PrimeTransferImportProcessingDialog',
  () => ({
    showPrimeTransferImportProcessingDialog: jest.fn(() => mockProgressDialog),
  }),
);

const payload: IBackupDataEncryptedPayload = {
  privateDataEncrypted: 'synthetic-ciphertext',
  publicData: {
    dataTime: 1,
    totalWalletsCount: 0,
    totalAccountsCount: 0,
    walletDetails: [],
  },
  appVersion: 'test',
  isEmptyData: false,
  isWatchingOnly: false,
};

describe.each(['iOS', 'Android'])('%s local restore UI flow', (platform) => {
  const original = {
    isNativeIOS: platformEnv.isNativeIOS,
    isNativeAndroid: platformEnv.isNativeAndroid,
    isNative: platformEnv.isNative,
    isDesktopMac: platformEnv.isDesktopMac,
  };
  const service = jest.mocked(backgroundApiProxy.serviceCloudBackupV2);
  const transfer = jest.mocked(backgroundApiProxy.servicePrimeTransfer);
  const params = { recordId: 'synthetic-backup', payload };

  beforeEach(() => {
    jest.clearAllMocks();
    Object.assign(platformEnv, {
      isNativeIOS: platform === 'iOS',
      isNativeAndroid: platform === 'Android',
      isNative: true,
      isDesktopMac: false,
    });
    transfer.prepareImportTask.mockReset().mockResolvedValue('import-task');
    service.prepareLocalRestore.mockReset().mockResolvedValue(null);
    service.restorePreparedLocalBackup
      .mockReset()
      .mockResolvedValue({ success: true });
    service.restorePreparePrivateData.mockReset();
    jest.spyOn(timerUtils, 'wait').mockResolvedValue(undefined);
  });
  afterEach(() => {
    Object.assign(platformEnv, original);
    jest.restoreAllMocks();
  });

  it('skips backup password entry on a cache hit and imports using only the background handle', async () => {
    service.prepareLocalRestore.mockResolvedValue({
      restoreId: 'one-use-handle',
    });
    const { result } = renderHook(() => useCloudBackup());
    await act(async () => {
      await result.current.doRestoreBackup(params);
    });
    expect(showCloudBackupPasswordDialog).not.toHaveBeenCalled();
    expect(service.prepareLocalRestore).toHaveBeenCalledWith({
      recordId: params.recordId,
      password: undefined,
    });
    expect(service.restorePreparedLocalBackup).toHaveBeenCalledWith({
      restoreId: 'one-use-handle',
      taskUUID: 'import-task',
    });
    expect(service.restorePreparePrivateData).not.toHaveBeenCalled();
    expect(service.restore).not.toHaveBeenCalled();
    expect(Toast.success).toHaveBeenCalledTimes(1);
    expect(mockNavigation.navigate).toHaveBeenCalledTimes(1);
    expect(result.current.checkLoading).toBe(false);
  });

  it('opens manual entry only after a cache miss and retries preparation with the supplied password', async () => {
    const { result } = renderHook(() => useCloudBackup());
    await act(async () => {
      await result.current.doRestoreBackup(params);
    });
    expect(showCloudBackupPasswordDialog).toHaveBeenCalledTimes(1);
    expect(transfer.prepareImportTask).not.toHaveBeenCalled();
    expect(showPrimeTransferImportProcessingDialog).not.toHaveBeenCalled();
    service.prepareLocalRestore.mockResolvedValue({
      restoreId: 'manual-restore-handle',
    });
    const [{ onSubmit }] = jest.mocked(showCloudBackupPasswordDialog).mock
      .calls[0];
    await act(async () => {
      await onSubmit('synthetic-password');
    });
    expect(service.prepareLocalRestore).toHaveBeenLastCalledWith({
      recordId: params.recordId,
      password: 'synthetic-password',
    });
    expect(mockPasswordDialog.close).toHaveBeenCalledTimes(1);
    expect(service.restorePreparedLocalBackup).toHaveBeenCalledWith({
      restoreId: 'manual-restore-handle',
      taskUUID: 'import-task',
    });
    expect(result.current.checkLoading).toBe(false);
  });

  it('keeps the password dialog open on wrong manual input and never starts import', async () => {
    const { result } = renderHook(() => useCloudBackup());
    await act(async () => {
      await result.current.doRestoreBackup(params);
    });
    service.prepareLocalRestore.mockRejectedValueOnce(
      new Error('Incorrect password'),
    );
    const [{ onSubmit }] = jest.mocked(showCloudBackupPasswordDialog).mock
      .calls[0];
    await act(async () => {
      await expect(onSubmit('wrong-password')).rejects.toThrow(
        'Incorrect password',
      );
    });
    expect(mockPasswordDialog.close).not.toHaveBeenCalled();
    expect(service.restorePreparedLocalBackup).not.toHaveBeenCalled();
    expect(result.current.checkLoading).toBe(false);
  });

  it('cleans up after local authorization cancellation without falling back to another password dialog', async () => {
    service.prepareLocalRestore.mockResolvedValue({
      restoreId: 'one-use-handle',
    });
    service.restorePreparedLocalBackup.mockRejectedValueOnce(
      new Error('Local authorization canceled'),
    );
    const { result } = renderHook(() => useCloudBackup());
    await act(async () => {
      await expect(result.current.doRestoreBackup(params)).rejects.toThrow(
        'Local authorization canceled',
      );
    });
    expect(mockProgressDialog.close).toHaveBeenCalledTimes(1);
    expect(showCloudBackupPasswordDialog).not.toHaveBeenCalled();
    expect(Toast.success).not.toHaveBeenCalled();
    expect(result.current.checkLoading).toBe(false);
    const calls = jest.mocked(cloudBackupExitPreventAtom.set).mock.calls;
    const [lastUpdate] = calls[calls.length - 1];
    if (typeof lastUpdate !== 'function')
      throw new OneKeyLocalError('Expected an atom updater');
    expect(lastUpdate({ shouldPreventExit: true })).toEqual({
      shouldPreventExit: false,
    });
  });

  it('releases an expired handle task before retrying with manual entry', async () => {
    service.prepareLocalRestore.mockResolvedValue({
      restoreId: 'expired-handle',
    });
    service.restorePreparedLocalBackup.mockResolvedValueOnce(null);
    const { result } = renderHook(() => useCloudBackup());
    await act(async () => {
      await result.current.doRestoreBackup(params);
    });
    expect(mockProgressDialog.close).toHaveBeenCalledTimes(1);
    expect(showCloudBackupPasswordDialog).toHaveBeenCalledTimes(1);
    expect(Toast.success).not.toHaveBeenCalled();
    expect(transfer.resetImportProgress).toHaveBeenCalledWith({
      taskUUID: 'import-task',
    });
    transfer.prepareImportTask.mockResolvedValueOnce('retry-task');
    const [{ onSubmit }] = jest.mocked(showCloudBackupPasswordDialog).mock
      .calls[0];
    await act(async () => onSubmit('synthetic-password'));
    expect(service.restorePreparedLocalBackup).toHaveBeenLastCalledWith({
      restoreId: 'expired-handle',
      taskUUID: 'retry-task',
    });
    expect(Toast.success).toHaveBeenCalledTimes(1);
  });

  it('does not treat a cancelled task reservation as a cache miss', async () => {
    service.prepareLocalRestore.mockResolvedValue({
      restoreId: 'one-use-handle',
    });
    transfer.prepareImportTask.mockResolvedValueOnce(undefined);
    const { result } = renderHook(() => useCloudBackup());
    await act(async () => result.current.doRestoreBackup(params));
    expect(showCloudBackupPasswordDialog).not.toHaveBeenCalled();
    expect(showPrimeTransferImportProcessingDialog).not.toHaveBeenCalled();
    expect(service.restorePreparedLocalBackup).not.toHaveBeenCalled();
    expect(transfer.resetImportProgress).not.toHaveBeenCalled();
    expect(result.current.checkLoading).toBe(false);
  });

  it('still requires manual backup-password entry before creating a new backup', async () => {
    service.prepareLocalRestore.mockResolvedValue({
      restoreId: 'cached-handle',
    });
    const data = {
      ...payload,
      privateData: {
        credentials: {},
        wallets: {},
        importedAccounts: {},
        watchingAccounts: {},
      },
    };
    const { result } = renderHook(() => useCloudBackup());
    await act(async () => result.current.doBackup({ data }));
    expect(showCloudBackupPasswordDialog).toHaveBeenCalledTimes(1);
    expect(service.backup).not.toHaveBeenCalled();
    expect(service.prepareLocalRestore).not.toHaveBeenCalled();
    const [{ onSubmit }] = jest.mocked(showCloudBackupPasswordDialog).mock
      .calls[0];
    await act(async () => onSubmit('synthetic-password'));
    expect(service.verifyBackupPassword).toHaveBeenCalledWith({
      password: 'synthetic-password',
    });
    expect(service.backup).toHaveBeenCalledWith({
      data,
      password: 'synthetic-password',
    });
  });

  it('keeps desktop on the existing manual-password flow', async () => {
    Object.assign(platformEnv, {
      isNativeIOS: false,
      isNativeAndroid: false,
      isDesktopMac: true,
      isNative: false,
    });
    const { result } = renderHook(() => useCloudBackup());
    await act(async () => {
      await result.current.doRestoreBackup(params);
    });
    expect(service.prepareLocalRestore).not.toHaveBeenCalled();
    const [{ onSubmit }] = jest.mocked(showCloudBackupPasswordDialog).mock
      .calls[0];
    await act(async () => {
      await onSubmit('synthetic-password');
    });
    expect(service.restorePreparePrivateData).toHaveBeenCalledWith({
      ...params,
      password: 'synthetic-password',
    });
    expect(service.restore).toHaveBeenCalledWith({
      ...params,
      taskUUID: 'import-task',
      password: 'synthetic-password',
    });
    expect(service.restorePreparedLocalBackup).not.toHaveBeenCalled();
  });
});

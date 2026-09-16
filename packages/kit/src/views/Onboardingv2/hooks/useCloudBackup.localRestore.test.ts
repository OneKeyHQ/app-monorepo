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
  Dialog: { confirm: jest.fn() },
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

describe('iCloud local restore UI flow', () => {
  const original = {
    isNativeIOS: platformEnv.isNativeIOS,
    isNativeAndroid: platformEnv.isNativeAndroid,
    isNative: platformEnv.isNative,
    isDesktopMac: platformEnv.isDesktopMac,
  };
  const service = jest.mocked(backgroundApiProxy.serviceCloudBackupV2);
  const params = { recordId: 'synthetic-backup', payload };

  beforeEach(() => {
    jest.clearAllMocks();
    Object.assign(platformEnv, {
      isNativeIOS: true,
      isNativeAndroid: false,
      isNative: true,
      isDesktopMac: false,
    });
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
    expect(service.restorePreparedLocalBackup).toHaveBeenCalledWith({
      restoreId: 'one-use-handle',
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
      ...params,
      password: 'synthetic-password',
    });
    expect(mockPasswordDialog.close).toHaveBeenCalledTimes(1);
    expect(service.restorePreparedLocalBackup).toHaveBeenCalledWith({
      restoreId: 'manual-restore-handle',
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

  it('returns to manual entry when the handle expires before import', async () => {
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
  });

  it('keeps Google Drive on the existing manual-password flow', async () => {
    Object.assign(platformEnv, { isNativeIOS: false, isNativeAndroid: true });
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
      password: 'synthetic-password',
    });
    expect(service.restorePreparedLocalBackup).not.toHaveBeenCalled();
  });
});

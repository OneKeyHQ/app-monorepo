import { HardwareErrorCode as ThirdPartyHwErrorCode } from '@onekeyfe/hwk-adapter-core';

import type { IAccountDeriveTypes } from '@onekeyhq/kit-bg/src/vaults/types';
import type { IOneKeyError } from '@onekeyhq/shared/src/errors/types/errorTypes';

export type ILedgerAppNotInstalledFailure = {
  appName: string;
  networkId?: string;
  deriveType?: IAccountDeriveTypes;
};

function getRecordValue(value: unknown, key: string): unknown {
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  const record = value as Record<string, unknown>;
  return record[key];
}

function getStringRecordValue(value: unknown, key: string): string | undefined {
  const recordValue = getRecordValue(value, key);
  return typeof recordValue === 'string' ? recordValue : undefined;
}

function getLedgerAppNameFromError(error: IOneKeyError): string | undefined {
  return (
    getStringRecordValue(error, 'appName') ||
    getStringRecordValue(error.info, 'appName') ||
    getStringRecordValue(error.payload?.params, 'appName')
  );
}

export function getLedgerAppNotInstalledInfoFromError(
  error: IOneKeyError | Error | unknown,
): ILedgerAppNotInstalledFailure | undefined {
  if (!error || typeof error !== 'object') {
    return undefined;
  }
  const oneKeyError = error as IOneKeyError;
  const errorCode =
    oneKeyError.code ?? getRecordValue(oneKeyError.payload, 'code');
  if (errorCode !== ThirdPartyHwErrorCode.AppNotInstalled) {
    return undefined;
  }
  const appName = getLedgerAppNameFromError(oneKeyError);
  if (!appName) {
    return undefined;
  }
  return {
    appName,
  };
}

export function findLedgerAppNotInstalledFailures(
  failedAccounts: Array<{
    networkId: string;
    deriveType: IAccountDeriveTypes;
    error: IOneKeyError;
  }>,
): ILedgerAppNotInstalledFailure[] {
  return failedAccounts.reduce<ILedgerAppNotInstalledFailure[]>(
    (result, failedAccount) => {
      const info = getLedgerAppNotInstalledInfoFromError(failedAccount.error);
      if (!info) {
        return result;
      }
      return [
        ...result,
        {
          ...info,
          networkId: failedAccount.networkId,
          deriveType: failedAccount.deriveType,
        },
      ];
    },
    [],
  );
}

export function findLedgerAppNotInstalledFailure(
  failedAccounts: Array<{
    networkId: string;
    deriveType: IAccountDeriveTypes;
    error: IOneKeyError;
  }>,
): ILedgerAppNotInstalledFailure | undefined {
  return findLedgerAppNotInstalledFailures(failedAccounts)[0];
}

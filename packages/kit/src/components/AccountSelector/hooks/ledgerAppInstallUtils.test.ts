import { HardwareErrorCode as ThirdPartyHwErrorCode } from '@onekeyfe/hwk-adapter-core';

import type { IAccountDeriveTypes } from '@onekeyhq/kit-bg/src/vaults/types';
import type { IOneKeyError } from '@onekeyhq/shared/src/errors/types/errorTypes';

import {
  findLedgerAppNotInstalledFailure,
  findLedgerAppNotInstalledFailures,
  getLedgerAppNotInstalledInfoFromError,
} from './ledgerAppInstallUtils';

describe('ledgerAppInstallUtils', () => {
  it('finds app-not-installed failure and extracts appName from i18n info', () => {
    const failure = findLedgerAppNotInstalledFailure([
      {
        networkId: 'sol--101',
        deriveType: 'default' as IAccountDeriveTypes,
        error: {
          code: ThirdPartyHwErrorCode.AppNotInstalled,
          info: { appName: 'Solana' },
          message: 'Please install the Solana app in Ledger Live first.',
        } as IOneKeyError,
      },
    ]);

    expect(failure).toEqual({
      appName: 'Solana',
      networkId: 'sol--101',
      deriveType: 'default',
    });
  });

  it('ignores non app-not-installed failures', () => {
    const failure = findLedgerAppNotInstalledFailure([
      {
        networkId: 'evm--1',
        deriveType: 'default' as IAccountDeriveTypes,
        error: {
          code: ThirdPartyHwErrorCode.DeviceDisconnected,
          message: 'Disconnected',
        } as IOneKeyError,
      },
    ]);

    expect(failure).toBeUndefined();
  });

  it('finds multiple app-not-installed failures for batch creation', () => {
    const failures = findLedgerAppNotInstalledFailures([
      {
        networkId: 'sol--101',
        deriveType: 'default' as IAccountDeriveTypes,
        error: {
          code: ThirdPartyHwErrorCode.AppNotInstalled,
          info: { appName: 'Solana' },
          message: 'Please install the Solana app.',
        } as IOneKeyError,
      },
      {
        networkId: 'bfc--3068',
        deriveType: 'default' as IAccountDeriveTypes,
        error: {
          code: ThirdPartyHwErrorCode.AppNotInstalled,
          info: { appName: 'Bifrost' },
          message: 'Please install the Bifrost app.',
        } as IOneKeyError,
      },
    ]);

    expect(failures.map((failure) => failure.appName)).toEqual([
      'Solana',
      'Bifrost',
    ]);
  });

  it('extracts app-not-installed info from thrown error payload params', () => {
    const info = getLedgerAppNotInstalledInfoFromError({
      code: ThirdPartyHwErrorCode.AppNotInstalled,
      payload: { params: { appName: 'Bifrost' } },
      message: 'Please install Bifrost.',
    } as IOneKeyError);

    expect(info).toEqual({
      appName: 'Bifrost',
    });
  });

  it('extracts app-not-installed info when code is only in payload', () => {
    const info = getLedgerAppNotInstalledInfoFromError({
      payload: {
        code: ThirdPartyHwErrorCode.AppNotInstalled,
        params: { appName: 'Solana' },
      },
      message: 'Please install Solana.',
    } as IOneKeyError);

    expect(info).toEqual({
      appName: 'Solana',
    });
  });
});

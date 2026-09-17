import { HardwareErrorCode } from '@onekeyfe/hwk-adapter-core';

import {
  THIRD_PARTY_HW_APP_ALREADY_INSTALLED_CODE,
  THIRD_PARTY_HW_FIRMWARE_METADATA_ERROR_CODE,
  THIRD_PARTY_HW_NETWORK_ERROR_CODE,
  THIRD_PARTY_HW_SECURE_CHANNEL_ERROR_CODE,
} from '@onekeyhq/shared/src/errors/errors/thirdPartyHardwareErrors';

import {
  resolveLedgerInstallFailureAction,
  shouldContinueLedgerAutoCreateForCoreAppsCheckResult,
} from './ledgerCoreAppsReadyUtils';

describe('shouldContinueLedgerAutoCreateForCoreAppsCheckResult', () => {
  it('continues when core apps are ready', () => {
    expect(
      shouldContinueLedgerAutoCreateForCoreAppsCheckResult({ ok: true }),
    ).toBe(true);
  });

  it('continues when only the installed-app probe failed', () => {
    expect(
      shouldContinueLedgerAutoCreateForCoreAppsCheckResult({
        ok: false,
        reason: 'probeFailed',
      }),
    ).toBe(true);
  });

  it('stops when app installation was not completed', () => {
    expect(
      shouldContinueLedgerAutoCreateForCoreAppsCheckResult({
        ok: false,
        reason: 'installNotCompleted',
      }),
    ).toBe(false);
  });
});

describe('resolveLedgerInstallFailureAction', () => {
  it('rebuilds the session for a broken secure channel', () => {
    expect(
      resolveLedgerInstallFailureAction({
        code: THIRD_PARTY_HW_SECURE_CHANNEL_ERROR_CODE,
        autoRetryUsed: false,
      }),
    ).toBe('recoverAndRetry');
  });

  it('spends the recovery budget only once per install attempt', () => {
    expect(
      resolveLedgerInstallFailureAction({
        code: THIRD_PARTY_HW_SECURE_CHANNEL_ERROR_CODE,
        autoRetryUsed: true,
      }),
    ).toBe('fail');
  });

  it.each([[false], [true]])(
    'treats an already-installed app as done regardless of the retry budget (autoRetryUsed=%s)',
    (autoRetryUsed) => {
      expect(
        resolveLedgerInstallFailureAction({
          code: THIRD_PARTY_HW_APP_ALREADY_INSTALLED_CODE,
          autoRetryUsed,
        }),
      ).toBe('alreadyInstalled');
    },
  );

  it.each([
    ['metadata / network', THIRD_PARTY_HW_NETWORK_ERROR_CODE],
    ['raw firmware metadata', THIRD_PARTY_HW_FIRMWARE_METADATA_ERROR_CODE],
    ['device disconnect', HardwareErrorCode.DeviceDisconnected],
    ['user reject', HardwareErrorCode.UserRejected],
    ['user abort', HardwareErrorCode.UserAborted],
    ['timeout', HardwareErrorCode.OperationTimeout],
  ])('never auto-recovers a %s failure', (_label, code) => {
    expect(
      resolveLedgerInstallFailureAction({ code, autoRetryUsed: false }),
    ).toBe('fail');
  });
});

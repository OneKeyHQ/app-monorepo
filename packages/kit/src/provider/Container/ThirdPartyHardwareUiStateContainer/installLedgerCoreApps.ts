import { HardwareErrorCode as ThirdPartyHwErrorCode } from '@onekeyfe/hwk-adapter-core';

import {
  type IThirdPartyDeviceErrorPayload,
  convertThirdPartyDeviceError,
} from '@onekeyhq/shared/src/errors/utils/thirdPartyDeviceErrorUtils';
import { hasAnyRequiredLedgerAppInstalled } from '@onekeyhq/shared/src/hardware/config/ledger';
import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import { resolveLedgerInstallFailureAction } from './ledgerCoreAppsReadyUtils';

// Kept as one shape rather than a discriminated union: the SDK responses these
// describe are typed `payload: unknown`, and a union would need a cast to read.
export type ILedgerInstallAppResponse = {
  success: boolean;
  payload?: IThirdPartyDeviceErrorPayload;
};

export type ILedgerInstalledAppNamesResponse = {
  success: boolean;
  payload?: string[] | IThirdPartyDeviceErrorPayload;
};

export interface IInstallLedgerCoreAppsParams {
  apps: readonly string[];
  connectId: string;
  installApp: (params: {
    connectId: string;
    appName: string;
  }) => Promise<ILedgerInstallAppResponse | undefined>;
  listInstalledAppNames: (params: {
    connectId: string;
  }) => Promise<ILedgerInstalledAppNamesResponse | undefined>;
  /** Lets the caller publish queue progress before each app is attempted. */
  onAppStart?: (index: number) => Promise<void> | void;
}

/**
 * Install Ledger apps one by one. A failed install can still have landed the
 * app, so the device is asked before the error is treated as final; a broken
 * secure channel is worth one more attempt on the same session. Everything
 * else throws so the existing error paths handle it. `connectId` is the
 * caller's operation handle and is never swapped — the SDK resolves it, and
 * replacing it here would strand the operation the caller still holds.
 */
export async function installLedgerCoreApps({
  apps,
  connectId,
  installApp,
  listInstalledAppNames,
  onAppStart,
}: IInstallLedgerCoreAppsParams): Promise<void> {
  // Scoped to this call: at most one automatic retry across every app.
  let autoRetryUsed = false;

  const toError = (payload: IThirdPartyDeviceErrorPayload | undefined) =>
    convertThirdPartyDeviceError(
      payload ?? {
        code: ThirdPartyHwErrorCode.UnknownError,
        error: 'Ledger app install failed',
      },
      { vendor: EHardwareVendor.ledger },
    );

  const isAppOnDevice = async (appName: string) => {
    const probe = await listInstalledAppNames({ connectId });
    if (!probe?.success || !Array.isArray(probe.payload)) return false;
    return hasAnyRequiredLedgerAppInstalled({
      installedApps: probe.payload,
      requiredApps: [appName],
    });
  };

  const installOneApp = async (appName: string) => {
    const res = await installApp({ connectId, appName });
    if (res?.success) return;
    const failure = toError(res?.payload);
    const action = resolveLedgerInstallFailureAction({
      code: failure.code,
      autoRetryUsed,
    });
    // The device already answered "it is there", so skip the probe round trip.
    if (action === 'alreadyInstalled') return;
    // A refusal or a dead link is the final answer; probing only adds a round
    // trip on a session that cannot answer.
    if (action === 'terminal') throw failure;
    if (await isAppOnDevice(appName)) return;
    if (action === 'probeThenFail') throw failure;

    autoRetryUsed = true;
    const retry = await installApp({ connectId, appName });
    if (retry?.success) return;
    const retryFailure = toError(retry?.payload);
    const retryAction = resolveLedgerInstallFailureAction({
      code: retryFailure.code,
      autoRetryUsed,
    });
    if (retryAction === 'alreadyInstalled') return;
    // The retry gets the same benefit of the doubt as the first attempt: it
    // may have landed the app and still failed on the catalog fetch.
    if (retryAction !== 'terminal' && (await isAppOnDevice(appName))) return;
    throw retryFailure;
  };

  for (let i = 0; i < apps.length; i += 1) {
    await onAppStart?.(i);
    await installOneApp(apps[i]);
  }
}

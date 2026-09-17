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

export type ILedgerSessionRecoveryResult =
  | { ok: true; connectId: string; installedApps: string[] }
  | { ok: false };

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
  recoverSession: (params: {
    connectId: string;
  }) => Promise<ILedgerSessionRecoveryResult>;
  /** Lets the caller publish queue progress before each app is attempted. */
  onAppStart?: (index: number) => Promise<void> | void;
}

/**
 * Install Ledger apps one by one, probing the device before treating any
 * failure as final: a failed install can still have landed the app, and a
 * broken secure channel is worth rebuilding once. Everything else (network,
 * device disconnect, user cancel) throws so the existing error paths handle it.
 * The one automatic retry is scoped to this call.
 */
export async function installLedgerCoreApps({
  apps,
  connectId,
  installApp,
  listInstalledAppNames,
  recoverSession,
  onAppStart,
}: IInstallLedgerCoreAppsParams): Promise<void> {
  let autoRetryUsed = false;
  // A rebuilt session can land on a new locator (USB Ledger has no persistent
  // one), so later calls follow the recovered value.
  let activeConnectId = connectId;

  const toError = (payload: IThirdPartyDeviceErrorPayload | undefined) =>
    convertThirdPartyDeviceError(
      payload ?? {
        code: ThirdPartyHwErrorCode.UnknownError,
        error: 'Ledger app install failed',
      },
      { vendor: EHardwareVendor.ledger },
    );

  const isAppOnDevice = async (appName: string) => {
    const probe = await listInstalledAppNames({ connectId: activeConnectId });
    if (!probe?.success || !Array.isArray(probe.payload)) return false;
    return hasAnyRequiredLedgerAppInstalled({
      installedApps: probe.payload,
      requiredApps: [appName],
    });
  };

  const installOneApp = async (appName: string) => {
    const res = await installApp({ connectId: activeConnectId, appName });
    if (res?.success) return;
    const failure = toError(res?.payload);
    const action = resolveLedgerInstallFailureAction({
      code: failure.code,
      autoRetryUsed,
    });
    // The device already answered "it is there", so skip the probe round trip.
    if (action === 'alreadyInstalled') return;
    if (await isAppOnDevice(appName)) return;
    if (action === 'fail') {
      throw failure;
    }
    autoRetryUsed = true;
    const recovered = await recoverSession({ connectId: activeConnectId });
    if (!recovered.ok) {
      throw failure;
    }
    activeConnectId = recovered.connectId;
    if (
      hasAnyRequiredLedgerAppInstalled({
        installedApps: recovered.installedApps,
        requiredApps: [appName],
      })
    ) {
      return;
    }
    const retry = await installApp({ connectId: activeConnectId, appName });
    if (retry?.success) return;
    const retryFailure = toError(retry?.payload);
    if (
      resolveLedgerInstallFailureAction({
        code: retryFailure.code,
        autoRetryUsed,
      }) === 'alreadyInstalled'
    ) {
      return;
    }
    throw retryFailure;
  };

  for (let i = 0; i < apps.length; i += 1) {
    await onAppStart?.(i);
    await installOneApp(apps[i]);
  }
}

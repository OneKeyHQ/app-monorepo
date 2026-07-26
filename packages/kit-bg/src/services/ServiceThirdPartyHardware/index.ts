import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { BTC_FIRST_TAPROOT_PATH } from '@onekeyhq/shared/src/consts/chainConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { convertThirdPartyDeviceError } from '@onekeyhq/shared/src/errors/utils/thirdPartyDeviceErrorUtils';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { assertLedgerAttestationRelayUrl } from '@onekeyhq/shared/src/hardware/ledgerAttestationRelayUrl';
import {
  getTrezorSuiteBtcReceivePath,
  getTrezorSuiteDefaultAccountTitleFromPath,
  matchAccountNamesByAddress,
} from '@onekeyhq/shared/src/hardware/thirdPartyAccountNameSync';
import { getVendorProfile } from '@onekeyhq/shared/src/hardware/vendorProfile';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  IThirdPartyAccountNameCandidate,
  IThirdPartyAccountNameCandidatesResult,
  IThirdPartyAccountNameSourceStatus,
} from '@onekeyhq/shared/src/referralCode/type';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';
import thirdPartyDeviceUtils from '@onekeyhq/shared/src/utils/thirdPartyDeviceUtils';
import { EHardwareVendor } from '@onekeyhq/shared/types/device';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';

import localDb from '../../dbs/local/localDb';
import { getEndpointInfo } from '../../endpoints';
import {
  EThirdPartyHardwareUiAction,
  thirdPartyHardwareUiStateAtom,
} from '../../states/jotai/atoms';
import {
  buildTrezorBleFallbackOptions,
  callTrezorWithBleFallback,
} from '../../vaults/base/trezorTransportUtils';
import ServiceBase from '../ServiceBase';
import {
  type IThirdPartyVendor,
  thirdPartyHardwareAdapterRegistry,
} from '../ServiceHardware/adapters/thirdPartyHardwareAdapterRegistry';
import { mapThirdPartyDeviceToSearchDevice } from '../ServiceHardware/thirdPartyDeviceMapping';

import type { IBackgroundApi } from '../../apis/IBackgroundApi';
import type {
  IDBAccount,
  IDBDevice,
  IDBIndexedAccount,
} from '../../dbs/local/types';
import type {
  IAdapterUiResponse,
  IThirdPartyConnectedDevicePayload,
  IThirdPartyHardwareAdapter,
} from '../ServiceHardware/adapters/types';
import type { SearchDevice } from '@onekeyfe/hd-core';
import type { Response } from '@onekeyfe/hwk-adapter-core';

type IThirdPartySearchDevicesResponse =
  | {
      success: true;
      payload: SearchDevice[];
    }
  | {
      success: false;
      payload: {
        code: number;
        error: string;
        params?: {
          permissionDeniedReason: string;
        };
      };
    };

function createThirdPartyAdapterNotRegisteredError(vendor: EHardwareVendor) {
  return new OneKeyLocalError({
    message: appLocale.intl.formatMessage(
      { id: ETranslations.third_party_hw_adapter_not_registered__msg },
      { vendor },
    ),
  });
}

type ITrezorBtcScriptType = 'p2pkh' | 'p2sh' | 'p2wpkh' | 'p2tr';
const DEV_ACCOUNT_NAME_SYNC_AUTHORIZATION_TTL_MS = 5 * 60 * 1000;
const DEV_TREZOR_NAME_SYNC_MAX_PATHS = 40;

function getTrezorBtcScriptTypeFromPath(
  path: string,
): ITrezorBtcScriptType | undefined {
  const purpose = /^m\/(\d+)'/.exec(path.trim())?.[1];
  const scriptTypes: Record<string, ITrezorBtcScriptType> = {
    '44': 'p2pkh',
    '49': 'p2sh',
    '84': 'p2wpkh',
    '86': 'p2tr',
  };
  return purpose ? scriptTypes[purpose] : undefined;
}

function buildAccountNameTargets({
  accounts,
  indexedAccounts,
  onlyBitcoin,
}: {
  accounts: IDBAccount[];
  indexedAccounts: IDBIndexedAccount[];
  onlyBitcoin?: boolean;
}) {
  const indexedAccountById = new Map(
    indexedAccounts.map((account) => [account.id, account]),
  );
  return accounts.flatMap((account) => {
    const indexedAccount = account.indexedAccountId
      ? indexedAccountById.get(account.indexedAccountId)
      : undefined;
    const addresses = new Set<string>(
      [
        account.address,
        ...('addresses' in account ? Object.values(account.addresses) : []),
      ].filter(Boolean),
    );
    if (
      !indexedAccount ||
      addresses.size === 0 ||
      (onlyBitcoin && account.impl !== 'btc')
    ) {
      return [];
    }
    return [...addresses].map((address) => ({
      indexedAccountId: indexedAccount.id,
      currentName: indexedAccount.name,
      address,
      path: account.path,
    }));
  });
}

function stringifyThirdPartySearchDebugValue(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch (error) {
    return JSON.stringify({
      stringifyError: error instanceof Error ? error.message : String(error),
    });
  }
}

function summarizeThirdPartySearchDevice(
  value: unknown,
): Record<string, unknown> {
  const device = value as {
    connectId?: unknown;
    deviceId?: unknown;
    uuid?: unknown;
    name?: unknown;
    model?: unknown;
    connectionType?: unknown;
    raw?: {
      transport?: unknown;
    };
  };
  return {
    connectId: device.connectId,
    deviceId: device.deviceId,
    uuid: device.uuid,
    name: device.name,
    model: device.model,
    connectionType: device.connectionType,
    rawTransport:
      typeof device.raw?.transport === 'string'
        ? device.raw.transport
        : undefined,
  };
}

/**
 * ServiceThirdPartyHardware — owns the third-party (Trezor / Ledger) hardware
 * adapter lifecycle and the third-party-only methods, extracted from
 * ServiceHardware to keep that service focused on OneKey-own hardware. OneKey's
 * own SDK paths, BLE transport binding (getCompatibleConnectId) and device
 * settings all stay in ServiceHardware. Behavior is unchanged — this is a
 * verbatim move plus delegation.
 *
 * "Third-party" = vendors registered in `thirdPartyHardwareAdapterRegistry`.
 */
@backgroundClass()
class ServiceThirdPartyHardware extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: IBackgroundApi }) {
    super({ backgroundApi });
  }

  // Third-party hardware adapters — vendor → adapter via
  // ../ServiceHardware/adapters/thirdPartyHardwareAdapterRegistry. Public facade
  // is getAdapterForVendor(vendor).

  /** Live adapter instances, keyed by vendor name. */
  private thirdPartyAdapters = new Map<
    IThirdPartyVendor,
    IThirdPartyHardwareAdapter
  >();

  /** In-flight init promises so concurrent callers share one factory run. */
  private thirdPartyAdapterInitPromises = new Map<
    IThirdPartyVendor,
    Promise<void>
  >();

  /** In-flight BLE binding dialog request; concurrent callers share it. */
  private _pendingTrezorBleBindingRequest?: {
    usbConnectId: string;
    featuresDeviceId: string;
    promise: Promise<string | null>;
  };

  private _devAccountNameSyncAuthorizations = new Map<
    string,
    {
      expiresAt: number;
      candidates: IThirdPartyAccountNameCandidate[];
    }
  >();

  private async assertThirdPartyOnboardingDevMode(): Promise<void> {
    if (!(await this.isDevModeEnabled())) {
      throw new OneKeyLocalError(
        'Third-party onboarding diagnostics require Developer Mode',
      );
    }
  }

  private createDevAccountNameSyncAuthorization(
    candidates: IThirdPartyAccountNameCandidate[],
  ): string {
    const now = Date.now();
    for (const [id, authorization] of this._devAccountNameSyncAuthorizations) {
      if (authorization.expiresAt <= now) {
        this._devAccountNameSyncAuthorizations.delete(id);
      }
    }
    const authorizationId = generateUUID();
    this._devAccountNameSyncAuthorizations.set(authorizationId, {
      expiresAt: now + DEV_ACCOUNT_NAME_SYNC_AUTHORIZATION_TTL_MS,
      candidates,
    });
    return authorizationId;
  }

  private isRegisteredThirdPartyVendor(
    vendor: string | undefined,
  ): vendor is IThirdPartyVendor {
    return (
      !!vendor &&
      Object.prototype.hasOwnProperty.call(
        thirdPartyHardwareAdapterRegistry,
        vendor,
      )
    );
  }

  private async ensureThirdPartyAdapterInitialized(
    vendor: IThirdPartyVendor,
  ): Promise<void> {
    if (this.thirdPartyAdapters.has(vendor)) return;
    let p = this.thirdPartyAdapterInitPromises.get(vendor);
    if (!p) {
      const factory = thirdPartyHardwareAdapterRegistry[vendor];
      p = factory()
        .then((adapter) => {
          this.thirdPartyAdapters.set(vendor, adapter);
        })
        .catch((error) => {
          defaultLogger.hardware.sdkLog.log(
            `[ServiceThirdPartyHardware] Failed to init ${vendor} adapter: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
          throw error;
        })
        .finally(() => {
          // Drop inflight marker so a subsequent call can re-attempt.
          this.thirdPartyAdapterInitPromises.delete(vendor);
        });
      this.thirdPartyAdapterInitPromises.set(vendor, p);
    }
    await p;
  }

  /**
   * Ensure the adapter for `vendor` is initialized. If no vendor is given,
   * initialize every registered third-party adapter (used by discovery paths).
   */
  async ensureAdaptersInitialized(vendor?: string): Promise<void> {
    if (this.isRegisteredThirdPartyVendor(vendor)) {
      await this.ensureThirdPartyAdapterInitialized(vendor);
      return;
    }
    await Promise.allSettled(
      (
        Object.keys(thirdPartyHardwareAdapterRegistry) as IThirdPartyVendor[]
      ).map((v) => this.ensureThirdPartyAdapterInitialized(v)),
    );
  }

  /**
   * Get the in-memory adapter for a vendor (does NOT trigger init).
   * Use after ensureAdaptersInitialized().
   */
  private getThirdPartyAdapter(
    vendor: string,
  ): IThirdPartyHardwareAdapter | undefined {
    if (!this.isRegisteredThirdPartyVendor(vendor)) return undefined;
    return this.thirdPartyAdapters.get(vendor);
  }

  /** Reset the adapter and evict it from the registry (use instead of adapter.reset() directly). */
  resetThirdPartyAdapter(vendor: string): void {
    if (!this.isRegisteredThirdPartyVendor(vendor)) return;
    const adapter = this.thirdPartyAdapters.get(vendor);
    if (!adapter) return;
    try {
      adapter.reset();
    } finally {
      this.thirdPartyAdapters.delete(vendor);
    }
  }

  /**
   * Get the adapter for a specific vendor.
   * NOTE: Not decorated with @backgroundMethod because the returned adapter
   * is a non-serializable object. Only call from in-process code (keyrings).
   */
  async getAdapterForVendor(
    vendor: EHardwareVendor,
  ): Promise<IThirdPartyHardwareAdapter | undefined> {
    await this.ensureAdaptersInitialized(vendor);
    return this.getThirdPartyAdapter(vendor);
  }

  /**
   * Trezor USB→BLE binding. Mirror of
   * `ServiceHardware.repairBleConnectIdWithProgress`, but device_id-based:
   * Trezor has no `ble_name`, so the host CANNOT identify a BLE device at scan
   * stage — it must CONNECT and read `device_id`. The UI scans BLE
   * (`searchDevices({ vendor: trezor })`), lists candidates, and the user picks
   * `bleConnectId`. We connect to it — the user's OWN device auto-connects via the
   * shared THP credential (no pairing) — read its `device_id`, and if it matches
   * the USB-known device we persist `bleConnectId` on the SAME DB record. A
   * different device (device_id mismatch, or it asks to pair) → return null so
   * the UI says "not this one, pick another".
   *
   * Trezor-only by construction (uses the trezor adapter); never touches the
   * OneKey / Ledger BLE paths.
   */
  @backgroundMethod()
  async bindTrezorBleConnectId({
    usbConnectId,
    featuresDeviceId,
    bleConnectId,
  }: {
    usbConnectId: string;
    featuresDeviceId: string;
    bleConnectId: string;
  }): Promise<string | null> {
    const adapter = await this.getAdapterForVendor(EHardwareVendor.trezor);
    if (!adapter) {
      throw new OneKeyLocalError({
        message: appLocale.intl.formatMessage({
          id: ETranslations.trezor_adapter_not_available__msg,
        }),
      });
    }

    // A picked candidate that ISN'T this device asks to pair (its static key
    // doesn't match the shared credential). Suppress the THP pairing dialog and
    // cancel silently during the probe — treat the pairing request as "not this
    // one". Handled inside the adapter so it overrides its own pairing UI
    // (a second listener can't stop the adapter's own handler from firing).
    adapter.beginBindingProbe?.(bleConnectId);

    try {
      const result = await adapter.connectDevice(bleConnectId);
      if (!result.success) {
        // Probe suppressed the pairing request — "not this device", not an error.
        if (adapter.wasBindingProbeCancelled?.()) {
          defaultLogger.hardware.sdkLog.log(
            `[TrezorBLEBind] candidate rejected by probe cancel bleConnectId=${bleConnectId}`,
          );
          return null;
        }
        defaultLogger.hardware.sdkLog.log(
          `[TrezorBLEBind] candidate probe failed bleConnectId=${bleConnectId}`,
        );
        throw convertThirdPartyDeviceError(result.payload, {
          vendor: EHardwareVendor.trezor,
        });
      }
      if (result.payload.deviceId !== featuresDeviceId) {
        defaultLogger.hardware.sdkLog.log(
          `[TrezorBLEBind] candidate rejected bleConnectId=${bleConnectId} expectedDeviceId=${featuresDeviceId} actualDeviceId=${result.payload.deviceId}`,
        );
        return null;
      }
      const device = await localDb.getDeviceByQuery({
        connectId: usbConnectId,
        featuresDeviceId,
        vendor: EHardwareVendor.trezor,
      });
      if (!device) {
        // Matched but our DB record is missing — internal error, not a mismatch.
        defaultLogger.hardware.sdkLog.log(
          `[TrezorBLEBind] candidate matched but db device missing usbConnectId=${usbConnectId} deviceId=${featuresDeviceId}`,
        );
        throw new OneKeyLocalError({
          message: appLocale.intl.formatMessage({
            id: ETranslations.hardware_connect_failed,
          }),
          autoToast: true,
        });
      }
      await localDb.updateDeviceConnectId({
        dbDeviceId: device.id,
        bleConnectId,
      });
      // The DB write emits nothing on its own; notify the device-details UI so
      // the "bind Bluetooth" row reflects the new bleConnectId immediately.
      appEventBus.emit(EAppEventBusNames.HardwareFeaturesUpdate, {
        deviceId: device.id,
      });
      defaultLogger.hardware.sdkLog.log(
        `[TrezorBLEBind] candidate matched bleConnectId=${bleConnectId} deviceId=${featuresDeviceId}`,
      );
      defaultLogger.hardware.sdkLog.log(
        `[3rdPartyHW][Trezor] bound BLE connectId=${bleConnectId} to device_id=${featuresDeviceId}`,
      );
      return bleConnectId;
    } finally {
      adapter.endBindingProbe?.();
      await adapter.disconnect(bleConnectId).catch(() => undefined);
    }
  }

  /**
   * Business-call Trezor transport recovery. The picker may return a newly
   * bound BLE connectId, or the known USB connectId if USB is restored.
   */
  private async connectTrezorAndVerifyDeviceIdentity({
    device,
    connectId,
  }: {
    device: IDBDevice;
    connectId: string;
  }): Promise<Response<IThirdPartyConnectedDevicePayload>> {
    const adapter = await this.getAdapterForVendor(EHardwareVendor.trezor);
    if (!adapter) {
      throw createThirdPartyAdapterNotRegisteredError(EHardwareVendor.trezor);
    }
    const connected = await adapter.connectDevice(connectId);
    if (!connected.success) {
      return connected;
    }
    const expectedDeviceId = device.deviceId.trim().toLowerCase();
    const liveDeviceId = connected.payload.deviceId.trim().toLowerCase();
    if (!liveDeviceId || liveDeviceId !== expectedDeviceId) {
      await adapter.disconnect(connectId).catch(() => undefined);
      throw new OneKeyLocalError(
        'The recovered Trezor device does not match the selected device',
      );
    }
    return connected;
  }

  private async verifyRecoveredTrezorDeviceIdentity({
    device,
    connectId,
  }: {
    device: IDBDevice;
    connectId: string;
  }): Promise<string> {
    const connected = await this.connectTrezorAndVerifyDeviceIdentity({
      device,
      connectId,
    });
    if (!connected.success) {
      throw convertThirdPartyDeviceError(connected.payload, {
        vendor: 'Trezor',
      });
    }
    return connectId;
  }

  async requestTrezorBleConnectIdForDevice({
    device,
  }: {
    device: IDBDevice;
  }): Promise<string | null> {
    if (
      !thirdPartyDeviceUtils.isTrezorBleBindingSupportedPlatform(platformEnv)
    ) {
      defaultLogger.hardware.sdkLog.log(
        '[3rdPartyHW][Trezor] skip BLE binding request: platform does not support Trezor BLE binding',
      );
      return null;
    }
    const usbConnectId = device.usbConnectId || device.connectId;
    const featuresDeviceId = device.deviceId;
    if (!usbConnectId || !featuresDeviceId) {
      defaultLogger.hardware.sdkLog.log(
        `[3rdPartyHW][Trezor] skip BLE binding request: usbConnectId=${String(
          usbConnectId,
        )} device_id=${String(featuresDeviceId)}`,
      );
      return null;
    }

    // One binding dialog at a time: same device joins it, another device gives up.
    const pending = this._pendingTrezorBleBindingRequest;
    if (pending) {
      if (
        pending.usbConnectId === usbConnectId &&
        pending.featuresDeviceId === featuresDeviceId
      ) {
        defaultLogger.hardware.sdkLog.log(
          `[3rdPartyHW][Trezor] joining in-flight BLE binding request usbConnectId=${usbConnectId}`,
        );
        return pending.promise;
      }
      defaultLogger.hardware.sdkLog.log(
        `[3rdPartyHW][Trezor] skip BLE binding request: another binding in flight (usbConnectId=${pending.usbConnectId})`,
      );
      return null;
    }

    const requestPromise = new Promise<string | null>((resolve, reject) => {
      const promiseId = this.backgroundApi.servicePromise.createCallback({
        resolve,
        reject,
      });

      void thirdPartyHardwareUiStateAtom.set({
        action: EThirdPartyHardwareUiAction.requestTrezorBleBinding,
        vendor: EHardwareVendor.trezor,
        payload: {
          usbConnectId,
          featuresDeviceId,
          promiseId,
          trezorBleBindingMode: 'auto-fallback',
        },
      });
    }).then((bleConnectId) =>
      bleConnectId
        ? this.verifyRecoveredTrezorDeviceIdentity({
            device,
            connectId: bleConnectId,
          })
        : null,
    );

    const record = { usbConnectId, featuresDeviceId, promise: requestPromise };
    this._pendingTrezorBleBindingRequest = record;
    try {
      return await requestPromise;
    } finally {
      if (this._pendingTrezorBleBindingRequest === record) {
        this._pendingTrezorBleBindingRequest = undefined;
      }
    }
  }

  /**
   * Flush a Trezor device's buffered THP pairing credentials into its DB
   * settings. Credentials are minted at pairing — which happens during
   * createHWWallet, before the device record exists — so they're buffered in
   * the adapter and persisted here once the record is created. Idempotent and a
   * no-op if nothing was buffered. Trezor-only.
   */
  @backgroundMethod()
  async persistTrezorThpCredentials({
    connectId,
    deviceId,
  }: {
    connectId?: string;
    deviceId: string;
  }): Promise<void> {
    const adapter = await this.getAdapterForVendor(EHardwareVendor.trezor);
    defaultLogger.hardware.sdkLog.log(
      `[TrezorTHPTrace][service.persist] connectId=${String(
        connectId,
      )} deviceId=${deviceId}`,
    );
    await adapter?.flushThpCredentials?.(deviceId, { connectId });
  }

  /**
   * Tear down the cached Trezor adapter so the next `getAdapterForVendor`
   * rebuilds it and warm-loads THP credentials fresh from the DB (credentials
   * are seeded into the connector once at adapter creation, so a DB mutation
   * only takes effect after recreation). Awaits the adapter's own `dispose()`
   * first so the connector releases the USB handle (close + releaseInterface) —
   * dropping the Map reference alone would leak the open device and break the
   * next connect. Connection lifecycle stays inside the SDK; we only ask it to
   * dispose. DEV-only helper for the THP debug tools.
   */
  private async disposeTrezorAdapterCache() {
    const vendor = EHardwareVendor.trezor;
    if (!this.isRegisteredThirdPartyVendor(vendor)) return;
    const adapter = this.thirdPartyAdapters.get(vendor);
    this.thirdPartyAdapters.delete(vendor);
    this.thirdPartyAdapterInitPromises.delete(vendor);
    try {
      await adapter?.hw?.dispose?.();
    } catch (error) {
      defaultLogger.hardware.sdkLog.log(
        `[ServiceThirdPartyHardware] trezor adapter dispose failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /**
   * DEV-ONLY. Corrupt this Trezor's stored THP pairing credentials so the device
   * rejects them on the next handshake — used to reproduce/inspect pairing-loss
   * recovery. Keeps the credential shape valid (still shipped to the device) but
   * fills the `credential` blob with random hex. No-op when nothing is stored.
   * Trezor-only. Gated behind developer mode in the UI.
   */
  @backgroundMethod()
  async devCorruptTrezorThpCredentials({
    dbDeviceId,
  }: {
    dbDeviceId: string;
  }): Promise<{ corrupted: number }> {
    const device = await localDb.getDevice(dbDeviceId);
    const credentials = device.settings?.thpCredentials ?? [];
    if (!credentials.length) {
      return { corrupted: 0 };
    }
    const corrupted = credentials.map((cred) => {
      const next = { ...cred };
      if (typeof next.credential === 'string' && next.credential.length > 0) {
        next.credential = stringUtils.randomString(next.credential.length, {
          chars: '0123456789abcdef',
        });
      }
      return next;
    });
    await localDb.updateDeviceThpCredentials({
      dbDeviceId,
      credentials: corrupted,
    });
    await this.disposeTrezorAdapterCache();
    return { corrupted: corrupted.length };
  }

  /**
   * DEV-ONLY. Clear this Trezor's stored THP credentials + bleConnectId so the
   * next connect forces a fresh pairing. Trezor-only. Gated behind developer
   * mode in the UI.
   */
  @backgroundMethod()
  async devClearTrezorThpState({
    dbDeviceId,
  }: {
    dbDeviceId: string;
  }): Promise<void> {
    await localDb.clearTrezorDeviceThpState({ dbDeviceId });
    await this.disposeTrezorAdapterCache();
  }

  /**
   * Standard-wallet first EVM address for a third-party device, via its adapter.
   * ServiceHardware.getEvmAddressByStandardWallet delegates here for third-party
   * vendors and keeps the OneKey SDK path itself. Unsupported/no-adapter still
   * returns null, but SDK failures are converted and thrown so wallet-state
   * mismatch cannot be silently treated as "no address".
   */
  @backgroundMethod()
  async getEvmAddressByWalletState(params: {
    connectId: string;
    deviceId: string;
    path: string;
    vendor: EHardwareVendor;
    passphraseState?: string;
    useEmptyPassphrase?: boolean;
  }): Promise<string | null> {
    try {
      const adapter = await this.getAdapterForVendor(params.vendor);
      if (!adapter) return null;
      const result = await adapter.hw.evmGetAddress(
        params.connectId,
        params.deviceId,
        {
          path: params.path,
          showOnDevice: false,
          passphraseState: params.passphraseState,
          useEmptyPassphrase: params.useEmptyPassphrase,
        },
      );
      if (result.success) {
        return result.payload.address || null;
      }
      throw convertThirdPartyDeviceError(result.payload, {
        vendor: params.vendor,
        chain: 'evm',
      });
    } catch (error) {
      defaultLogger.hardware.sdkLog.log(
        `[3rdPartyHW] getEvmAddressByStandardWallet failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      throw error;
    }
  }

  @backgroundMethod()
  async getEvmAddressByStandardWallet(params: {
    connectId: string;
    deviceId: string;
    path: string;
    vendor: EHardwareVendor;
  }): Promise<string | null> {
    return this.getEvmAddressByWalletState({
      ...params,
      useEmptyPassphrase: true,
    });
  }

  /**
   * Build the wallet XFP (master fingerprint + first taproot xpub) for a
   * third-party device via its adapter. Mirrors ServiceHardware.buildHwWalletXfp
   * but sources both values from the vendor adapter's btc methods. The master
   * fingerprint depends on the passphrase, so a hidden wallet must pass its
   * passphraseState; a standard wallet uses the empty passphrase.
   */
  @backgroundMethod()
  async buildHwWalletXfp(params: {
    connectId: string;
    deviceId: string;
    vendor: EHardwareVendor;
    passphraseState?: string;
  }): Promise<string | undefined> {
    const { connectId, deviceId, vendor, passphraseState } = params;
    const adapter = await this.getAdapterForVendor(vendor);
    if (!adapter) return undefined;
    const passphraseParams = {
      passphraseState: passphraseState || undefined,
      useEmptyPassphrase: passphraseState ? undefined : true,
    };
    const fingerprintResult = await adapter.hw.btcGetMasterFingerprint(
      connectId,
      deviceId,
      passphraseParams,
    );
    if (!fingerprintResult.success) {
      throw convertThirdPartyDeviceError(fingerprintResult.payload, {
        vendor,
        chain: 'btc',
      });
    }
    const publicKeyResult = await adapter.hw.btcGetPublicKey(
      connectId,
      deviceId,
      {
        path: BTC_FIRST_TAPROOT_PATH,
        showOnDevice: false,
        ...passphraseParams,
      },
    );
    if (!publicKeyResult.success) {
      throw convertThirdPartyDeviceError(publicKeyResult.payload, {
        vendor,
        chain: 'btc',
      });
    }
    return accountUtils.buildFullXfp({
      xfp: fingerprintResult.payload.masterFingerprint.replace(/^0x/, ''),
      firstTaprootXpub: publicKeyResult.payload.xpub,
    });
  }

  /**
   * Trezor hidden wallet passphraseState resolution. This must go through the
   * Trezor adapter because OneKey's core SDK does not own Trezor THP sessions.
   */
  @backgroundMethod()
  async getTrezorPassphraseState({
    connectId,
    passphraseState,
    dbDevice,
  }: {
    connectId: string;
    passphraseState?: string;
    dbDevice?: IDBDevice;
  }): Promise<string | null> {
    const adapter = await this.getAdapterForVendor(EHardwareVendor.trezor);
    const getPassphraseState = adapter?.hw.getPassphraseState?.bind(adapter.hw);
    if (!getPassphraseState) {
      throw new OneKeyLocalError({
        message: appLocale.intl.formatMessage({
          id: ETranslations.trezor_passphrase_state_not_supported__msg,
        }),
      });
    }
    // Mirror the signing path: resolve the passphrase state with USB→BLE
    // fallback so a BLE-only Trezor doesn't fail with DeviceNotFound. Without a
    // dbDevice (older callers) keep the plain single-connectId call.
    const result = dbDevice
      ? await callTrezorWithBleFallback(
          dbDevice,
          (cid) => getPassphraseState(cid, passphraseState),
          buildTrezorBleFallbackOptions(this.backgroundApi),
        )
      : await getPassphraseState(connectId, passphraseState);
    if (result.success) {
      return result.payload;
    }
    const payload = result.payload as {
      code?: number;
      error?: string;
      appName?: string;
      params?: Record<string, unknown>;
      _tag?: string;
    };
    if (typeof payload.code === 'number' && typeof payload.error === 'string') {
      throw convertThirdPartyDeviceError(
        {
          code: payload.code,
          error: payload.error,
          appName: payload.appName,
          params: payload.params,
          _tag: payload._tag,
        },
        {
          vendor: EHardwareVendor.trezor,
        },
      );
    }
    throw new OneKeyLocalError({
      message: appLocale.intl.formatMessage({
        id: ETranslations.trezor_get_passphrase_state_failed__msg,
      }),
    });
  }

  /**
   * Third-party device discovery. Only handles registered third-party vendors;
   * ServiceHardware.searchDevices delegates here when the vendor is third-party
   * and keeps the OneKey SDK path itself.
   */
  @backgroundMethod()
  async searchDevices(params: {
    vendor: EHardwareVendor;
    resetSession?: boolean;
    waitForAllTransports?: boolean;
    transportType?: 'usb' | 'ble';
  }): Promise<IThirdPartySearchDevicesResponse> {
    const serviceStartedAt = Date.now();
    const vendorProfile = getVendorProfile(params.vendor);
    try {
      await this.ensureAdaptersInitialized(params.vendor);
      const adapter = this.getThirdPartyAdapter(params.vendor);
      if (!adapter) {
        // Vendor is registered but adapter slot is empty — registry bug,
        // not a transient init failure. Surface explicitly.
        throw createThirdPartyAdapterNotRegisteredError(params.vendor);
      }
      const adapterStartedAt = Date.now();
      const adapterSearchOptions =
        params.resetSession ||
        params.waitForAllTransports ||
        params.transportType
          ? {
              resetSession: params.resetSession,
              waitForAllTransports: params.waitForAllTransports,
              transportType: params.transportType,
            }
          : undefined;
      const devices = await adapter.searchDevices(adapterSearchOptions);
      const filteredDevices = params.transportType
        ? devices.filter(
            (device) => device.connectionType === params.transportType,
          )
        : devices;
      if (filteredDevices.length !== devices.length) {
        defaultLogger.hardware.sdkLog.log(
          `[3rdPartyHW] searchDevices.filtered ${stringifyThirdPartySearchDebugValue(
            {
              vendor: params.vendor,
              transportType: params.transportType,
              rawCount: devices.length,
              filteredCount: filteredDevices.length,
              dropped: devices
                .filter(
                  (device) => device.connectionType !== params.transportType,
                )
                .map(summarizeThirdPartySearchDevice),
              kept: filteredDevices.map(summarizeThirdPartySearchDevice),
            },
          )}`,
        );
      }
      defaultLogger.hardware.sdkLog.log(
        `[3rdPartyHW] searchDevices vendor=${params.vendor} rawCount=${
          devices.length
        } adapterDurationMs=${Date.now() - adapterStartedAt} totalDurationMs=${
          Date.now() - serviceStartedAt
        } resetSession=${String(
          params.resetSession === true,
        )} waitForAllTransports=${String(
          params.waitForAllTransports === true,
        )} transportType=${params.transportType ?? '-'}`,
      );
      defaultLogger.hardware.sdkLog.log(
        `[3rdPartyHW] searchDevices vendor=${params.vendor} filteredCount=${
          filteredDevices.length
        } totalDurationMs=${Date.now() - serviceStartedAt}`,
      );
      defaultLogger.hardware.sdkLog.thirdPartySearchDevicesResponse({
        vendor: params.vendor,
        success: true,
        count: filteredDevices.length,
      });
      const payload = filteredDevices.map((d) =>
        mapThirdPartyDeviceToSearchDevice({
          device: d,
          defaultDeviceName: vendorProfile.defaultDeviceName,
          canMatchDeviceByConnectId: (connectId) =>
            vendorProfile.canMatchDeviceByConnectId(connectId),
          hasPersistentConnectId: (transport) =>
            vendorProfile.hasPersistentConnectId(transport),
          hasPersistentDeviceId: (transport) =>
            vendorProfile.hasPersistentDeviceId(transport),
        }),
      );
      defaultLogger.hardware.sdkLog.log(
        `[3rdPartyHW] searchDevices vendor=${params.vendor} mappedCount=${
          payload.length
        } totalDurationMs=${Date.now() - serviceStartedAt}`,
      );

      return {
        success: true as const,
        payload,
      };
    } catch (error) {
      // Preserve HWK's structured error (code + message) so downstream
      // can route to the correct error class.
      const err = error as { code?: number | string; message?: string };
      const rawCode =
        typeof err?.code === 'number' ? err.code : Number(err?.code);
      const permissionDeniedReason = (err as { reason?: string }).reason;
      return {
        success: false as const,
        payload: {
          code: Number.isFinite(rawCode) ? rawCode : -1,
          error: err?.message ?? String(error),
          params:
            typeof permissionDeniedReason === 'string'
              ? {
                  permissionDeniedReason,
                }
              : undefined,
        },
      };
    }
  }

  @backgroundMethod()
  async thirdPartyHardwareUiResponse(params: {
    vendor: EHardwareVendor;
    response: IAdapterUiResponse;
  }) {
    await this.ensureAdaptersInitialized(params.vendor);
    const adapter = this.getThirdPartyAdapter(params.vendor);
    if (!adapter) return;
    adapter.uiResponse(params.response);
  }

  @backgroundMethod()
  async connectDevice(params: {
    vendor: EHardwareVendor;
    connectId: string;
  }): Promise<
    | {
        success: true;
        payload: IThirdPartyConnectedDevicePayload;
      }
    | {
        success: false;
        payload: unknown;
      }
  > {
    await this.ensureAdaptersInitialized(params.vendor);
    const adapter = this.getThirdPartyAdapter(params.vendor);
    if (!adapter) {
      throw createThirdPartyAdapterNotRegisteredError(params.vendor);
    }
    return adapter.connectDevice(params.connectId);
  }

  @backgroundMethod()
  async thirdPartyHardwareCancel(params: {
    vendor: EHardwareVendor;
    connectId?: string;
  }) {
    await this.ensureAdaptersInitialized(params.vendor);
    const adapter = this.getThirdPartyAdapter(params.vendor);
    if (!adapter) return;
    adapter.cancel(params.connectId);
  }

  // ---------------------------------------------------------------------------
  // Third-party hardware app management (Ledger-only for now).
  //
  // Wraps the SDK's `LedgerAdapter.installApp / listInstalledApps /
  // listAvailableApps`. The `hw` field on IThirdPartyHardwareAdapter is typed
  // as the generic IHardwareWallet; we cast to the Ledger-specific shape
  // because these methods aren't part of the cross-vendor contract.
  //
  // Install progress is forwarded via appEventBus
  // (`ThirdPartyHardwareAppInstallProgress`) from the adapter wrapper — it
  // cannot ride through these @backgroundMethod return values because the
  // function callback contract doesn't survive the IPC proxy.
  // ---------------------------------------------------------------------------

  @backgroundMethod()
  async thirdPartyHardwareInstallApp(params: {
    vendor: EHardwareVendor;
    connectId: string;
    appName: string;
  }) {
    await this.ensureAdaptersInitialized(params.vendor);
    const adapter = this.getThirdPartyAdapter(params.vendor);
    if (!adapter) {
      throw createThirdPartyAdapterNotRegisteredError(params.vendor);
    }
    const hw = adapter.hw as unknown as {
      installApp: (
        connectId: string,
        appName: string,
      ) => Promise<{ success: boolean; payload: unknown }>;
    };
    return hw.installApp(params.connectId, params.appName);
  }

  @backgroundMethod()
  async thirdPartyHardwareListInstalledApps(params: {
    vendor: EHardwareVendor;
    connectId: string;
  }) {
    await this.ensureAdaptersInitialized(params.vendor);
    const adapter = this.getThirdPartyAdapter(params.vendor);
    if (!adapter) {
      throw createThirdPartyAdapterNotRegisteredError(params.vendor);
    }
    const hw = adapter.hw as unknown as {
      listInstalledApps: (
        connectId: string,
      ) => Promise<{ success: boolean; payload: unknown }>;
    };
    return hw.listInstalledApps(params.connectId);
  }

  @backgroundMethod()
  async thirdPartyHardwareListInstalledAppNames(params: {
    vendor: EHardwareVendor;
    connectId: string;
  }) {
    await this.ensureAdaptersInitialized(params.vendor);
    const adapter = this.getThirdPartyAdapter(params.vendor);
    if (!adapter) {
      throw createThirdPartyAdapterNotRegisteredError(params.vendor);
    }
    const hw = adapter.hw as unknown as {
      listInstalledNames: (
        connectId: string,
      ) => Promise<{ success: boolean; payload: unknown }>;
    };
    return hw.listInstalledNames(params.connectId);
  }

  @backgroundMethod()
  async thirdPartyHardwareListAvailableApps(params: {
    vendor: EHardwareVendor;
    connectId: string;
  }) {
    await this.ensureAdaptersInitialized(params.vendor);
    const adapter = this.getThirdPartyAdapter(params.vendor);
    if (!adapter) {
      throw createThirdPartyAdapterNotRegisteredError(params.vendor);
    }
    const hw = adapter.hw as unknown as {
      listAvailableApps: (
        connectId: string,
      ) => Promise<{ success: boolean; payload: unknown }>;
    };
    return hw.listAvailableApps(params.connectId);
  }

  @backgroundMethod()
  async thirdPartyHardwareGetFirmwareVersion(params: {
    vendor: EHardwareVendor;
    connectId: string;
  }) {
    await this.ensureAdaptersInitialized(params.vendor);
    const adapter = this.getThirdPartyAdapter(params.vendor);
    if (!adapter) {
      throw createThirdPartyAdapterNotRegisteredError(params.vendor);
    }
    const hw = adapter.hw as unknown as {
      getLedgerFirmwareVersion: (
        connectId: string,
      ) => Promise<{ success: boolean; payload: unknown }>;
    };
    return hw.getLedgerFirmwareVersion(params.connectId);
  }

  // Device attestation for diagnostics and reward proof collection. Reward
  // issuance must be decided by the backend from the raw Trezor proof or the
  // server-owned Ledger relay session, never from the client's verified flag.
  @backgroundMethod()
  async thirdPartyHardwareVerifyDeviceAuthenticity(params: {
    vendor: EHardwareVendor;
    connectId: string;
    dbDeviceId?: string;
    challenge?: string;
    ledgerGenuineCheckWebSocketUrl?: string;
  }) {
    if (
      params.vendor === EHardwareVendor.ledger &&
      params.ledgerGenuineCheckWebSocketUrl
    ) {
      const { endpoint } = await getEndpointInfo({
        name: EServiceEndpointEnum.Rebate,
      });
      assertLedgerAttestationRelayUrl({
        relayUrl: params.ledgerGenuineCheckWebSocketUrl,
        rebateEndpoint: endpoint,
      });
    } else if (params.ledgerGenuineCheckWebSocketUrl) {
      throw new OneKeyLocalError(
        'Ledger attestation relay cannot be used for this vendor',
      );
    }
    await this.ensureAdaptersInitialized(params.vendor);
    const adapter = this.getThirdPartyAdapter(params.vendor);
    if (!adapter) {
      throw createThirdPartyAdapterNotRegisteredError(params.vendor);
    }
    const hw = adapter.hw as unknown as {
      verifyDeviceAuthenticity: (
        connectId: string,
        options?: {
          challenge?: string;
          ledgerGenuineCheckWebSocketUrl?: string;
        },
      ) => Promise<Response<unknown>>;
    };
    const verify = (connectId: string) =>
      hw.verifyDeviceAuthenticity(connectId, {
        challenge: params.challenge,
        ledgerGenuineCheckWebSocketUrl: params.ledgerGenuineCheckWebSocketUrl,
      });
    if (params.vendor === EHardwareVendor.trezor && params.dbDeviceId) {
      const dbDevice = await localDb.getDevice(params.dbDeviceId);
      if (dbDevice.vendor !== EHardwareVendor.trezor) {
        throw new OneKeyLocalError(
          'The selected device is not a Trezor device',
        );
      }
      const verifySelectedDevice = async (connectId: string) => {
        const connected = await this.connectTrezorAndVerifyDeviceIdentity({
          device: dbDevice,
          connectId,
        });
        if (!connected.success) {
          return connected;
        }
        return verify(connectId);
      };
      return callTrezorWithBleFallback(
        dbDevice,
        verifySelectedDevice,
        buildTrezorBleFallbackOptions(this.backgroundApi),
      );
    }
    return verify(params.connectId);
  }

  /**
   * Developer-only device-details flow. It deliberately does not use the
   * current page's walletId:
   * - Ledger Live names are matched against every local indexed account.
   * - Trezor derives the standard BTC receive addresses from the connected
   *   device, then applies Suite's deterministic "Bitcoin #N" default title
   *   only where the returned address exists in OneKey.
   */
  @backgroundMethod()
  async getThirdPartyGlobalAccountNameCandidates(params: {
    vendor: EHardwareVendor;
    dbDeviceId?: string;
  }): Promise<IThirdPartyAccountNameCandidatesResult> {
    await this.assertThirdPartyOnboardingDevMode();
    if (
      params.vendor !== EHardwareVendor.trezor &&
      params.vendor !== EHardwareVendor.ledger
    ) {
      return { status: 'unsupported_source', candidates: [] };
    }

    const [{ accounts }, { indexedAccounts }] = await Promise.all([
      this.backgroundApi.serviceAccount.getAllAccounts({
        filterRemoved: true,
      }),
      this.backgroundApi.serviceAccount.getAllIndexedAccounts({
        filterRemoved: true,
      }),
    ]);

    if (params.vendor === EHardwareVendor.ledger) {
      if (!platformEnv.isDesktop || !globalThis.desktopApiProxy?.system) {
        return { status: 'unsupported_source', candidates: [] };
      }
      const source =
        await globalThis.desktopApiProxy.system.readLedgerLiveAccountNames();
      if (source.status !== 'available') {
        const statusMap: Record<
          Exclude<typeof source.status, 'available'>,
          IThirdPartyAccountNameSourceStatus
        > = {
          no_accounts: 'no_matches',
          source_not_found: 'source_not_found',
          encrypted_source: 'encrypted_source',
          invalid_source: 'invalid_source',
        };
        return { status: statusMap[source.status], candidates: [] };
      }
      const targets = buildAccountNameTargets({
        accounts,
        indexedAccounts,
      });
      const candidates = matchAccountNamesByAddress({
        sourceAccounts: source.accounts,
        targetAccounts: targets,
      }).map((candidate) => ({
        ...candidate,
        source: 'ledger-live' as const,
      }));
      return {
        status: candidates.length ? 'available' : 'no_matches',
        candidates,
        authorizationId: candidates.length
          ? this.createDevAccountNameSyncAuthorization(candidates)
          : undefined,
      };
    }

    if (!params.dbDeviceId) {
      return { status: 'no_matches', candidates: [] };
    }
    const dbDevice = await localDb
      .getDevice(params.dbDeviceId)
      .catch(() => undefined);
    if (!dbDevice || dbDevice.vendor !== EHardwareVendor.trezor) {
      return { status: 'no_matches', candidates: [] };
    }

    const targets = buildAccountNameTargets({
      accounts,
      indexedAccounts,
      onlyBitcoin: true,
    });
    const titleByPath = new Map<string, string>();
    for (const target of targets) {
      const title = getTrezorSuiteDefaultAccountTitleFromPath(target.path);
      const receivePath = getTrezorSuiteBtcReceivePath(target.path);
      if (title && receivePath) {
        titleByPath.set(receivePath, title);
      }
    }
    if (titleByPath.size === 0) {
      return { status: 'no_matches', candidates: [] };
    }

    await this.ensureAdaptersInitialized(EHardwareVendor.trezor);
    const adapter = this.getThirdPartyAdapter(EHardwareVendor.trezor);
    if (!adapter) {
      throw createThirdPartyAdapterNotRegisteredError(EHardwareVendor.trezor);
    }

    const sourceAccounts: Array<{ name: string; address: string }> = [];
    const pathsToDerive = [...titleByPath].slice(
      0,
      DEV_TREZOR_NAME_SYNC_MAX_PATHS,
    );
    // Fail the scan as a unit. A partial candidate set is easy to mistake for
    // a complete sync in this developer UI.
    for (const [path, name] of pathsToDerive) {
      const scriptType = getTrezorBtcScriptTypeFromPath(path);
      if (scriptType) {
        const response = await callTrezorWithBleFallback(
          dbDevice,
          (connectId) =>
            adapter.hw.btcGetAddress(connectId, dbDevice.deviceId, {
              path,
              coin: 'btc',
              scriptType,
              showOnDevice: false,
              useEmptyPassphrase: true,
            }),
          buildTrezorBleFallbackOptions(this.backgroundApi),
        );
        if (!response.success) {
          throw convertThirdPartyDeviceError(response.payload, {
            vendor: 'Trezor',
            chain: 'Bitcoin',
          });
        }
        if (response.payload.address) {
          sourceAccounts.push({
            name,
            address: response.payload.address,
          });
        }
      }
    }

    const candidates = matchAccountNamesByAddress({
      sourceAccounts,
      targetAccounts: targets,
    }).map((candidate) => ({
      ...candidate,
      source: 'trezor-device-default' as const,
    }));
    return {
      status: candidates.length ? 'available' : 'no_matches',
      candidates,
      authorizationId: candidates.length
        ? this.createDevAccountNameSyncAuthorization(candidates)
        : undefined,
    };
  }

  @backgroundMethod()
  async applyThirdPartyGlobalAccountNames(params: {
    authorizationId: string;
  }): Promise<{ renamed: number }> {
    await this.assertThirdPartyOnboardingDevMode();
    const authorization = this._devAccountNameSyncAuthorizations.get(
      params.authorizationId,
    );
    // Single-use even when a later validation/write fails.
    this._devAccountNameSyncAuthorizations.delete(params.authorizationId);
    if (!authorization || authorization.expiresAt <= Date.now()) {
      throw new OneKeyLocalError(
        'Third-party account name sync authorization expired',
      );
    }
    const { indexedAccounts } =
      await this.backgroundApi.serviceAccount.getAllIndexedAccounts({
        filterRemoved: true,
      });
    const allowedIds = new Set(indexedAccounts.map((account) => account.id));
    for (const candidate of authorization.candidates) {
      const name = candidate.sourceName.trim();
      if (
        !allowedIds.has(candidate.indexedAccountId) ||
        !name ||
        name.length > 80
      ) {
        throw new OneKeyLocalError('Invalid third-party account rename');
      }
    }
    for (const candidate of authorization.candidates) {
      await this.backgroundApi.serviceAccount.setAccountName({
        indexedAccountId: candidate.indexedAccountId,
        name: candidate.sourceName,
      });
    }
    return { renamed: authorization.candidates.length };
  }

  @backgroundMethod()
  async getThirdPartyAccountNameCandidates(params: {
    vendor: EHardwareVendor;
    walletId: string;
  }): Promise<IThirdPartyAccountNameCandidatesResult> {
    if (params.vendor === EHardwareVendor.trezor) {
      return {
        status: 'cloud_source_requires_authorization',
        candidates: [],
      };
    }
    if (params.vendor !== EHardwareVendor.ledger) {
      return { status: 'unsupported_source', candidates: [] };
    }
    if (!platformEnv.isDesktop || !globalThis.desktopApiProxy?.system) {
      return { status: 'unsupported_source', candidates: [] };
    }

    const source =
      await globalThis.desktopApiProxy.system.readLedgerLiveAccountNames();
    if (source.status !== 'available') {
      const statusMap: Record<
        Exclude<typeof source.status, 'available'>,
        IThirdPartyAccountNameSourceStatus
      > = {
        no_accounts: 'no_matches',
        source_not_found: 'source_not_found',
        encrypted_source: 'encrypted_source',
        invalid_source: 'invalid_source',
      };
      return { status: statusMap[source.status], candidates: [] };
    }

    const { wallets } = await this.backgroundApi.serviceAccount.getWallets({
      nestedHiddenWallets: false,
      includingAccounts: true,
    });
    const wallet = wallets.find((item) => item.id === params.walletId);
    const indexedAccount = wallet?.dbIndexedAccounts?.[0];
    const walletAddress = wallet?.firstEvmAddress?.trim();
    if (!wallet || !indexedAccount || !walletAddress) {
      return { status: 'no_matches', candidates: [] };
    }

    const matchingSourceAccounts = source.accounts.filter(
      (item) =>
        item.address.trim().toLowerCase() === walletAddress.toLowerCase(),
    );
    const matchingNames = [
      ...new Set(matchingSourceAccounts.map((item) => item.name.trim())),
    ].filter(Boolean);
    // Ledger Live can contain multiple accounts with the same EVM address.
    // Only suggest a rename when all matches agree; never pick by file order.
    if (
      matchingNames.length !== 1 ||
      matchingNames[0] === indexedAccount.name
    ) {
      return { status: 'no_matches', candidates: [] };
    }
    const [sourceName] = matchingNames;
    return {
      status: 'available',
      candidates: [
        {
          indexedAccountId: indexedAccount.id,
          currentName: indexedAccount.name,
          sourceName,
          matchedAddress: walletAddress,
          source: 'ledger-live',
        },
      ],
    };
  }

  @backgroundMethod()
  async applyThirdPartyAccountNames(params: {
    walletId: string;
    renames: Array<{ indexedAccountId: string; name: string }>;
  }): Promise<void> {
    const { wallets } = await this.backgroundApi.serviceAccount.getWallets({
      nestedHiddenWallets: false,
      includingAccounts: true,
    });
    const wallet = wallets.find((item) => item.id === params.walletId);
    const allowedIds = new Set(
      wallet?.dbIndexedAccounts?.map((item) => item.id) ?? [],
    );
    for (const rename of params.renames) {
      const name = rename.name.trim();
      if (
        !allowedIds.has(rename.indexedAccountId) ||
        !name ||
        name.length > 80
      ) {
        throw new OneKeyLocalError('Invalid third-party account rename');
      }
      await this.backgroundApi.serviceAccount.setAccountName({
        indexedAccountId: rename.indexedAccountId,
        name,
      });
    }
  }

  @backgroundMethod()
  async thirdPartyHardwareGetDeviceInfo(params: {
    vendor: EHardwareVendor;
    connectId: string;
  }) {
    await this.ensureAdaptersInitialized(params.vendor);
    const adapter = this.getThirdPartyAdapter(params.vendor);
    if (!adapter) {
      throw createThirdPartyAdapterNotRegisteredError(params.vendor);
    }
    const hw = adapter.hw as unknown as {
      getLedgerDeviceInfo: (
        connectId: string,
      ) => Promise<{ success: boolean; payload: unknown }>;
    };
    return hw.getLedgerDeviceInfo(params.connectId);
  }
}

export default ServiceThirdPartyHardware;

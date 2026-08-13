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
import { getVendorProfile } from '@onekeyhq/shared/src/hardware/vendorProfile';
import { matchAccountNamesByAddress } from '@onekeyhq/shared/src/hardware/thirdPartyAccountNameSync';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  IThirdPartyAccountNameCandidatesResult,
  IThirdPartyAccountNameLocalAccount,
  IThirdPartyAccountNameSelectedDevice,
  IThirdPartyAccountNameSourceInventoryAccount,
  IThirdPartyAccountNameSourceInventoryResult,
  IThirdPartyAccountNameSourceStatus,
} from '@onekeyhq/shared/src/referralCode/type';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
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

import { runTrustedLocalMockDeviceClaim } from './localMockDeviceClaim';

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

function buildAccountNameTargets({
  accounts,
  indexedAccounts,
  walletNameById,
  allowedWalletIds,
  onlyBitcoin,
}: {
  accounts: IDBAccount[];
  indexedAccounts: IDBIndexedAccount[];
  walletNameById: Map<string, string>;
  allowedWalletIds?: Set<string>;
  onlyBitcoin?: boolean;
}) {
  const indexedAccountById = new Map(
    indexedAccounts.map((account) => [account.id, account]),
  );
  return accounts.flatMap((account) => {
    const indexedAccount = account.indexedAccountId
      ? indexedAccountById.get(account.indexedAccountId)
      : undefined;
    if (
      !indexedAccount ||
      (allowedWalletIds && !allowedWalletIds.has(indexedAccount.walletId)) ||
      (onlyBitcoin && account.impl !== 'btc')
    ) {
      return [];
    }
    const defaultNetworkId =
      account.createAtNetwork || account.networks?.[0] || account.impl;
    const addressEntries: Array<{
      address: string;
      networkId: string;
      path?: string;
    }> = [
      {
        address: account.address,
        networkId: defaultNetworkId,
        path: account.path,
      },
    ];
    if ('addresses' in account) {
      for (const [addressKey, rawAddress] of Object.entries(
        account.addresses ?? {},
      )) {
        const networkId =
          account.impl !== 'btc' &&
          (addressKey.includes('--') || addressKey === account.impl)
            ? addressKey
            : defaultNetworkId;
        for (const address of rawAddress
          .split(',')
          .map((item) => item.trim())) {
          addressEntries.push({
            address,
            networkId,
            path: account.path,
          });
        }
      }
    }
    const seen = new Set<string>();
    return addressEntries.flatMap(({ address, networkId, path }) => {
      if (!address) {
        return [];
      }
      const dedupeKey = `${networkId}:${normalizeInventoryAddress(address)}`;
      if (seen.has(dedupeKey)) {
        return [];
      }
      seen.add(dedupeKey);
      return [
        {
          indexedAccountId: indexedAccount.id,
          accountId: account.id,
          walletId: indexedAccount.walletId,
          walletName:
            walletNameById.get(indexedAccount.walletId) ??
            indexedAccount.walletId,
          currentName: indexedAccount.name,
          networkId,
          networkName: getFallbackNetworkName(account.impl),
          networkImpl: account.impl,
          address,
          path,
        },
      ];
    });
  });
}

function getFallbackNetworkName(impl: string): string {
  const names: Record<string, string> = {
    btc: 'Bitcoin',
    evm: 'Ethereum / EVM',
    sol: 'Solana',
    sui: 'Sui',
    aptos: 'Aptos',
    cosmos: 'Cosmos',
    near: 'NEAR',
    tron: 'TRON',
  };
  return names[impl] ?? impl;
}

function normalizeInventoryAddress(address: string): string {
  const trimmed = address.trim();
  return /^0x[0-9a-f]{40}$/i.test(trimmed) || /^(bc1|tb1)/i.test(trimmed)
    ? trimmed.toLowerCase()
    : trimmed;
}

function buildAccountNameSourceInventory({
  sourceAccounts,
  targetAccounts,
  source,
}: {
  sourceAccounts: Array<{
    name: string;
    address: string;
    path?: string;
    sourceDeviceId?: string;
    sourceAccountType?: string;
    selectedDeviceMatch?: boolean;
  }>;
  targetAccounts: ReturnType<typeof buildAccountNameTargets>;
  source: IThirdPartyAccountNameSourceInventoryAccount['source'];
}): IThirdPartyAccountNameSourceInventoryAccount[] {
  const targetsByAddress = new Map<
    string,
    Array<{
      indexedAccountId: string;
      accountId: string;
      walletId: string;
      walletName: string;
      currentName: string;
      networkId: string;
      networkName: string;
      networkImpl: string;
      address: string;
      path?: string;
    }>
  >();
  for (const target of targetAccounts) {
    const address = normalizeInventoryAddress(target.address);
    const matches = targetsByAddress.get(address) ?? [];
    if (
      !matches.some(
        (match) =>
          match.indexedAccountId === target.indexedAccountId &&
          match.accountId === target.accountId &&
          match.networkId === target.networkId &&
          normalizeInventoryAddress(match.address) ===
            normalizeInventoryAddress(target.address),
      )
    ) {
      matches.push({
        indexedAccountId: target.indexedAccountId,
        accountId: target.accountId,
        walletId: target.walletId,
        walletName: target.walletName,
        currentName: target.currentName,
        networkId: target.networkId,
        networkName: target.networkName,
        networkImpl: target.networkImpl,
        address: target.address,
        path: target.path,
      });
      targetsByAddress.set(address, matches);
    }
  }
  return sourceAccounts.map((account) => ({
    sourceName: account.name,
    address: account.address,
    path: account.path,
    source,
    ...(account.sourceDeviceId
      ? { sourceDeviceId: account.sourceDeviceId }
      : {}),
    ...(account.sourceAccountType
      ? { sourceAccountType: account.sourceAccountType }
      : {}),
    ...(account.selectedDeviceMatch !== undefined
      ? { selectedDeviceMatch: account.selectedDeviceMatch }
      : {}),
    matchedOneKeyAccounts:
      targetsByAddress.get(normalizeInventoryAddress(account.address)) ?? [],
  }));
}

function buildLocalAccountNameInventory(
  targetAccounts: ReturnType<typeof buildAccountNameTargets>,
): IThirdPartyAccountNameLocalAccount[] {
  return targetAccounts.map((target) => ({
    indexedAccountId: target.indexedAccountId,
    accountId: target.accountId,
    walletId: target.walletId,
    walletName: target.walletName,
    currentName: target.currentName,
    networkId: target.networkId,
    networkName: target.networkName,
    networkImpl: target.networkImpl,
    address: target.address,
    path: target.path,
  }));
}

function buildSelectedDeviceDebugInfo(
  device: IDBDevice | undefined,
): IThirdPartyAccountNameSelectedDevice | undefined {
  if (!device) {
    return undefined;
  }
  const featuresDeviceId = (
    device.featuresInfo as { device_id?: unknown } | undefined
  )?.device_id;
  return {
    dbDeviceId: device.id,
    deviceId: device.deviceId,
    featuresDeviceId:
      typeof featuresDeviceId === 'string' ? featuresDeviceId : undefined,
    connectId: device.connectId,
    usbConnectId: device.usbConnectId,
    bleConnectId: device.bleConnectId,
  };
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

  private async assertThirdPartyOnboardingDevMode(): Promise<void> {
    if (!(await this.isDevModeEnabled())) {
      throw new OneKeyLocalError(
        'Third-party onboarding diagnostics require Developer Mode',
      );
    }
  }

  private async resolveAccountNameTargetNetworkNames(
    targets: ReturnType<typeof buildAccountNameTargets>,
  ): Promise<ReturnType<typeof buildAccountNameTargets>> {
    const networkIds = [
      ...new Set(
        targets
          .map((target) => target.networkId)
          .filter((networkId) => networkId.includes('--')),
      ),
    ];
    if (!networkIds.length) {
      return targets;
    }
    const { networks } = await this.backgroundApi.serviceNetwork
      .getNetworksByIds({ networkIds })
      .catch(() => ({ networks: [] }));
    const networkNameById = new Map(
      networks.map((network) => [network.id, network.name]),
    );
    return targets.map((target) => ({
      ...target,
      networkName: networkNameById.get(target.networkId) ?? target.networkName,
    }));
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
        defaultLogger.hardware.sdkLog.log(
          `[TrezorBLEBind] candidate probe failed bleConnectId=${bleConnectId}`,
        );
        throw convertThirdPartyDeviceError(result.payload, {
          vendor: EHardwareVendor.trezor,
        });
      }
      // No device_id is "could not verify", not "different device" — a
      // mismatch verdict would grey the user's own device out for good.
      if (!result.payload.deviceId) {
        defaultLogger.hardware.sdkLog.log(
          `[TrezorBLEBind] candidate identity unavailable bleConnectId=${bleConnectId} expectedDeviceId=${featuresDeviceId}`,
        );
        throw new OneKeyLocalError({
          message: appLocale.intl.formatMessage({
            id: ETranslations.hardware_connect_failed,
          }),
          autoToast: true,
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
      // Binding can mint THP credentials, buffered until the row carries this
      // bleConnectId — it does now. Without this drain the user re-enters the
      // pairing code on every connect. Best-effort: must never fail the bind.
      try {
        await this.persistTrezorThpCredentials({
          connectId: bleConnectId,
          deviceId: featuresDeviceId,
        });
      } catch {
        // ignore — credential persistence is non-critical to binding.
      }
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
  // issuance must be decided by the production backend from the raw Trezor
  // proof or a backend-owned Ledger relay session, never from this client's
  // verified flag.
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
   * App-local service mock for the future claim API. The async verifier seam
   * delegates to the real vendor implementation already owned by the hardware
   * SDK, then issues a local DEV voucher so the UI flow can be exercised.
   *
   * Production replaces this local method with a remote API. In particular,
   * the backend must own/witness Ledger's DMK session instead of trusting the
   * SDK result returned to the App.
   */
  @backgroundMethod()
  async runLocalMockThirdPartyDeviceClaim(params: {
    vendor: EHardwareVendor;
    connectId: string;
    dbDeviceId: string;
  }): Promise<{
    status: 'issued';
    voucherCode: string;
    challengeHex: string;
    deviceId: string;
    verificationMode: 'trezor-sdk-genuine-check' | 'ledger-sdk-genuine-check';
  }> {
    await this.assertThirdPartyOnboardingDevMode();
    if (
      params.vendor !== EHardwareVendor.trezor &&
      params.vendor !== EHardwareVendor.ledger
    ) {
      throw new OneKeyLocalError('本地设备验真测试仅支持 Trezor 和 Ledger');
    }
    const vendor =
      params.vendor === EHardwareVendor.trezor ? 'trezor' : 'ledger';
    return runTrustedLocalMockDeviceClaim({
      vendor,
      executeAuthenticityCheck: async (challengeHex) => {
        const response = await this.thirdPartyHardwareVerifyDeviceAuthenticity({
          vendor: params.vendor,
          connectId: params.connectId,
          dbDeviceId: params.dbDeviceId,
          challenge:
            params.vendor === EHardwareVendor.trezor ? challengeHex : undefined,
        });
        if (!response.success) {
          throw convertThirdPartyDeviceError(response.payload, {
            vendor:
              params.vendor === EHardwareVendor.trezor ? 'Trezor' : 'Ledger',
          });
        }
        return response.payload as {
          vendor: 'trezor' | 'ledger';
          verified: boolean;
          deviceId?: string;
          usedDebugKey?: boolean;
          error?: string;
          // cspell:ignore optiga
          trezorProof?: {
            challenge: string;
            deviceModel: string;
            proof: {
              optiga_certificates: string[];
              optiga_signature: string;
              tropic_certificates?: string[];
              tropic_signature?: string;
              mcu_certificates?: string[];
              mcu_signature?: string;
            };
          };
        };
      },
    });
  }

  /**
   * Developer-only read-only device-details flow. It deliberately does not use
   * the current page's walletId or connect to hardware:
   * - Ledger Live names are matched against every local indexed account.
   * - Trezor Suite supplies one cached receive address and its source deviceId
   *   for every locally cached BTC account.
   */
  @backgroundMethod()
  async getThirdPartyGlobalAccountNameSourceInventory(params: {
    vendor: EHardwareVendor;
    dbDeviceId?: string;
  }): Promise<IThirdPartyAccountNameSourceInventoryResult> {
    await this.assertThirdPartyOnboardingDevMode();
    const empty = (
      status: IThirdPartyAccountNameSourceStatus,
      scopeDescription: string,
      options?: {
        localAccounts?: IThirdPartyAccountNameLocalAccount[];
        selectedDevice?: IThirdPartyAccountNameSelectedDevice;
      },
    ): IThirdPartyAccountNameSourceInventoryResult => ({
      status,
      accounts: [],
      localAccounts: options?.localAccounts ?? [],
      selectedDevice: options?.selectedDevice,
      scopeDescription,
    });
    if (
      params.vendor !== EHardwareVendor.trezor &&
      params.vendor !== EHardwareVendor.ledger
    ) {
      return empty('unsupported_source', '不支持该第三方账户来源。');
    }
    const [{ accounts }, { indexedAccounts }, { wallets }] = await Promise.all([
      this.backgroundApi.serviceAccount.getAllAccounts({
        filterRemoved: true,
      }),
      this.backgroundApi.serviceAccount.getAllIndexedAccounts({
        filterRemoved: true,
      }),
      localDb.getAllWallets(),
    ]);
    const walletNameById = new Map(
      wallets.map((wallet) => [wallet.id, wallet.name]),
    );
    const selectedWalletIds = params.dbDeviceId
      ? new Set(
          wallets
            .filter((wallet) => wallet.associatedDevice === params.dbDeviceId)
            .map((wallet) => wallet.id),
        )
      : undefined;
    const selectedDbDevice = params.dbDeviceId
      ? await localDb.getDevice(params.dbDeviceId).catch(() => undefined)
      : undefined;
    const selectedDevice = buildSelectedDeviceDebugInfo(selectedDbDevice);

    if (params.vendor === EHardwareVendor.ledger) {
      const scopeDescription =
        'Ledger Live：读取这台电脑上全部明文以太坊账户名称和地址。OneKey：仅显示与当前 Ledger 设备关联的钱包，并按链和地址分组。';
      const localTargets = (
        await this.resolveAccountNameTargetNetworkNames(
          buildAccountNameTargets({
            accounts,
            indexedAccounts,
            walletNameById,
            allowedWalletIds: selectedWalletIds,
          }),
        )
      ).filter((account) => /^0x[0-9a-f]{40}$/i.test(account.address.trim()));
      const localAccounts = buildLocalAccountNameInventory(localTargets);
      if (!platformEnv.isDesktop || !globalThis.desktopApiProxy?.system) {
        return empty('unsupported_source', scopeDescription, {
          localAccounts,
          selectedDevice,
        });
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
        return empty(statusMap[source.status], scopeDescription, {
          localAccounts,
          selectedDevice,
        });
      }
      const inventory = buildAccountNameSourceInventory({
        sourceAccounts: source.accounts,
        targetAccounts: localTargets,
        source: 'ledger-live',
      });
      return {
        status: 'available',
        accounts: inventory,
        localAccounts,
        selectedDevice,
        scopeDescription,
      };
    }

    const scopeDescription =
      'Trezor Suite：读取当前 Suite 设备标识对应的本地比特币账户缓存，每个账户读取一个已缓存的收款地址。OneKey：仅显示与当前 Trezor 设备关联的钱包；不会从硬件派生地址。';
    const localTargets = await this.resolveAccountNameTargetNetworkNames(
      buildAccountNameTargets({
        accounts,
        indexedAccounts,
        walletNameById,
        allowedWalletIds: selectedWalletIds,
        onlyBitcoin: true,
      }),
    );
    const localAccounts = buildLocalAccountNameInventory(localTargets);
    if (!params.dbDeviceId) {
      return empty('no_matches', scopeDescription, { localAccounts });
    }
    const dbDevice = selectedDbDevice;
    if (!dbDevice || dbDevice.vendor !== EHardwareVendor.trezor) {
      return empty('no_matches', scopeDescription, {
        localAccounts,
        selectedDevice,
      });
    }
    if (!platformEnv.isDesktop || !globalThis.desktopApiProxy?.system) {
      return empty('unsupported_source', scopeDescription, {
        localAccounts,
        selectedDevice,
      });
    }
    const sourceResponse =
      await globalThis.desktopApiProxy.system.readTrezorSuiteAccountNames();
    if (sourceResponse.status !== 'available') {
      const statusMap: Record<
        Exclude<typeof sourceResponse.status, 'available'>,
        IThirdPartyAccountNameSourceStatus
      > = {
        no_accounts: 'no_matches',
        source_not_found: 'source_not_found',
        invalid_source: 'invalid_source',
      };
      return empty(statusMap[sourceResponse.status], scopeDescription, {
        localAccounts,
        selectedDevice,
      });
    }
    const selectedDeviceIds = new Set(
      [dbDevice.deviceId, selectedDevice?.featuresDeviceId]
        .filter((deviceId): deviceId is string => Boolean(deviceId?.trim()))
        .map((deviceId) => deviceId.trim().toLowerCase()),
    );
    const sourceAccounts = sourceResponse.accounts
      .filter((account) =>
        selectedDeviceIds.has(account.deviceId.trim().toLowerCase()),
      )
      .map((account) => ({
        name: account.name,
        address: account.address,
        path: account.path,
        sourceDeviceId: account.deviceId,
        sourceAccountType: account.accountType,
        selectedDeviceMatch: true,
      }));
    const inventory = buildAccountNameSourceInventory({
      sourceAccounts,
      targetAccounts: localTargets,
      source: 'trezor-suite',
    });
    return {
      status: inventory.length ? 'available' : 'no_matches',
      accounts: inventory,
      localAccounts,
      selectedDevice,
      scopeDescription,
    };
  }

  @backgroundMethod()
  async getThirdPartyAccountNameCandidates(params: {
    vendor: EHardwareVendor;
    walletId: string;
  }): Promise<IThirdPartyAccountNameCandidatesResult> {
    const isTrezor = params.vendor === EHardwareVendor.trezor;
    const isLedger = params.vendor === EHardwareVendor.ledger;
    if (!isTrezor && !isLedger) {
      return { status: 'unsupported_source', candidates: [] };
    }
    if (!platformEnv.isDesktop || !globalThis.desktopApiProxy?.system) {
      return { status: 'unsupported_source', candidates: [] };
    }

    const statusMap: Record<string, IThirdPartyAccountNameSourceStatus> = {
      no_accounts: 'no_matches',
      source_not_found: 'source_not_found',
      encrypted_source: 'encrypted_source',
      invalid_source: 'invalid_source',
    };

    const source = isTrezor
      ? await globalThis.desktopApiProxy.system.readTrezorSuiteAccountNames()
      : await globalThis.desktopApiProxy.system.readLedgerLiveAccountNames();
    if (source.status !== 'available') {
      return {
        status: statusMap[source.status] ?? 'no_matches',
        candidates: [],
      };
    }

    // getWallets() only fills dbAccounts for "others" wallets, so hardware
    // wallets need the account tables directly.
    const [{ wallets }, { accounts }, { indexedAccounts }] = await Promise.all([
      this.backgroundApi.serviceAccount.getWallets({
        nestedHiddenWallets: false,
      }),
      this.backgroundApi.serviceAccount.getAllAccounts({ filterRemoved: true }),
      this.backgroundApi.serviceAccount.getAllIndexedAccounts({
        filterRemoved: true,
      }),
    ]);
    const wallet = wallets.find((item) => item.id === params.walletId);
    if (!wallet) {
      return { status: 'no_matches', candidates: [] };
    }

    // Ledger Live has no device marker; only Trezor can narrow by deviceId.
    let sourceAccounts = source.accounts.map(
      (item: { name: string; address: string; deviceId?: string }) => ({
        name: item.name,
        address: item.address,
        deviceId: item.deviceId,
      }),
    );
    if (isTrezor) {
      const walletDeviceId = (
        await localDb
          .getWalletDeviceSafe({ walletId: params.walletId })
          .catch(() => undefined)
      )?.deviceId;
      if (!walletDeviceId) {
        return { status: 'no_matches', candidates: [] };
      }
      sourceAccounts = sourceAccounts.filter(
        (item) =>
          item.deviceId &&
          item.deviceId.toUpperCase() === walletDeviceId.toUpperCase(),
      );
    }
    if (!sourceAccounts.length) {
      return { status: 'no_matches', candidates: [] };
    }

    const targetAccounts = buildAccountNameTargets({
      accounts,
      indexedAccounts,
      walletNameById: new Map([[wallet.id, wallet.name]]),
      allowedWalletIds: new Set([wallet.id]),
    }).map((target) => ({
      indexedAccountId: target.indexedAccountId,
      currentName: target.currentName,
      address: target.address,
    }));

    const matches = matchAccountNamesByAddress({
      sourceAccounts,
      targetAccounts,
    });
    if (!matches.length) {
      return { status: 'no_matches', candidates: [] };
    }
    return {
      status: 'available',
      candidates: matches.map((match) => ({
        indexedAccountId: match.indexedAccountId,
        currentName: match.currentName,
        sourceName: match.sourceName,
        sourceNames: match.sourceNames,
        matchedAddress: match.matchedAddress,
        source: isTrezor ? 'trezor-suite' : 'ledger-live',
      })),
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
    // Validate all before writing: failing mid-loop renames only some.
    const validated = params.renames.map((rename) => {
      const name = rename.name.trim();
      if (
        !allowedIds.has(rename.indexedAccountId) ||
        !name ||
        name.length > 80
      ) {
        throw new OneKeyLocalError('Invalid third-party account rename');
      }
      return { indexedAccountId: rename.indexedAccountId, name };
    });
    for (const rename of validated) {
      await this.backgroundApi.serviceAccount.setAccountName(rename);
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

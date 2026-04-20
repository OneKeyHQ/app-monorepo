import { HardwareErrorCode } from '@onekeyfe/hwk-adapter-core';

import { OneKeyInternalError } from '@onekeyhq/shared/src/errors';
import { getVendorProfile } from '@onekeyhq/shared/src/hardware/vendorProfile';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import localDb from '../../dbs/local/localDb';

import type { IBackgroundApi } from '../../apis/IBackgroundApi';
import type {
  ChainForFingerprint,
  Response,
} from '@onekeyfe/hwk-adapter-core';

type IDbDeviceForFingerprint = {
  id: string;
  settingsRaw: string;
  deviceId: string;
  connectId: string;
  vendor?: string;
};

// In-memory cache: deviceDbId → chain → fingerprint
const fingerprintCache = new Map<string, Map<string, string>>();

function getCached(deviceDbId: string, chain: ChainForFingerprint): string | undefined {
  return fingerprintCache.get(deviceDbId)?.get(chain);
}

function setCache(deviceDbId: string, chain: ChainForFingerprint, fp: string): void {
  let deviceMap = fingerprintCache.get(deviceDbId);
  if (!deviceMap) {
    deviceMap = new Map();
    fingerprintCache.set(deviceDbId, deviceMap);
  }
  deviceMap.set(chain, fp);
}

// Serialize DB writes per device
const pendingWrites = new Map<string, Promise<void>>();

function serializeWrite(
  deviceId: string,
  fn: () => Promise<void>,
): Promise<void> {
  const prev = pendingWrites.get(deviceId) ?? Promise.resolve();
  const next = prev.then(fn, fn).then(() => {
    if (pendingWrites.get(deviceId) === next) {
      pendingWrites.delete(deviceId);
    }
  });
  pendingWrites.set(deviceId, next);
  return next;
}

/**
 * Look up existing fingerprint from memory cache or DB snapshot.
 * Does NOT generate — generation happens after successful operation
 * when the correct Ledger App is guaranteed to be open.
 */
export async function ensureLedgerChainFingerprint(
  _backgroundApi: IBackgroundApi,
  dbDevice: IDbDeviceForFingerprint,
  chain: ChainForFingerprint,
): Promise<string> {
  if (dbDevice.vendor !== EHardwareVendor.ledger) {
    throw new OneKeyInternalError(
      `ledgerFingerprintUtils called with non-ledger vendor: ${
        dbDevice.vendor ?? 'undefined'
      }`,
    );
  }

  // When the stored connectId is itself a persistent device identifier
  // (Ledger BLE uses a 4-hex suffix like "A58F"), use it directly.
  // USB connectIds are ephemeral and must not be persisted, so the profile's
  // regex also acts as a safety net against stale USB UUIDs reaching here.
  const profile = getVendorProfile(EHardwareVendor.ledger);
  if (
    dbDevice.connectId &&
    profile.canMatchDeviceByConnectId(dbDevice.connectId)
  ) {
    return dbDevice.connectId;
  }

  // 1. Memory cache
  const cached = getCached(dbDevice.id, chain);
  if (cached !== undefined) {
    return cached;
  }

  // 2. DB snapshot
  let settings: Record<string, unknown> = {};
  try {
    settings = JSON.parse(dbDevice.settingsRaw || '{}');
  } catch (e) {
    defaultLogger.hardware.sdkLog.log(
      'ledgerFingerprint.settingsRawParseFailed',
      (e as Error)?.message ?? '',
    );
  }
  const chainFingerprints =
    (settings.chainFingerprints as Record<string, string>) ?? {};

  if (chainFingerprints[chain]) {
    setCache(dbDevice.id, chain, chainFingerprints[chain]);
    return chainFingerprints[chain];
  }

  // 3. Not found — return empty. Fingerprint will be generated
  // after the operation succeeds (post-success in callLedgerWithFingerprintRetry).
  return '';
}

/**
 * Call a Ledger adapter method with fingerprint verification.
 *
 * Flow:
 * 1. Look up fingerprint (cache/DB). If found, pass to fn for verification.
 * 2. If not found, call fn('') — adapter skips verification when deviceId is empty.
 * 3. On "Wrong device" error → regenerate fingerprint + retry once.
 * 4. On success without fingerprint → generate and store now (the correct App is open).
 */
export async function callLedgerWithFingerprintRetry<T>(
  backgroundApi: IBackgroundApi,
  dbDevice: IDbDeviceForFingerprint,
  chain: ChainForFingerprint,
  fn: (deviceId: string) => Promise<Response<T>>,
): Promise<Response<T>> {
  const deviceId = await ensureLedgerChainFingerprint(
    backgroundApi,
    dbDevice,
    chain,
  );
  const result = await fn(deviceId);

  // Wrong device → regenerate and retry
  if (
    !result.success &&
    result.payload.code === HardwareErrorCode.DeviceMismatch
  ) {
    fingerprintCache.get(dbDevice.id)?.delete(chain);
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    const newDeviceId = await generateAndStoreFingerprint(
      backgroundApi,
      dbDevice,
      chain,
    );
    if (newDeviceId) {
      setCache(dbDevice.id, chain, newDeviceId);
      return fn(newDeviceId);
    }
  }

  // Success without fingerprint → the correct App is now open,
  // generate fingerprint before returning. On success the cache is
  // populated; on failure the next call will retry — regeneration is
  // idempotent against a stable device.
  if (result.success && !deviceId) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      const fp = await generateAndStoreFingerprint(
        backgroundApi,
        dbDevice,
        chain,
      );
      if (fp) {
        setCache(dbDevice.id, chain, fp);
      }
    } catch (e) {
      defaultLogger.hardware.sdkLog.log(
        'ledgerFingerprint.postOpGenerationFailed',
        (e as Error)?.message ?? '',
      );
    }
  }

  return result;
}

async function generateAndStoreFingerprint(
  backgroundApi: IBackgroundApi,
  dbDevice: { id: string; connectId: string },
  chain: ChainForFingerprint,
): Promise<string> {
  const adapter = await backgroundApi.serviceHardware.getAdapterForVendor(
    EHardwareVendor.ledger,
  );
  if (!adapter) return '';

  try {
    const result = await adapter.hw.getChainFingerprint(
      dbDevice.connectId,
      '',
      chain,
    );
    if (result.success && result.payload) {
      const fingerprint = result.payload;
      if (localDb.updateDeviceChainFingerprint) {
        await serializeWrite(dbDevice.id, async () => {
          await localDb.updateDeviceChainFingerprint({
            dbDeviceId: dbDevice.id,
            chain,
            fingerprint,
          });
        });
      }
      return fingerprint;
    }
    defaultLogger.hardware.sdkLog.log(
      'ledgerFingerprint.generateFailed',
      `${chain} ${!result.success ? result.payload.error : 'empty payload'}`,
    );
  } catch (e) {
    defaultLogger.hardware.sdkLog.log(
      'ledgerFingerprint.generateThrew',
      `${chain} ${(e as Error)?.message ?? ''}`,
    );
  }
  return '';
}

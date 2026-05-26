import { HardwareErrorCode, failure } from '@onekeyfe/hwk-adapter-core';

import { OneKeyInternalError } from '@onekeyhq/shared/src/errors';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import localDb from '../../dbs/local/localDb';

import type { IBackgroundApi } from '../../apis/IBackgroundApi';
import type { IDBDevice } from '../../dbs/local/types';
import type { ChainForFingerprint, Response } from '@onekeyfe/hwk-adapter-core';

const FINGERPRINT_CHAINS: ChainForFingerprint[] = ['evm', 'btc', 'sol', 'tron'];

type IDbDeviceForFingerprint = {
  id: string;
  settingsRaw: string;
  deviceId: string;
  connectId: string;
  vendor?: string;
};

// In-memory cache: deviceDbId → chain → fingerprint
const fingerprintCache = new Map<string, Map<string, string>>();

function getCached(
  deviceDbId: string,
  chain: ChainForFingerprint,
): string | undefined {
  return fingerprintCache.get(deviceDbId)?.get(chain);
}

function setCache(
  deviceDbId: string,
  chain: ChainForFingerprint,
  fp: string,
): void {
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
  // after the operation succeeds (post-success in callLedgerWithFingerprint).
  return '';
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

/**
 * Call a Ledger adapter method with fingerprint verification.
 *
 * Flow:
 * 1. Look up fingerprint (cache/DB). If found, pass to fn for verification.
 * 2. If not found, call fn('') — adapter skips verification when deviceId is empty.
 * 3. On success without fingerprint → generate and store now (the correct App is open).
 *
 * DeviceMismatch is NOT silently recovered here: a mismatch means the live
 * device's seed differs from what we recorded, and silently rewriting the DB
 * record would re-associate an old wallet's account tree onto a new seed.
 * The error is propagated so the UI can surface it to the user.
 */
export async function callLedgerWithFingerprint<T>(
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

  // Bootstrap path: main call ran without a stored FP. The post-success FP
  // generation MUST succeed and persist before the result is allowed to flow
  // back to the caller. Otherwise the caller persists an address with no
  // trust anchor: any later op on a different physical seed silently
  // overwrites the wallet record, and verify-address can leak to the
  // destructive "address mismatch" dialog.
  if (result.success && !deviceId) {
    let fp = '';
    try {
      fp = await generateAndStoreFingerprint(backgroundApi, dbDevice, chain);
    } catch (e) {
      defaultLogger.hardware.sdkLog.log(
        'ledgerFingerprint.postOpGenerationFailed',
        (e as Error)?.message ?? '',
      );
    }
    if (!fp) {
      return failure(
        HardwareErrorCode.DeviceMismatch,
        `Could not establish chain fingerprint for ${chain} after device call; refusing to persist unverifiable result. Please retry.`,
      );
    }
    setCache(dbDevice.id, chain, fp);
  }

  return result;
}

/**
 * Compare one stored chain fingerprint against the live device. A single
 * successful compare is definitive (same seed + same path = same fingerprint).
 * Returns `'unknown'` when no chain could be queried.
 */
export async function verifySeedMatch(
  backgroundApi: IBackgroundApi,
  dbDevice: IDBDevice,
  liveConnectId: string,
): Promise<'match' | 'mismatch' | 'unknown'> {
  if (dbDevice.vendor !== EHardwareVendor.ledger) return 'unknown';

  const adapter = await backgroundApi.serviceHardware.getAdapterForVendor(
    EHardwareVendor.ledger,
  );
  if (!adapter) return 'unknown';

  let stored: Record<string, string> = {};
  try {
    const settings = JSON.parse(dbDevice.settingsRaw || '{}');
    stored = (settings.chainFingerprints as Record<string, string>) ?? {};
  } catch {
    // Malformed settingsRaw — treat as "nothing stored", no guarantee to offer.
    return 'unknown';
  }

  const candidates = FINGERPRINT_CHAINS.filter((c) => !!stored[c]);
  if (candidates.length === 0) return 'unknown';

  for (const chain of candidates) {
    let live: string;
    try {
      const res = await adapter.hw.getChainFingerprint(
        liveConnectId,
        '',
        chain,
      );
      // eslint-disable-next-line no-continue
      if (!res.success || !res.payload) continue;
      live = res.payload;
    } catch {
      // eslint-disable-next-line no-continue
      continue;
    }

    return live === stored[chain] ? 'match' : 'mismatch';
  }

  defaultLogger.hardware.sdkLog.log(
    'ledgerFingerprint.verifySeedMatchUnknown',
    `no candidate chain could be verified (stored=${candidates.join(',')})`,
  );
  return 'unknown';
}

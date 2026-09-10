import { failure } from '@onekeyfe/hwk-adapter-core';
import { HardwareErrorCode } from '@onekeyfe/hwk-adapter-core/errors';

import { OneKeyInternalError } from '@onekeyhq/shared/src/errors';
import { convertThirdPartyDeviceError } from '@onekeyhq/shared/src/errors/utils/thirdPartyDeviceErrorUtils';
import {
  LEDGER_CONFIG,
  LEDGER_FINGERPRINT_CHAINS,
} from '@onekeyhq/shared/src/hardware/config/ledger';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import localDb from '../../dbs/local/localDb';

import {
  thirdPartyCommonCallParamsForCreateScene,
  thirdPartyConnectionContextFromDevice,
} from './thirdPartyHardwareCommonParams';

import type { IBackgroundApi } from '../../apis/IBackgroundApi';
import type { IDBDeviceSettings } from '../../dbs/local/types';
import type {
  ChainForFingerprint,
  ICommonCallParams,
  Response,
} from '@onekeyfe/hwk-adapter-core';

export function isLedgerFingerprintChain(
  chain: unknown,
): chain is ChainForFingerprint {
  return (
    typeof chain === 'string' &&
    LEDGER_FINGERPRINT_CHAINS.includes(chain as ChainForFingerprint)
  );
}

// Auto multi-network fill (onboarding + add-account) suppresses the per-app
// install prompt; manual / single-network add keeps the SDK default (prompt).
export function ledgerCommonCallParamsForCreateScene(scene: {
  isAutoCreateMultiNetwork?: boolean;
}): ICommonCallParams | undefined {
  return thirdPartyCommonCallParamsForCreateScene(scene);
}

type IDbDeviceForFingerprint = {
  id: string;
  settingsRaw: string;
  deviceId: string;
  connectId: string;
  usbConnectId?: string;
  bleConnectId?: string;
  vendor?: string;
};

function getStoredLedgerFingerprints(
  settingsRaw: string,
): Record<string, string> {
  try {
    const settings = JSON.parse(settingsRaw || '{}') as IDBDeviceSettings;
    return settings.chainFingerprints ?? {};
  } catch {
    return {};
  }
}

export function hasStoredLedgerChainFingerprint(settingsRaw: string): boolean {
  const stored = getStoredLedgerFingerprints(settingsRaw);
  return LEDGER_FINGERPRINT_CHAINS.some((chain) => !!stored[chain]);
}

/** Keep the device call and fingerprint checks on one acquired connection. */
export async function withNewLedgerInteraction<T>(
  backgroundApi: IBackgroundApi,
  connectId: string,
  run: (interactionId: string) => Promise<T>,
  context: ICommonCallParams,
): Promise<T> {
  const adapter =
    await backgroundApi.serviceThirdPartyHardware.getAdapterForVendor(
      EHardwareVendor.ledger,
    );
  if (!adapter) throw new OneKeyInternalError('Ledger adapter not available');
  const connected = await adapter.connectDevice(connectId, context);
  if (!connected.success) {
    throw convertThirdPartyDeviceError(connected.payload, { vendor: 'Ledger' });
  }
  const { interactionId } = connected.payload;
  try {
    return await run(interactionId);
  } finally {
    await adapter.releaseInteraction(interactionId);
  }
}

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

export async function persistLedgerChainFingerprint({
  dbDeviceId,
  chain,
  fingerprint,
}: {
  dbDeviceId: string;
  chain: ChainForFingerprint;
  fingerprint: string;
}): Promise<void> {
  if (localDb.updateDeviceChainFingerprint) {
    await serializeWrite(dbDeviceId, async () => {
      await localDb.updateDeviceChainFingerprint({
        dbDeviceId,
        chain,
        fingerprint,
      });
    });
  }
  setCache(dbDeviceId, chain, fingerprint);
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
  dbDevice: { id: string },
  chain: ChainForFingerprint,
  connectId: string,
): Promise<string> {
  const adapter =
    await backgroundApi.serviceThirdPartyHardware.getAdapterForVendor(
      EHardwareVendor.ledger,
    );
  if (!adapter) return '';

  try {
    const result = await adapter.hw.getChainFingerprint(connectId, '', chain);
    if (result.success && result.payload) {
      const fingerprint = result.payload;
      await persistLedgerChainFingerprint({
        dbDeviceId: dbDevice.id,
        chain,
        fingerprint,
      });
      // Confirm the newly persisted anchor on the same interaction so the SDK
      // can finish a pending BLE binding without trusting discovery alone.
      const verified = await adapter.hw.getChainFingerprint(
        connectId,
        fingerprint,
        chain,
      );
      if (!verified.success || verified.payload !== fingerprint) return '';
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
 * 2. A new-wallet flow may explicitly establish its first fingerprint.
 * 3. By default, a missing chain is recorded after its first successful call.
 *    Optional cross-chain verification requires another stored chain to match
 *    first, at the cost of opening that chain's app.
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
  fn: (
    deviceId: string,
    connectId: string,
    context: ICommonCallParams,
  ) => Promise<Response<T>>,
  options?: {
    interactionId?: string;
    allowFingerprintBootstrap?: boolean;
  },
): Promise<Response<T>> {
  const ledgerConfig = LEDGER_CONFIG;
  const deviceId = await ensureLedgerChainFingerprint(
    backgroundApi,
    dbDevice,
    chain,
  );
  if (
    !deviceId &&
    !options?.interactionId &&
    (!ledgerConfig.enableCrossChainFingerprintVerification ||
      options?.allowFingerprintBootstrap === true ||
      hasStoredLedgerChainFingerprint(dbDevice.settingsRaw))
  ) {
    return withNewLedgerInteraction(
      backgroundApi,
      dbDevice.connectId,
      (interactionId) =>
        callLedgerWithFingerprint(backgroundApi, dbDevice, chain, fn, {
          ...options,
          interactionId,
        }),
      thirdPartyConnectionContextFromDevice(dbDevice),
    );
  }
  const connectId = options?.interactionId || dbDevice.connectId;
  if (
    ledgerConfig.enableCrossChainFingerprintVerification &&
    !deviceId &&
    options?.allowFingerprintBootstrap !== true
  ) {
    const seedMatch = await verifySeedMatch(backgroundApi, dbDevice, connectId);
    if (seedMatch !== 'match') {
      return failure(
        HardwareErrorCode.DeviceMismatch,
        `No trusted ${chain} fingerprint is available and this Ledger could not be verified from another chain. Reconnect the original device and retry.`,
      );
    }
  }

  const result = await fn(
    deviceId,
    connectId,
    thirdPartyConnectionContextFromDevice(dbDevice),
  );

  // Bootstrap path: main call ran without a stored FP. The post-success FP
  // generation MUST succeed and persist before the result is allowed to flow
  // back to the caller. Otherwise the caller persists an address with no
  // trust anchor: any later op on a different physical seed silently
  // overwrites the wallet record, and verify-address can leak to the
  // destructive "address mismatch" dialog.
  if (result.success && !deviceId) {
    let fp = '';
    try {
      fp = await generateAndStoreFingerprint(
        backgroundApi,
        dbDevice,
        chain,
        connectId,
      );
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
  dbDevice: IDbDeviceForFingerprint,
  liveConnectId: string,
): Promise<'match' | 'mismatch' | 'unknown'> {
  if (dbDevice.vendor !== EHardwareVendor.ledger) return 'unknown';
  if (!liveConnectId) return 'unknown';

  const stored = getStoredLedgerFingerprints(dbDevice.settingsRaw);

  const candidates = LEDGER_FINGERPRINT_CHAINS.filter((c) => !!stored[c]);
  if (candidates.length === 0) return 'unknown';

  const adapter =
    await backgroundApi.serviceThirdPartyHardware.getAdapterForVendor(
      EHardwareVendor.ledger,
    );
  if (!adapter) return 'unknown';

  for (const chain of candidates) {
    let live: string;
    try {
      const res = await adapter.hw.getChainFingerprint(
        liveConnectId,
        stored[chain],
        chain,
      );
      if (
        !res.success &&
        res.payload.code === HardwareErrorCode.DeviceMismatch
      ) {
        return 'mismatch';
      }
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

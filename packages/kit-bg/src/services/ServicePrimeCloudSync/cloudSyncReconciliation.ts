import { sha512ProSync } from '@onekeyhq/core/src/secret/hash';
import appCrypto from '@onekeyhq/shared/src/appCrypto';
import { EPrimeCloudSyncDataType } from '@onekeyhq/shared/src/consts/primeConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { EOneKeyErrorClassNames } from '@onekeyhq/shared/src/errors/types/errorTypes';
import cloudSyncUtils from '@onekeyhq/shared/src/utils/cloudSyncUtils';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';
import timerUtils, {
  resolveBeforeTimeout,
} from '@onekeyhq/shared/src/utils/timerUtils';
import { ECloudSyncMode } from '@onekeyhq/shared/types/keylessCloudSync';
import type {
  ICloudSyncReconciliationAdapter,
  ICloudSyncReconciliationContract,
  ICloudSyncReconciliationLimits,
  ICloudSyncReconciliationResult,
  ICloudSyncReconciliationSummary,
} from '@onekeyhq/shared/types/prime/cloudSyncReconciliation';
import type { ICloudSyncReconciliationPersistState } from '@onekeyhq/shared/types/prime/cloudSyncReconciliationState';
import type {
  ICloudSyncCheckServerStatusPostData,
  ICloudSyncCheckServerStatusResult,
  ICloudSyncCredential,
  ICloudSyncServerItem,
} from '@onekeyhq/shared/types/prime/primeCloudSyncTypes';

import { canArchiveForeignAccountCopy } from './cloudSyncCheckUtils';
import cloudSyncItemBuilder from './cloudSyncItemBuilder';
import { normalizePublicAccountSnapshotRecord } from './publicAccountSnapshot';

import type { IWalletTieState } from './publicAccountSnapshotWriteGuard';
import type ServicePrimeCloudSync from './ServicePrimeCloudSync';
import type { IManualCloudSyncResult } from './ServicePrimeCloudSync';
import type { IDBCloudSyncItem } from '../../dbs/local/types';
import type { IPrimeCloudSyncPersistAtomData } from '../../states/jotai/atoms/prime';
import type { IManualHardwareWalletRecovery } from '../ServiceKeylessCloudSync/hardwareCloudSyncRecovery';

// A missing tied version only means progress when this checked apply itself
// committed the matching tombstone cleanup transaction.
function hasCheckedWalletReceipt(
  id: string,
  item: IDBCloudSyncItem | undefined,
  previous: IDBCloudSyncItem | undefined,
  tie: IWalletTieState,
  spaceId: string,
  serverPwdHash: string,
): boolean {
  if (!item) return tie.cleaned.has(id) && tie.isCurrent();
  if (!item.serverUploaded || item.pwdHash !== spaceId) return false;
  const later =
    (item.dataTime ?? 0) > (tie.requested.get(id)?.dataTime ?? Infinity) &&
    matchesCheckedWireWallet(id, item, tie, serverPwdHash);
  const accepted = tie.accepted.get(id);
  return (
    later ||
    (!!accepted &&
      item.dataType === accepted.dataType &&
      item.pwdHash === accepted.pwdHash &&
      item.dataTime === accepted.dataTime &&
      item.data === accepted.data &&
      item.isDeleted === accepted.isDeleted &&
      (!previous ||
        item.data !== previous.data ||
        item.isDeleted !== previous.isDeleted))
  );
}

function matchesCheckedWireWallet(
  id: string,
  item: IDBCloudSyncItem,
  tie: IWalletTieState,
  serverPwdHash: string,
): boolean {
  return tie.wire.some(
    (row) =>
      row.key === id &&
      row.dataType === item.dataType &&
      (row.pwdHash || serverPwdHash) === item.pwdHash &&
      row.dataTimestamp === item.dataTime &&
      row.data === item.data &&
      row.isDeleted === item.isDeleted,
  );
}

export function addWalletHolds(
  pending: Map<string, number>,
  held: ReadonlyMap<string, number>,
) {
  for (const [id, time] of held) {
    pending.set(id, Math.max(time, pending.get(id) ?? 0));
  }
}

function pruneWalletHold(
  id: string,
  item: IDBCloudSyncItem | undefined,
  tie: IWalletTieState,
  pending: Map<string, number>,
  spaceId: string,
  serverPwdHash: string,
): void {
  const time = pending.get(id);
  if (time === undefined || !tie.sameNode || !tie.isCurrent()) return;
  const accepted = tie.accepted.get(id);
  const ownedDeletion = !item && tie.cleaned.has(id);
  const current = item ?? (ownedDeletion ? accepted : undefined);
  if (
    current?.dataType !== EPrimeCloudSyncDataType.Wallet ||
    current.pwdHash !== spaceId ||
    current.serverUploaded !== true ||
    !Number.isSafeInteger(current.dataTime) ||
    (current.dataTime ?? 0) <= time ||
    !matchesCheckedWireWallet(id, current, tie, serverPwdHash)
  )
    return;
  if (ownedDeletion || current.localSceneUpdated === true) pending.delete(id);
}

export function walletReceipt(
  id: string,
  item: IDBCloudSyncItem | undefined,
  previous: IDBCloudSyncItem | undefined,
  tie: IWalletTieState,
  holds: Map<string, number>,
  spaceId: string,
  serverPwdHash: string,
): boolean | undefined {
  if (holds.size) pruneWalletHold(id, item, tie, holds, spaceId, serverPwdHash);
  if (!tie.accepted.has(id) && !tie.held.has(id) && !tie.checked.has(id))
    return undefined;
  return hasCheckedWalletReceipt(
    id,
    item,
    previous,
    tie,
    spaceId,
    serverPwdHash,
  );
}

export function prepareWalletTieState(
  wire: ICloudSyncServerItem[],
  requestItems: IDBCloudSyncItem[],
  isCurrent: () => boolean,
): IWalletTieState {
  const requested = new Map(requestItems.map((item) => [item.id, item]));
  const checked = new Set(
    wire.flatMap((row) => {
      const local = requested.get(row.key);
      return row.dataType === EPrimeCloudSyncDataType.Wallet &&
        local?.dataType === EPrimeCloudSyncDataType.Wallet &&
        local.dataTime !== undefined &&
        local.dataTime === cloudSyncUtils.normalizeDataTime(row.dataTimestamp)
        ? [row.key]
        : [];
    }),
  );
  return {
    wire,
    requested,
    checked,
    accepted: new Map(),
    cleaned: new Set(),
    held: new Map(),
    isCurrent,
  };
}

export function classifyManualReconciliationTransport(
  error: unknown,
): IManualCloudSyncResult | undefined {
  const failure = error as {
    code?: string;
    className?: string;
    httpStatusCode?: number;
    response?: { status?: number };
  };
  // Axios may normalize the original response before this layer.
  const status = failure?.httpStatusCode ?? failure?.response?.status;
  if (
    failure?.className === EOneKeyErrorClassNames.AxiosNetworkError ||
    failure?.code === 'ERR_NETWORK' ||
    failure?.code === 'ETIMEDOUT'
  )
    return 'network-unavailable';
  if (status === 401) return 'session-unavailable';
  if (status === 403) return 'sync-blocked';
  if (typeof status === 'number' && status >= 500 && status < 600)
    return 'server-unavailable';
  return undefined;
}

export async function runReconciliationCheckWithLegacyFallback({
  firstRequest,
  selectedCapability,
  signal,
  isCurrent,
  recovery,
  send,
  onFallback,
  onFailure,
}: {
  firstRequest: boolean;
  selectedCapability: ICloudSyncCheckServerStatusPostData['reconciliation'];
  signal: AbortSignal;
  isCurrent: () => boolean;
  recovery?: IManualHardwareWalletRecovery;
  send: (
    capability: ICloudSyncCheckServerStatusPostData['reconciliation'],
    recovery?: IManualHardwareWalletRecovery,
  ) => Promise<ICloudSyncCheckServerStatusResult>;
  onFallback: () => void;
  onFailure: (failure: IManualCloudSyncResult | undefined) => void;
}) {
  try {
    return await send(selectedCapability, firstRequest ? recovery : undefined);
  } catch (error) {
    const status = (error as { response?: { status?: number } })?.response
      ?.status;
    if (
      !firstRequest ||
      signal.aborted ||
      !isCurrent() ||
      ![400, 422].includes(status ?? 0)
    ) {
      onFailure(classifyManualReconciliationTransport(error));
      throw error;
    }
    // A strict legacy backend may reject the optional capability field.
    // Authentication errors never enter this compatibility fallback.
    onFallback();
    try {
      return await send(undefined, recovery);
    } catch (fallbackError) {
      onFailure(classifyManualReconciliationTransport(fallbackError));
      throw fallbackError;
    }
  }
}

export function pauseReconciliation({
  delayMs,
  signal,
}: {
  delayMs: number;
  signal: AbortSignal;
}) {
  return new Promise<void>((resolve, reject) => {
    const timer: { handle?: ReturnType<typeof setTimeout> } = {};
    const abort = () => {
      clearTimeout(timer.handle);
      reject(new OneKeyLocalError('Cloud sync was cancelled'));
    };
    timer.handle = setTimeout(() => {
      signal.removeEventListener('abort', abort);
      resolve();
    }, delayMs);
    if (signal.aborted) abort();
    else signal.addEventListener('abort', abort, { once: true });
  });
}

export function summarizeReconciliationRound({
  baseline,
  issues,
  result,
  onlyWalletVerificationDeferred,
  unknownTie,
  reportOriginalPartial,
  forceSceneReplay,
  networkRequests,
}: {
  baseline: ICloudSyncReconciliationPersistState;
  issues?: IPrimeCloudSyncPersistAtomData['publicAccountSnapshotStatus'];
  result: ICloudSyncReconciliationResult;
  onlyWalletVerificationDeferred: boolean;
  unknownTie: boolean;
  reportOriginalPartial: boolean;
  forceSceneReplay: true | undefined;
  networkRequests: number;
}) {
  const hasIssues =
    !!issues &&
    issues.needsUpdate + issues.pending + issues.conflicts + issues.rejected >
      0;
  const quietWalletRetry =
    onlyWalletVerificationDeferred &&
    result.status === 'waiting' &&
    result.reason === 'upload-incomplete';
  // Reuse the durable backoff even when the only missing work was an
  // unverified Wallet: repeatedly slow local reads must not spin.
  const shouldBackOff =
    result.status === 'blocked' || (quietWalletRetry && !result.progress);
  let failures = baseline.failures;
  if (shouldBackOff) failures += 1;
  else if (result.progress) failures = 0;
  let nextRetryAt = result.nextRetryAt;
  if (shouldBackOff)
    nextRetryAt =
      Date.now() +
      Math.min(30 * 60_000, 30_000 * 2 ** Math.min(failures - 1, 6));
  let status: ICloudSyncReconciliationPersistState['status'] = 'blocked';
  if (result.status === 'complete')
    status =
      hasIssues || unknownTie || reportOriginalPartial ? 'partial' : 'complete';
  else if (result.status === 'waiting' || result.status === 'cancelled')
    status = 'waiting';
  const state: ICloudSyncReconciliationPersistState = {
    ...baseline,
    status,
    reason: result.reason,
    unfinished: result.unfinished,
    forceSceneReplay: result.unfinished ? forceSceneReplay : undefined,
    nextRetryAt,
    failures,
    requests: baseline.requests + networkRequests,
    rounds: baseline.rounds + result.rounds,
    received: baseline.received + result.received,
    applied: baseline.applied + result.applied,
    uploaded: baseline.uploaded + result.uploaded,
    updatedAt: Date.now(),
  };

  return { state, hasIssues, quietWalletRetry };
}

export async function readReconciliationApplyProgress({
  ids,
  before,
  response,
  acknowledgedDeletes,
  operationIsCurrent,
  tieState,
  holds,
  spaceId,
  issues,
  removeOnDelete,
  read,
  opaqueAccountCredential,
}: {
  ids: string[];
  before: Map<string, IDBCloudSyncItem>;
  response: ICloudSyncCheckServerStatusResult;
  acknowledgedDeletes: Set<string>;
  operationIsCurrent: () => boolean;
  tieState: IWalletTieState;
  holds: Map<string, number>;
  spaceId: string;
  issues?: Readonly<Record<string, string>>;
  removeOnDelete: (dataType: EPrimeCloudSyncDataType) => boolean;
  read: (ids: string[]) => Promise<(IDBCloudSyncItem | null | undefined)[]>;
  opaqueAccountCredential?: ICloudSyncCredential;
}) {
  let applied = 0;
  const opaqueWires =
    opaqueAccountCredential &&
    !response.reconciliation &&
    !response.obsoleted.length &&
    response.pwdHash === spaceId
      ? new Map(
          response.updated
            .filter(
              (wire) =>
                wire.dataType === EPrimeCloudSyncDataType.Account &&
                (wire.isDeleted === false || wire.isDeleted === undefined) &&
                !before.has(wire.key) &&
                !acknowledgedDeletes.has(wire.key) &&
                (wire.pwdHash || response.pwdHash) === spaceId &&
                !!wire.data &&
                wire.data.length <= 64 * 1024 &&
                Number.isSafeInteger(wire.dataTimestamp) &&
                (wire.dataTimestamp ?? 0) > 0,
            )
            .map((wire) => [wire.key, wire]),
        )
      : undefined;
  const opaqueCandidates: ICloudSyncServerItem[] = [];
  for (let offset = 0; offset < ids.length; offset += 50) {
    if (!operationIsCurrent())
      throw new OneKeyLocalError('Cloud sync was cancelled');
    const records = await read(ids.slice(offset, offset + 50));
    const after = new Map(
      records
        .filter((item): item is IDBCloudSyncItem => !!item)
        .map((item) => [item.id, item]),
    );
    for (const id of ids.slice(offset, offset + 50)) {
      const item = after.get(id);
      const old = before.get(id);
      const opaque = opaqueWires?.get(id);
      if (
        opaque &&
        item &&
        !item.rawKey &&
        !item.rawData &&
        canArchiveForeignAccountCopy(item, spaceId)
      )
        opaqueCandidates.push(opaque);
      const receipt = walletReceipt(
        id,
        item,
        old,
        tieState,
        holds,
        spaceId,
        response.pwdHash,
      );
      if (receipt !== undefined) {
        if (receipt) applied += 1;
        // eslint-disable-next-line no-continue -- A tie needs an exact receipt.
        continue;
      }
      if (
        !item &&
        old &&
        acknowledgedDeletes.has(id) &&
        removeOnDelete(old.dataType)
      ) {
        applied += 1;
        // eslint-disable-next-line no-continue -- A confirmed deletion is already counted.
        continue;
      }
      if (
        item &&
        item.pwdHash === spaceId &&
        issues?.[item.id] !== 'rejected' &&
        issues?.[item.id] !== 'conflicts' &&
        (!old ||
          item.dataTime !== old.dataTime ||
          item.dataType !== old.dataType ||
          (item.isDeleted && !old.isDeleted) ||
          item.pwdHash !== old.pwdHash)
      )
        applied += 1;
    }
    if (offset + 50 < ids.length) await timerUtils.wait(0);
  }
  const opaqueAccountBlocked =
    !applied &&
    !!opaqueAccountCredential &&
    opaqueCandidates.length > 0 &&
    (await verifyAnyOpaqueAccountCollision({
      candidates: opaqueCandidates,
      syncCredential: opaqueAccountCredential,
      spaceId,
      isCurrent: operationIsCurrent,
    }));
  return { applied, opaqueAccountBlocked };
}

async function verifyAnyOpaqueAccountCollision({
  candidates,
  syncCredential,
  spaceId,
  isCurrent,
}: {
  candidates: ICloudSyncServerItem[];
  syncCredential: ICloudSyncCredential;
  spaceId: string;
  isCurrent: () => boolean;
}): Promise<boolean> {
  let active = true;
  try {
    return (
      (await resolveBeforeTimeout(
        (async () => {
          for (const wire of candidates) {
            if (!active || !isCurrent()) return false;
            try {
              const { rawDataJson } =
                await cloudSyncItemBuilder.decryptSyncItem({
                  item: {
                    id: wire.key,
                    data: wire.data,
                    dataType: wire.dataType,
                    dataTime: wire.dataTimestamp,
                    pwdHash: spaceId,
                    isDeleted: false,
                    rawKey: '',
                    rawData: '',
                    localSceneUpdated: false,
                    serverUploaded: true,
                  },
                  syncCredential,
                });
              const { rawKey } =
                normalizePublicAccountSnapshotRecord(rawDataJson);
              if (sha512ProSync({ data: rawKey }) === wire.key)
                return active && isCurrent();
            } catch {
              // An unreadable or invalid wire item is not a verified collision.
            }
          }
          return false;
        })(),
        1500,
      )) === true
    );
  } finally {
    active = false;
  }
}

export const CLOUD_SYNC_RECONCILIATION_DEFAULT_LIMITS: ICloudSyncReconciliationLimits =
  {
    maxRequests: 8,
    maxDurationMs: 20_000,
    requestTimeoutMs: 10_000,
    maxItems: 500,
    maxResponseBytes: 1024 * 1024,
    maxSummaryBytes: 8 * 1024 * 1024,
    maxRetries: 2,
    retryBaseDelayMs: 250,
    retryMaxDelayMs: 2000,
    continuationDelayMs: 1000,
    blockedRetryDelayMs: 30_000,
  };

type IReason = ICloudSyncReconciliationResult['reason'];

class ReconciliationStop extends OneKeyLocalError {
  constructor(readonly reason: IReason) {
    super(`Cloud reconciliation stopped: ${reason}`);
  }
}

function digest(value: string): string {
  return Buffer.from(
    appCrypto.hash.sha256Sync(Buffer.from(value, 'utf8')),
  ).toString('hex');
}

function compareKeys(a: { key: string }, b: { key: string }): number {
  if (a.key === b.key) return 0;
  return a.key < b.key ? -1 : 1;
}

/** Measures one complete metadata summary; no payload or cursor is retained. */
export function measureCloudSyncReconciliationSummary(
  summary: ICloudSyncReconciliationSummary,
  maxBytes = CLOUD_SYNC_RECONCILIATION_DEFAULT_LIMITS.maxSummaryBytes,
): { bytes: number; fingerprint: string } {
  if (!Array.isArray(summary) || summary.length > 100_000)
    throw new ReconciliationStop('summary-budget');
  const keys = new Set<string>();
  let minimumBytes = 0;
  for (const item of summary) {
    if (
      !item ||
      typeof item.key !== 'string' ||
      !item.key ||
      item.key.length > 512 ||
      typeof item.dataType !== 'string' ||
      !item.dataType ||
      item.dataType.length > 128 ||
      keys.has(item.key) ||
      (item.dataTimestamp !== undefined &&
        !Number.isSafeInteger(item.dataTimestamp))
    )
      throw new ReconciliationStop('invalid-summary');
    keys.add(item.key);
    minimumBytes += item.key.length + item.dataType.length;
    if (minimumBytes > maxBytes) throw new ReconciliationStop('summary-budget');
  }
  const sorted = summary.toSorted(compareKeys);
  const serialized = stringUtils.stableStringify(sorted);
  const bytes = Buffer.byteLength(serialized, 'utf8');
  if (bytes > maxBytes) throw new ReconciliationStop('summary-budget');
  return { bytes, fingerprint: digest(serialized) };
}

function contractFor(
  response: ICloudSyncCheckServerStatusResult,
  limits: ICloudSyncReconciliationLimits,
): ICloudSyncReconciliationContract | undefined {
  const value = response?.reconciliation;
  if (
    !value ||
    value.version !== 1 ||
    value.diffBeforeLimit !== true ||
    value.includesDeleted !== true ||
    typeof value.hasMore !== 'boolean' ||
    !Number.isSafeInteger(value.maxItems) ||
    value.maxItems < 1 ||
    value.maxItems > limits.maxItems ||
    !Number.isSafeInteger(value.maxBytes) ||
    value.maxBytes < 1 ||
    value.maxBytes > limits.maxResponseBytes
  )
    return undefined;
  return value;
}

function responseInfo(
  response: ICloudSyncCheckServerStatusResult,
  maxBytes: number,
) {
  if (
    !response ||
    !Array.isArray(response.diff) ||
    !Array.isArray(response.updated) ||
    !Array.isArray(response.deleted) ||
    !Array.isArray(response.obsoleted)
  )
    throw new ReconciliationStop('invalid-response');
  const received =
    response.diff.length +
    response.updated.length +
    response.deleted.length +
    response.obsoleted.length;
  let minimumBytes = 0;
  for (const key of [...response.deleted, ...response.obsoleted]) {
    if (typeof key !== 'string' || !key)
      throw new ReconciliationStop('invalid-response');
    minimumBytes += key.length;
  }
  for (const item of [...response.diff, ...response.updated]) {
    if (!item || typeof item.key !== 'string' || typeof item.data !== 'string')
      throw new ReconciliationStop('invalid-response');
    minimumBytes += item.key.length + item.data.length;
  }
  if (minimumBytes > maxBytes) throw new ReconciliationStop('response-budget');
  const bytes = Buffer.byteLength(
    stringUtils.stableStringify(response),
    'utf8',
  );
  if (bytes > maxBytes) throw new ReconciliationStop('response-budget');
  const records = [...response.diff, ...response.updated].map((item) => ({
    key: item.key,
    dataType: item.dataType,
    dataTimestamp: item.dataTimestamp,
    isDeleted: item.isDeleted,
    pwdHash: item.pwdHash,
  }));
  records.sort(compareKeys);
  return {
    received,
    bytes,
    fingerprint: digest(
      stringUtils.stableStringify({
        records,
        deleted: [...response.deleted].toSorted(),
        obsoleted: [...response.obsoleted].toSorted(),
      }),
    ),
  };
}

/**
 * Adapters must honor AbortSignal in HTTP and before transaction commits.
 * Results carry only counters; the owner schedules/persists continuations.
 */
export async function runCloudSyncReconciliation({
  adapter,
  signal,
  limits: customLimits,
}: {
  adapter: ICloudSyncReconciliationAdapter;
  signal?: AbortSignal;
  limits?: Partial<ICloudSyncReconciliationLimits>;
}): Promise<ICloudSyncReconciliationResult> {
  const limits = {
    ...CLOUD_SYNC_RECONCILIATION_DEFAULT_LIMITS,
    ...customLimits,
  };
  for (const [key, value] of Object.entries(limits)) {
    if (!Number.isSafeInteger(value) || value < (key === 'maxRetries' ? 0 : 1))
      throw new OneKeyLocalError('Invalid Cloud reconciliation budget');
  }
  if (
    limits.maxRequests > 50 ||
    limits.maxDurationMs > 60_000 ||
    limits.requestTimeoutMs > 30_000 ||
    limits.maxItems > 500 ||
    limits.maxResponseBytes > 4 * 1024 * 1024 ||
    limits.maxSummaryBytes > 16 * 1024 * 1024 ||
    limits.maxRetries > 3
  )
    throw new OneKeyLocalError(
      'Cloud reconciliation budget exceeds client bounds',
    );
  const state = {
    progress: false,
    requests: 0,
    rounds: 0,
    received: 0,
    applied: 0,
    uploaded: 0,
    failures: 0,
    lastSummaryBytes: 0,
  };
  const startedAt = adapter.now();
  const controller = new AbortController();
  let stopReason: IReason = 'cancelled';
  const abort = () => {
    stopReason = 'cancelled';
    controller.abort();
  };
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) abort();
  const deadline = setTimeout(() => {
    stopReason = 'time-budget';
    controller.abort();
  }, limits.maxDurationMs);
  const finish = (
    status: ICloudSyncReconciliationResult['status'],
    reason: IReason,
    delayMs?: number,
  ): ICloudSyncReconciliationResult => ({
    ...state,
    status,
    reason,
    unfinished: status !== 'complete',
    ...(delayMs === undefined ? {} : { nextRetryAt: adapter.now() + delayMs }),
  });
  const budgetResult = (reason: 'time-budget' | 'request-budget') =>
    finish(
      state.progress ? 'waiting' : 'blocked',
      reason,
      state.progress ? limits.continuationDelayMs : limits.blockedRetryDelayMs,
    );
  const ensureCurrent = () => {
    if (controller.signal.aborted) throw new ReconciliationStop(stopReason);
    if (!adapter.isCurrent()) {
      stopReason = 'source-changed';
      controller.abort();
      throw new ReconciliationStop(stopReason);
    }
    if (adapter.now() - startedAt >= limits.maxDurationMs) {
      stopReason = 'time-budget';
      controller.abort();
      throw new ReconciliationStop(stopReason);
    }
  };
  const controlled = <T>(
    operation: () => Promise<T>,
    operationSignal = controller.signal,
    interrupted: () => Error = () => new ReconciliationStop(stopReason),
  ): Promise<T> =>
    new Promise((resolve, reject) => {
      const onAbort = () => reject(interrupted());
      if (operationSignal.aborted) {
        onAbort();
        return;
      }
      operationSignal.addEventListener('abort', onAbort, { once: true });
      Promise.resolve()
        .then(() => {
          ensureCurrent();
          return operation();
        })
        .then(
          (value) => {
            operationSignal.removeEventListener('abort', onAbort);
            resolve(value);
          },
          (error: unknown) => {
            operationSignal.removeEventListener('abort', onAbort);
            reject(error);
          },
        );
    });
  const check = async (localData: ICloudSyncReconciliationSummary) => {
    const request = new AbortController();
    const abortRequest = () => request.abort();
    controller.signal.addEventListener('abort', abortRequest, { once: true });
    const timeoutMs = Math.max(
      1,
      Math.min(
        limits.requestTimeoutMs,
        limits.maxDurationMs - (adapter.now() - startedAt),
      ),
    );
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      request.abort();
    }, timeoutMs);
    try {
      return await controlled(
        () =>
          adapter.check({
            localData,
            reconciliation: {
              version: 1,
              maxItems: limits.maxItems,
              maxBytes: limits.maxResponseBytes,
            },
            signal: request.signal,
            timeoutMs,
          }),
        request.signal,
        () =>
          timedOut
            ? new OneKeyLocalError('Cloud reconciliation request timed out')
            : new ReconciliationStop(stopReason),
      );
    } finally {
      clearTimeout(timeout);
      controller.signal.removeEventListener('abort', abortRequest);
      request.abort();
    }
  };
  const seen = new Set<string>();
  let consecutiveFailures = 0;
  try {
    ensureCurrent();
    let summary = await controlled(() =>
      adapter.getFullSummary({ signal: controller.signal }),
    );
    let summaryInfo = measureCloudSyncReconciliationSummary(
      summary,
      limits.maxSummaryBytes,
    );
    state.lastSummaryBytes = summaryInfo.bytes;
    while (true) {
      ensureCurrent();
      if (state.requests >= limits.maxRequests)
        return budgetResult('request-budget');
      let legacyResponseSeen = false;
      try {
        state.requests += 1;
        const response = await check(summary);
        ensureCurrent();
        const contract = contractFor(response, limits);
        const verified = !!contract && adapter.isBoundedCheckVerified(contract);
        legacyResponseSeen = response?.reconciliation === undefined;
        if (
          !response ||
          !Array.isArray(response.diff) ||
          !Array.isArray(response.updated) ||
          !Array.isArray(response.deleted) ||
          !Array.isArray(response.obsoleted)
        )
          throw new ReconciliationStop('invalid-response');
        if (!legacyResponseSeen && !verified)
          throw new ReconciliationStop('invalid-response');
        const count =
          response.diff.length +
          response.updated.length +
          response.deleted.length +
          response.obsoleted.length;
        if (verified && contract && count > contract.maxItems)
          return finish(
            'blocked',
            'response-budget',
            limits.blockedRetryDelayMs,
          );
        // Legacy checks return the full difference set. Pagination and its
        // response limits apply only when the server declares that capability.
        const info =
          verified && contract
            ? responseInfo(response, contract.maxBytes)
            : { received: count, fingerprint: '' };
        state.received += info.received;
        if (verified && seen.has(info.fingerprint))
          return finish(
            'blocked',
            'repeated-response',
            limits.blockedRetryDelayMs,
          );
        let uploaded = 0;
        let skipped = 0;
        let verificationDeferred = 0;
        let applied = 0;
        let hasApplyReceipt = false;
        if (response.obsoleted.length) {
          const receipt = await controlled(() =>
            adapter.uploadObsoleted({
              keys: response.obsoleted,
              response,
              signal: controller.signal,
            }),
          );
          uploaded = receipt?.uploaded ?? 0;
          skipped = receipt?.skipped ?? 0;
          verificationDeferred = receipt?.verificationDeferred ?? 0;
          if (
            !Number.isSafeInteger(uploaded) ||
            uploaded < 0 ||
            !Number.isSafeInteger(skipped) ||
            skipped < 0 ||
            !Number.isSafeInteger(verificationDeferred) ||
            verificationDeferred < 0 ||
            (!legacyResponseSeen && verificationDeferred > 0) ||
            uploaded + skipped + verificationDeferred >
              response.obsoleted.length
          )
            throw new ReconciliationStop('invalid-response');
          state.uploaded += uploaded;
          state.progress ||= uploaded > 0;
          ensureCurrent();
        }
        if (
          response.diff.length ||
          response.updated.length ||
          response.deleted.length
        ) {
          const receipt = await controlled(() =>
            adapter.apply({ response, signal: controller.signal }),
          );
          hasApplyReceipt = receipt !== undefined;
          applied = receipt?.applied ?? 0;
          if (
            !Number.isSafeInteger(applied) ||
            applied < 0 ||
            applied >
              response.diff.length +
                response.updated.length +
                response.deleted.length
          )
            throw new ReconciliationStop('invalid-response');
          state.applied += applied;
          // Receipts report accepted semantic versions, never ciphertext churn.
          // Preserve that progress if the time budget expires before rereading.
          state.progress ||= applied > 0;
          ensureCurrent();
        }
        summary = await controlled(() =>
          adapter.getFullSummary({ signal: controller.signal }),
        );
        ensureCurrent();
        const nextSummaryInfo = measureCloudSyncReconciliationSummary(
          summary,
          limits.maxSummaryBytes,
        );
        const summaryAdvanced =
          nextSummaryInfo.fingerprint !== summaryInfo.fingerprint;
        const hasDeletionWork =
          response.deleted.length > 0 ||
          [...response.diff, ...response.updated].some(
            (item) => item.isDeleted,
          );
        // Ciphertext changes are not a record version. A production receipt
        // excludes rejected business records; a deletion ACK may advance its
        // state without changing the historical metadata-only summary.
        const progress =
          uploaded > 0 ||
          (applied > 0 && (summaryAdvanced || hasDeletionWork)) ||
          (!hasApplyReceipt && summaryAdvanced);
        state.progress ||= progress;
        state.lastSummaryBytes = nextSummaryInfo.bytes;
        summaryInfo = nextSummaryInfo;
        state.rounds += 1;
        consecutiveFailures = 0;
        if (!verified || !contract || !contract.hasMore) {
          // A final check can still be followed by an incomplete upload. Verify
          // the remaining keys with a fresh check after the retry delay.
          if (uploaded + skipped < response.obsoleted.length) {
            const onlyVerificationDeferred =
              verificationDeferred > 0 &&
              uploaded + skipped + verificationDeferred ===
                response.obsoleted.length;
            return finish(
              progress || onlyVerificationDeferred ? 'waiting' : 'blocked',
              'upload-incomplete',
              progress
                ? limits.continuationDelayMs
                : limits.blockedRetryDelayMs,
            );
          }
          return finish('complete', 'finished');
        }
        if (!progress)
          return finish('blocked', 'no-progress', limits.blockedRetryDelayMs);
        seen.add(info.fingerprint);
      } catch (error) {
        ensureCurrent();
        if (error instanceof ReconciliationStop) throw error;
        state.failures += 1;
        consecutiveFailures += 1;
        // A failed multi-transaction adapter may already have committed part
        // of the batch. Observe that progress before choosing a continuation.
        summary = await controlled(() =>
          adapter.getFullSummary({ signal: controller.signal }),
        );
        const recoveredInfo = measureCloudSyncReconciliationSummary(
          summary,
          limits.maxSummaryBytes,
        );
        state.progress ||=
          recoveredInfo.fingerprint !== summaryInfo.fingerprint;
        summaryInfo = recoveredInfo;
        state.lastSummaryBytes = recoveredInfo.bytes;
        if (legacyResponseSeen) {
          // A legacy reply is one compatibility pass, including on local
          // processing failure. A later owner-controlled retry may try again.
          return finish(
            'blocked',
            'retry-exhausted',
            limits.blockedRetryDelayMs,
          );
        }
        if (consecutiveFailures > limits.maxRetries)
          return finish(
            'blocked',
            'retry-exhausted',
            limits.blockedRetryDelayMs,
          );
        if (state.requests >= limits.maxRequests)
          return budgetResult('request-budget');
        const delayMs = Math.min(
          limits.retryMaxDelayMs,
          limits.retryBaseDelayMs * 2 ** (consecutiveFailures - 1),
        );
        await controlled(() =>
          adapter.pause({ delayMs, signal: controller.signal }),
        );
        ensureCurrent();
        summary = await controlled(() =>
          adapter.getFullSummary({ signal: controller.signal }),
        );
        const refreshedInfo = measureCloudSyncReconciliationSummary(
          summary,
          limits.maxSummaryBytes,
        );
        state.progress ||=
          refreshedInfo.fingerprint !== summaryInfo.fingerprint;
        summaryInfo = refreshedInfo;
        state.lastSummaryBytes = summaryInfo.bytes;
      }
    }
  } catch (error) {
    if (error instanceof ReconciliationStop) {
      if (error.reason === 'time-budget') return budgetResult('time-budget');
      if (error.reason === 'cancelled' || error.reason === 'source-changed')
        return finish('cancelled', error.reason);
      return finish('blocked', error.reason, limits.blockedRetryDelayMs);
    }
    state.failures += 1;
    return finish('blocked', 'retry-exhausted', limits.blockedRetryDelayMs);
  } finally {
    clearTimeout(deadline);
    signal?.removeEventListener('abort', abort);
    controller.abort();
  }
}

export function getReconciliationStampScope(
  initial: IPrimeCloudSyncPersistAtomData,
  spaceId: string,
  isCurrent: () => boolean,
) {
  const {
    isCloudSyncEnabled,
    isCloudSyncEnabledKeyless,
    currentCloudSyncKeylessWalletId,
    hardwareCloudSyncKeySource,
  } = initial;
  if (!isCloudSyncEnabled && !isCloudSyncEnabledKeyless) return undefined;
  return {
    syncMode: isCloudSyncEnabled
      ? ECloudSyncMode.OnekeyId
      : ECloudSyncMode.Keyless,
    isCurrent: (value: IPrimeCloudSyncPersistAtomData) =>
      isCurrent() &&
      value.cloudSyncReconciliation?.spaceId === spaceId &&
      (isCloudSyncEnabled
        ? value.isCloudSyncEnabled
        : !value.isCloudSyncEnabled &&
          value.isCloudSyncEnabledKeyless === true &&
          value.currentCloudSyncKeylessWalletId ===
            currentCloudSyncKeylessWalletId &&
          value.hardwareCloudSyncKeySource?.credentialId ===
            hardwareCloudSyncKeySource?.credentialId &&
          value.hardwareCloudSyncKeySource?.derivationVersion ===
            hardwareCloudSyncKeySource?.derivationVersion),
  };
}

export async function runReconciliationApply({
  response,
  signal,
  isCurrent,
  latestItems,
  checkRequestItems,
  endpointChanged,
  credential,
  holds,
  spaceId,
  onWalletNameHistoryDeferred,
  service,
  walletCheckOrigin,
  readIssues,
  read,
  onReceipt,
}: {
  response: ICloudSyncCheckServerStatusResult;
  signal: AbortSignal;
  isCurrent: () => boolean;
  latestItems: IDBCloudSyncItem[];
  checkRequestItems: IDBCloudSyncItem[];
  endpointChanged: () => boolean;
  credential: ICloudSyncCredential;
  holds: Map<string, number>;
  spaceId: string;
  onWalletNameHistoryDeferred: NonNullable<
    Parameters<
      ServicePrimeCloudSync['saveServerSyncItemsToLocal']
    >[0]['onWalletNameHistoryDeferred']
  >;
  service: Pick<
    ServicePrimeCloudSync,
    | 'saveServerSyncItemsToLocal'
    | 'saveServerDeletedItemsToLocal'
    | 'getSyncManager'
  >;
  walletCheckOrigin: () => string | undefined;
  readIssues: () => Promise<
    | { spaceId: string; issues: Readonly<Record<string, string>> }
    | null
    | undefined
  >;
  read: (ids: string[]) => Promise<(IDBCloudSyncItem | null | undefined)[]>;
  onReceipt: (
    receipt: Awaited<ReturnType<typeof readReconciliationApplyProgress>>,
  ) => void;
}) {
  const operationIsCurrent = () => isCurrent() && !signal.aborted;
  if (!isCurrent() || signal.aborted)
    throw new OneKeyLocalError('Cloud sync was cancelled');
  const { diff, updated, deleted } = response;
  const ids = Array.from(
    new Set([
      ...diff.map((item) => item.key),
      ...updated.map((item) => item.key),
      ...deleted,
    ]),
  );
  const before = new Map(latestItems.map((item) => [item.id, item]));
  const wire = [...diff, ...updated];
  const acknowledgedDeletes = new Set([
    ...deleted,
    ...wire.filter((item) => item.isDeleted).map((item) => item.key),
  ]);
  const tieState = prepareWalletTieState(
    wire,
    checkRequestItems,
    () => !endpointChanged() && operationIsCurrent(),
  );
  for (const serverItems of [diff, updated]) {
    if (!isCurrent() || signal.aborted)
      throw new OneKeyLocalError('Cloud sync was cancelled');
    if (serverItems.length)
      await service.saveServerSyncItemsToLocal({
        serverItems,
        shouldSyncToScene: true,
        syncCredential: credential,
        serverPwdHash: response.pwdHash,
        isCurrent: operationIsCurrent,
        onWalletNameHistoryDeferred,
        tieState,
        tieOrigin: walletCheckOrigin(),
      });
  }
  if (!isCurrent() || signal.aborted)
    throw new OneKeyLocalError('Cloud sync was cancelled');
  addWalletHolds(holds, tieState.held);
  const bareDeletes = deleted.filter(
    (id) =>
      !tieState.checked.has(id) &&
      !tieState.held.has(id) &&
      !tieState.accepted.has(id),
  );
  if (bareDeletes.length)
    await service.saveServerDeletedItemsToLocal({
      deletedItemIds: bareDeletes,
      requestItems: checkRequestItems,
      shouldSyncToScene: true,
      syncCredential: credential,
      serverPwdHash: response.pwdHash,
      isCurrent: operationIsCurrent,
      tieState,
    });
  const accountIssues = await readIssues();
  const issues =
    accountIssues?.spaceId === spaceId ? accountIssues.issues : undefined;
  const receipt = await readReconciliationApplyProgress({
    ids,
    before,
    response,
    acknowledgedDeletes,
    operationIsCurrent,
    tieState,
    holds,
    spaceId,
    issues,
    opaqueAccountCredential:
      !endpointChanged() &&
      credential.keylessCredential?.source?.type === 'hardware' &&
      credential.keylessCredential.hardwareSession
        ? credential
        : undefined,
    removeOnDelete: (type) =>
      service.getSyncManager(type).removeSyncItemIfServerDeleted,
    read,
  });
  onReceipt(receipt);
  return receipt;
}

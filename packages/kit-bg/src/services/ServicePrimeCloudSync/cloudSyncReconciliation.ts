import appCrypto from '@onekeyhq/shared/src/appCrypto';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';
import type {
  ICloudSyncReconciliationAdapter,
  ICloudSyncReconciliationContract,
  ICloudSyncReconciliationLimits,
  ICloudSyncReconciliationResult,
  ICloudSyncReconciliationSummary,
} from '@onekeyhq/shared/types/prime/cloudSyncReconciliation';
import type { ICloudSyncCheckServerStatusResult } from '@onekeyhq/shared/types/prime/primeCloudSyncTypes';

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
    dataHash: digest(item.data),
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
        legacyResponseSeen = !verified;
        if (
          !response ||
          !Array.isArray(response.diff) ||
          !Array.isArray(response.updated) ||
          !Array.isArray(response.deleted) ||
          !Array.isArray(response.obsoleted)
        )
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
        // Old backends may return an entire space. Keep their single-pass
        // compatibility without another full payload serialization/copy.
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
        let applied = 0;
        if (response.obsoleted.length) {
          const receipt = await controlled(() =>
            adapter.uploadObsoleted({
              keys: response.obsoleted,
              response,
              signal: controller.signal,
            }),
          );
          uploaded = receipt?.uploaded ?? 0;
          if (
            !Number.isSafeInteger(uploaded) ||
            uploaded < 0 ||
            uploaded > response.obsoleted.length
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
        const progress =
          nextSummaryInfo.fingerprint !== summaryInfo.fingerprint ||
          uploaded > 0 ||
          applied > 0;
        state.progress ||= progress;
        state.lastSummaryBytes = nextSummaryInfo.bytes;
        summaryInfo = nextSummaryInfo;
        state.rounds += 1;
        consecutiveFailures = 0;
        if (!verified || !contract)
          return finish('backend-unverified', 'backend-unverified');
        if (!contract.hasMore) return finish('complete', 'finished');
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
          return finish('backend-unverified', 'retry-exhausted');
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

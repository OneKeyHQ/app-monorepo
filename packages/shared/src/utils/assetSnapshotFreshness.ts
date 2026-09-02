import type { IAssetSnapshotMeta } from '@onekeyhq/shared/types/assetSnapshot';

// Seed above persisted sequences so a process restart can still order
// header-less writes after snapshots from a previous process in normal cases.
let nextLocalSeq = Date.now() * 1000;

// The wall-clock seed is not monotonic across runtime restarts: a backward
// clock jump (NTP correction, manual change, drifted RTC) would reseed the
// counter BELOW sequences already persisted by a previous session, and every
// new write would then lose the freshness comparison — silently freezing the
// persisted snapshot. Self-heal by lifting the counter above any persisted
// sequence observed during a comparison, so the very next minted sequence
// orders after the stored watermark.
function observeLocalSeqWatermark(
  meta: IAssetSnapshotMeta | undefined,
): void {
  if (!meta) {
    return;
  }
  const localSeq = Number(meta.localSeq);
  if (Number.isFinite(localSeq) && localSeq > nextLocalSeq) {
    nextLocalSeq = localSeq;
  }
}

export function createAssetSnapshotMeta(options?: {
  serverDateMs?: number;
  localSeq?: number;
}): IAssetSnapshotMeta {
  const localSeq = options?.localSeq ?? (nextLocalSeq += 1);
  if (localSeq > nextLocalSeq) {
    nextLocalSeq = localSeq;
  }
  const serverDateMs = normalizeServerDateMs(options?.serverDateMs);
  return serverDateMs === undefined ? { localSeq } : { localSeq, serverDateMs };
}

export function normalizeServerDateMs(value: unknown): number | undefined {
  if (typeof value !== 'number' && typeof value !== 'string') {
    return undefined;
  }
  const timestamp =
    typeof value === 'number' ? value : new Date(value).getTime();
  return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : undefined;
}

/** Extract the HTTP Date header from AxiosHeaders, Fetch Headers, or a plain map. */
export function getServerDateMsFromHeaders(
  headers: unknown,
): number | undefined {
  if (!headers || typeof headers !== 'object') {
    return undefined;
  }

  const headerMap = headers as {
    date?: unknown;
    Date?: unknown;
    get?: (name: string) => unknown;
  };
  let rawDate: unknown = headerMap.date ?? headerMap.Date;
  if (rawDate === undefined && typeof headerMap.get === 'function') {
    try {
      rawDate = headerMap.get('date');
    } catch {
      rawDate = undefined;
    }
  }
  if (Array.isArray(rawDate)) {
    rawDate = rawDate[0];
  }
  return normalizeServerDateMs(rawDate);
}

/**
 * Drop malformed metadata (legacy persisted records, corrupted entries) so a
 * bogus marker is treated the same as an unversioned one.
 */
export function normalizeAssetSnapshotMeta(
  meta: IAssetSnapshotMeta | undefined,
): IAssetSnapshotMeta | undefined {
  if (!meta) {
    return undefined;
  }
  const localSeq = Number(meta.localSeq);
  if (!Number.isFinite(localSeq)) {
    return undefined;
  }
  const serverDateMs = normalizeServerDateMs(meta.serverDateMs);
  return serverDateMs === undefined ? { localSeq } : { localSeq, serverDateMs };
}

/**
 * Compare an incoming snapshot against the persisted snapshot for one key.
 * A positive result means the incoming snapshot is newer. Malformed metadata
 * is tolerated and compared as unversioned.
 */
export function compareAssetSnapshotMeta(
  incoming: IAssetSnapshotMeta | undefined,
  existing: IAssetSnapshotMeta | undefined,
): number {
  const next = normalizeAssetSnapshotMeta(incoming);
  const previous = normalizeAssetSnapshotMeta(existing);
  observeLocalSeqWatermark(next);
  observeLocalSeqWatermark(previous);
  if (!next && !previous) {
    return 0;
  }
  if (!next) {
    return -1;
  }
  if (!previous) {
    return 1;
  }

  // The sequence is assigned before the request starts, so it captures the
  // refresh order. It must be primary: a slow older request can finish later
  // and therefore carry a later HTTP Date header, even though its payload is
  // stale. The server date is retained as a cross-source tie-breaker and for
  // diagnostics, but is not a payload version.
  if (next.localSeq !== previous.localSeq) {
    return next.localSeq - previous.localSeq;
  }

  const incomingServerDate = next.serverDateMs;
  const existingServerDate = previous.serverDateMs;
  if (
    incomingServerDate !== undefined &&
    existingServerDate !== undefined &&
    incomingServerDate !== existingServerDate
  ) {
    return incomingServerDate - existingServerDate;
  }

  return 0;
}

export function isAssetSnapshotNewer(
  incoming: IAssetSnapshotMeta | undefined,
  existing: IAssetSnapshotMeta | undefined,
): boolean {
  return compareAssetSnapshotMeta(incoming, existing) > 0;
}

/**
 * A write without metadata is legacy: it may initialize an unversioned key,
 * but must never clobber a versioned snapshot.
 */
export function canApplyAssetSnapshotMeta(
  incoming: IAssetSnapshotMeta | undefined,
  existing: IAssetSnapshotMeta | undefined,
): boolean {
  if (!normalizeAssetSnapshotMeta(existing)) {
    return true;
  }
  return compareAssetSnapshotMeta(incoming, existing) > 0;
}

export function sameAssetSnapshotMeta(
  left: IAssetSnapshotMeta | undefined,
  right: IAssetSnapshotMeta | undefined,
): boolean {
  return compareAssetSnapshotMeta(left, right) === 0;
}

/** Pick the newest well-formed marker; ties keep the earliest argument. */
export function getNewestAssetSnapshotMeta(
  ...metas: Array<IAssetSnapshotMeta | undefined>
): IAssetSnapshotMeta | undefined {
  let result: IAssetSnapshotMeta | undefined;
  metas.forEach((meta) => {
    const normalized = normalizeAssetSnapshotMeta(meta);
    if (normalized && compareAssetSnapshotMeta(normalized, result) > 0) {
      result = normalized;
    }
  });
  return result;
}

export type { IAssetSnapshotMeta };

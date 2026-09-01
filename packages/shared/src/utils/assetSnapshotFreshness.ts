import type { IAssetSnapshotMeta } from '@onekeyhq/shared/types/assetSnapshot';

// Seed above persisted sequences so a process restart can still order
// header-less writes after snapshots from a previous process in normal cases.
let nextLocalSeq = Date.now() * 1000;

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
 * Compare an incoming snapshot against the persisted snapshot for one key.
 * A positive result means the incoming snapshot is newer.
 */
export function compareAssetSnapshotMeta(
  incoming: IAssetSnapshotMeta | undefined,
  existing: IAssetSnapshotMeta | undefined,
): number {
  if (!incoming && !existing) {
    return 0;
  }
  if (!incoming) {
    return -1;
  }
  if (!existing) {
    return 1;
  }

  // The sequence is assigned before the request starts, so it captures the
  // refresh order. It must be primary: a slow older request can finish later
  // and therefore carry a later HTTP Date header, even though its payload is
  // stale. The server date is retained as a cross-source tie-breaker and for
  // diagnostics, but is not a payload version.
  if (incoming.localSeq !== existing.localSeq) {
    return incoming.localSeq - existing.localSeq;
  }

  const incomingServerDate = normalizeServerDateMs(incoming.serverDateMs);
  const existingServerDate = normalizeServerDateMs(existing.serverDateMs);
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

export type { IAssetSnapshotMeta };

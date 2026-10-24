import type {
  ISwapToken,
  ISwapTokenCatch,
  ISwapTokenListSnapshotMap,
} from '../../types/swap/types';

export const SWAP_TOKEN_SELECTOR_SNAPSHOT_VERSION = 1;
export const SWAP_TOKEN_SELECTOR_SNAPSHOT_MAX_CHARS = 768 * 1024;
const MAX_CHAIN_ENTRIES = 100;

type ISwapTokenListSnapshotEntry = {
  key: string;
  snapshot: ISwapTokenCatch;
  serializedChars: number;
};

// Atom snapshots and their entries are immutable. Reuse validation and size work
// when another chain finishes, or another provider reads the same source again.
const entryCache = new WeakMap<
  object,
  { key: string; entry: ISwapTokenListSnapshotEntry | undefined }
>();
const snapshotCache = new WeakMap<object, ISwapTokenListSnapshotMap>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isTokenList(value: unknown): value is ISwapToken[] {
  return (
    Array.isArray(value) &&
    value.every(
      (token: unknown) =>
        isRecord(token) &&
        typeof token.networkId === 'string' &&
        typeof token.contractAddress === 'string' &&
        typeof token.symbol === 'string' &&
        typeof token.decimals === 'number',
    )
  );
}

function isCompleteListKey(key: string) {
  try {
    const params: unknown = JSON.parse(key);
    return (
      isRecord(params) &&
      typeof params.networkId === 'string' &&
      !params.keywords &&
      params.onlyAccountTokens !== true
    );
  } catch {
    return false;
  }
}

function getSnapshotEntry(key: string, value: unknown) {
  if (!isRecord(value)) {
    return undefined;
  }
  const cached = entryCache.get(value);
  if (cached?.key === key) {
    return cached.entry;
  }
  let entry: ISwapTokenListSnapshotEntry | undefined;
  if (
    isCompleteListKey(key) &&
    isTokenList(value.data) &&
    typeof value.updatedAt === 'number' &&
    Number.isFinite(value.updatedAt)
  ) {
    // Runtime generations restart with the process. Hydrated rows are display
    // snapshots, never proof that a request has completed in this runtime.
    const snapshot: ISwapTokenCatch = {
      data: value.data,
      updatedAt: value.updatedAt,
      identityVersion: 0,
      persisted: true,
    };
    entry = {
      key,
      snapshot,
      serializedChars:
        JSON.stringify(key).length + 1 + JSON.stringify(snapshot).length,
    };
    entryCache.set(snapshot, { key, entry });
  }
  entryCache.set(value, { key, entry });
  return entry;
}

export function getSwapTokenListSnapshotEntries(value: unknown) {
  if (
    !isRecord(value) ||
    value.version !== SWAP_TOKEN_SELECTOR_SNAPSHOT_VERSION ||
    !isRecord(value.tokenCatch)
  ) {
    return [];
  }
  return Object.entries(value.tokenCatch)
    .map(([key, snapshot]) => getSnapshotEntry(key, snapshot))
    .filter((entry): entry is ISwapTokenListSnapshotEntry => Boolean(entry))
    .toSorted(
      (left, right) => right.snapshot.updatedAt - left.snapshot.updatedAt,
    );
}

export function sanitizeSwapTokenListSnapshot(
  value: unknown,
  options?: { maxEntries?: number; maxChars?: number },
): ISwapTokenListSnapshotMap {
  if (!options && isRecord(value)) {
    const cached = snapshotCache.get(value);
    if (cached) {
      return cached;
    }
  }
  const empty: ISwapTokenListSnapshotMap = {
    version: SWAP_TOKEN_SELECTOR_SNAPSHOT_VERSION,
    updatedAt: 0,
    tokenCatch: {},
  };
  const entries = getSwapTokenListSnapshotEntries(value);
  const tokenCatch: Record<string, ISwapTokenCatch> = {};
  let remainingChars =
    (options?.maxChars ?? SWAP_TOKEN_SELECTOR_SNAPSHOT_MAX_CHARS) -
    JSON.stringify(empty).length;
  let remainingEntries = options?.maxEntries ?? MAX_CHAIN_ENTRIES;
  let updatedAt = 0;
  let hasEntries = false;
  for (const { key, snapshot, serializedChars } of entries) {
    const nextUpdatedAt = Math.max(updatedAt, snapshot.updatedAt);
    const chars =
      serializedChars +
      (hasEntries ? 1 : 0) +
      String(nextUpdatedAt).length -
      String(updatedAt).length;
    if (remainingEntries > 0 && chars <= remainingChars) {
      tokenCatch[key] = snapshot;
      remainingChars -= chars;
      remainingEntries -= 1;
      updatedAt = nextUpdatedAt;
      hasEntries = true;
    }
  }
  const snapshot = {
    ...empty,
    updatedAt,
    tokenCatch,
  };
  if (!options && isRecord(value)) {
    snapshotCache.set(value, snapshot);
    snapshotCache.set(snapshot, snapshot);
  }
  return snapshot;
}

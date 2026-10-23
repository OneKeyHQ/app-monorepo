import type {
  ISwapToken,
  ISwapTokenCatch,
  ISwapTokenListSnapshotMap,
} from '../../types/swap/types';

export const SWAP_TOKEN_SELECTOR_SNAPSHOT_VERSION = 1;
export const SWAP_TOKEN_SELECTOR_SNAPSHOT_MAX_CHARS = 768 * 1024;
const MAX_CHAIN_ENTRIES = 100;

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

export function sanitizeSwapTokenListSnapshot(
  value: unknown,
  options?: { maxEntries?: number; maxChars?: number },
): ISwapTokenListSnapshotMap {
  const empty: ISwapTokenListSnapshotMap = {
    version: SWAP_TOKEN_SELECTOR_SNAPSHOT_VERSION,
    updatedAt: 0,
    tokenCatch: {},
  };
  if (
    !isRecord(value) ||
    value.version !== SWAP_TOKEN_SELECTOR_SNAPSHOT_VERSION ||
    !isRecord(value.tokenCatch)
  ) {
    return empty;
  }
  const entries = Object.entries(value.tokenCatch)
    .filter((entry): entry is [string, ISwapTokenCatch] => {
      const [key, snapshot] = entry;
      return (
        isCompleteListKey(key) &&
        isRecord(snapshot) &&
        isTokenList(snapshot.data) &&
        typeof snapshot.updatedAt === 'number'
      );
    })
    .toSorted(([, left], [, right]) => right.updatedAt - left.updatedAt);
  const tokenCatch: Record<string, ISwapTokenCatch> = {};
  let remainingChars =
    options?.maxChars ?? SWAP_TOKEN_SELECTOR_SNAPSHOT_MAX_CHARS;
  let remainingEntries = options?.maxEntries ?? MAX_CHAIN_ENTRIES;
  for (const [key, snapshot] of entries) {
    // Runtime generations restart with the process. Hydrated rows are display
    // snapshots, never proof that a request has completed in this runtime.
    const persisted: ISwapTokenCatch = {
      data: snapshot.data,
      updatedAt: snapshot.updatedAt,
      identityVersion: 0,
      persisted: true,
    };
    const chars = JSON.stringify([key, persisted]).length;
    if (remainingEntries > 0 && chars <= remainingChars) {
      tokenCatch[key] = persisted;
      remainingChars -= chars;
      remainingEntries -= 1;
    }
  }
  return {
    ...empty,
    updatedAt: Math.max(
      0,
      ...Object.values(tokenCatch).map((entry) => entry.updatedAt),
    ),
    tokenCatch,
  };
}

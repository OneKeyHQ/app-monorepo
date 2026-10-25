import { ESwapTabSwitchType } from '../../types/swap/types';
import { CONTEXT_ATOM_COLD_START_CACHE_KEYS } from '../consts/jotaiConsts';
import platformEnvLite from '../platformEnvLite';

import {
  getSwapTokenListSnapshotEntries,
  sanitizeSwapTokenListSnapshot,
} from './swapTokenSelectorSnapshotUtils';

import type { ISwapTokenCatch } from '../../types/swap/types';

export const COLD_START_SNAPSHOT_MAX_CHARS = 1024 * 1024;
export const COLD_START_SNAPSHOT_HARD_MAX_CHARS = 4 * 1024 * 1024;
const DEFAULT_MAX_PERPS_LIST_ITEMS = 100;
export const SWAP_PRO_POSITIONS_CACHE_MAX_OWNERS = 20;
export const SWAP_PRO_POSITIONS_CACHE_MAX_TOKENS_PER_OWNER = 40;
export const SWAP_PRO_POSITIONS_CACHE_MAX_TOTAL_TOKENS = 160;
export const SWAP_PRO_POSITIONS_CACHE_MAX_BYTES = 256 * 1024;
export const SWAP_PRO_POSITIONS_CACHE_VERSION = 1;

type ISnapshotRecord = Record<string, unknown>;
type ISelectorAggregateScope = {
  scopeKey: string;
  entries: { ownerKey: string; tokens: readonly unknown[] }[];
};

const aggregateTokensSerializedChars = new WeakMap<
  readonly unknown[],
  number
>();

function getAggregateTokensSerializedChars(tokens: readonly unknown[]) {
  let chars = aggregateTokensSerializedChars.get(tokens);
  if (chars === undefined) {
    chars = JSON.stringify(tokens).length;
    aggregateTokensSerializedChars.set(tokens, chars);
  }
  return chars;
}

type IPrepareColdStartSnapshotOptions = {
  maxSnapshotChars?: number;
  maxPerpsListItems?: number;
  maxSwapPositionsOwners?: number;
  maxSwapPositionsTokensPerOwner?: number;
  maxSwapPositionsTotalTokens?: number;
  maxSwapPositionsBytes?: number;
};

type IParseColdStartSnapshotOptions = {
  maxSnapshotChars?: number;
};

const PERPS_VOLATILE_LIST_CACHE_KEYS = [
  CONTEXT_ATOM_COLD_START_CACHE_KEYS.perpsActivePositionAtom,
  CONTEXT_ATOM_COLD_START_CACHE_KEYS.perpsActiveOpenOrdersAtom,
];

function isRecord(value: unknown): value is ISnapshotRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isScopedCacheKey(snapshotKey: string, cacheKey: string) {
  return snapshotKey.endsWith(`::${cacheKey}`);
}

function isPerpsVolatileListSnapshotKey(snapshotKey: string) {
  return PERPS_VOLATILE_LIST_CACHE_KEYS.some((cacheKey) =>
    isScopedCacheKey(snapshotKey, cacheKey),
  );
}

function isSwapProPositionsSnapshotKey(snapshotKey: string) {
  return isScopedCacheKey(
    snapshotKey,
    CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapProPositionsCacheAtom,
  );
}

function trimList<T>(list: T[], maxItems: number) {
  return list.length > maxItems ? list.slice(0, maxItems) : list;
}

function getUtf8ByteLength(value: string) {
  let byteLength = 0;
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    if (codePoint <= 0x7f) {
      byteLength += 1;
    } else if (codePoint <= 0x7_ff) {
      byteLength += 2;
    } else if (codePoint <= 0xff_ff) {
      byteLength += 3;
    } else {
      byteLength += 4;
    }
  }
  return byteLength;
}

function getSnapshotValueSerializedBytes(value: unknown) {
  try {
    return getUtf8ByteLength(JSON.stringify(value));
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

export function pruneSwapProPositionsCacheValue<T>({
  value,
  maxOwners = SWAP_PRO_POSITIONS_CACHE_MAX_OWNERS,
  maxTokensPerOwner = SWAP_PRO_POSITIONS_CACHE_MAX_TOKENS_PER_OWNER,
  maxTotalTokens = SWAP_PRO_POSITIONS_CACHE_MAX_TOTAL_TOKENS,
  maxBytes = SWAP_PRO_POSITIONS_CACHE_MAX_BYTES,
}: {
  value: T;
  maxOwners?: number;
  maxTokensPerOwner?: number;
  maxTotalTokens?: number;
  maxBytes?: number;
}): T {
  if (
    !isRecord(value) ||
    value.version !== SWAP_PRO_POSITIONS_CACHE_VERSION ||
    !isRecord(value.byOwner)
  ) {
    return {
      version: SWAP_PRO_POSITIONS_CACHE_VERSION,
      byOwner: {},
    } as T;
  }

  const naturallyEmptyOwnerKeys = new Set<string>();
  const sortedOwnerEntries = Object.entries(value.byOwner)
    .filter((entry): entry is [string, ISnapshotRecord] => isRecord(entry[1]))
    .toSorted(
      ([, left], [, right]) =>
        (typeof right.updatedAt === 'number' ? right.updatedAt : 0) -
        (typeof left.updatedAt === 'number' ? left.updatedAt : 0),
    )
    .slice(0, Math.max(0, maxOwners));
  const byOwner: ISnapshotRecord = {};
  let remainingTokenCount = Math.max(0, maxTotalTokens);

  for (const [ownerKey, entry] of sortedOwnerEntries) {
    if (Array.isArray(entry.tokens)) {
      if (entry.tokens.length === 0) {
        naturallyEmptyOwnerKeys.add(ownerKey);
        byOwner[ownerKey] = { ...entry, tokens: [] };
      } else if (remainingTokenCount > 0) {
        const tokens = entry.tokens.slice(
          0,
          Math.min(Math.max(0, maxTokensPerOwner), remainingTokenCount),
        );
        if (tokens.length > 0) {
          remainingTokenCount -= tokens.length;
          byOwner[ownerKey] = { ...entry, tokens };
        }
      }
    }
  }

  const prunedValue: ISnapshotRecord = {
    version: SWAP_PRO_POSITIONS_CACHE_VERSION,
    byOwner,
  };
  const retainedOwnerKeys = Object.keys(byOwner);
  while (
    retainedOwnerKeys.length > 0 &&
    getSnapshotValueSerializedBytes(prunedValue) > maxBytes
  ) {
    const oldestOwnerKey = retainedOwnerKeys[retainedOwnerKeys.length - 1];
    const oldestEntry = byOwner[oldestOwnerKey];
    const tokens =
      isRecord(oldestEntry) && Array.isArray(oldestEntry.tokens)
        ? oldestEntry.tokens
        : [];
    if (tokens.length > 0) {
      const nextTokens = tokens.slice(0, -1);
      if (
        nextTokens.length === 0 &&
        !naturallyEmptyOwnerKeys.has(oldestOwnerKey)
      ) {
        delete byOwner[oldestOwnerKey];
        retainedOwnerKeys.pop();
      } else if (isRecord(oldestEntry)) {
        byOwner[oldestOwnerKey] = {
          ...oldestEntry,
          tokens: nextTokens,
        };
      }
    } else {
      delete byOwner[oldestOwnerKey];
      retainedOwnerKeys.pop();
    }
  }

  return prunedValue as T;
}

function pruneOpenOrdersByCoin({
  openOrdersByCoin,
  retainedOpenOrders,
  maxItems,
}: {
  openOrdersByCoin: unknown;
  retainedOpenOrders: unknown[];
  maxItems: number;
}) {
  if (!isRecord(openOrdersByCoin)) {
    return openOrdersByCoin;
  }

  const retainedCoins = new Set(
    retainedOpenOrders
      .map((order) => (isRecord(order) ? order.coin : undefined))
      .filter((coin): coin is string => typeof coin === 'string'),
  );
  const nextOpenOrdersByCoin: ISnapshotRecord = {};
  retainedCoins.forEach((coin) => {
    const ordersForCoin = openOrdersByCoin[coin];
    nextOpenOrdersByCoin[coin] = Array.isArray(ordersForCoin)
      ? trimList(ordersForCoin, maxItems)
      : ordersForCoin;
  });
  return nextOpenOrdersByCoin;
}

function prunePerpsSnapshotValue({
  snapshotKey,
  value,
  maxItems,
}: {
  snapshotKey: string;
  value: unknown;
  maxItems: number;
}) {
  if (!isRecord(value)) {
    return value;
  }

  if (
    isScopedCacheKey(
      snapshotKey,
      CONTEXT_ATOM_COLD_START_CACHE_KEYS.perpsActivePositionAtom,
    ) &&
    Array.isArray(value.activePositions)
  ) {
    return {
      ...value,
      activePositions: trimList(value.activePositions, maxItems),
    };
  }

  if (
    isScopedCacheKey(
      snapshotKey,
      CONTEXT_ATOM_COLD_START_CACHE_KEYS.perpsActiveOpenOrdersAtom,
    )
  ) {
    const retainedOpenOrders = Array.isArray(value.openOrders)
      ? trimList(value.openOrders, maxItems)
      : value.openOrders;
    return {
      accountAddress: value.accountAddress,
      openOrders: retainedOpenOrders,
      openOrdersByCoin: pruneOpenOrdersByCoin({
        openOrdersByCoin: value.openOrdersByCoin,
        retainedOpenOrders: Array.isArray(retainedOpenOrders)
          ? retainedOpenOrders
          : [],
        maxItems,
      }),
    };
  }

  return value;
}

function stringifySnapshot(snapshot: ISnapshotRecord) {
  return JSON.stringify(snapshot);
}

export function parseColdStartSnapshotRaw(
  raw: string | undefined,
  options?: IParseColdStartSnapshotOptions,
) {
  if (!raw) {
    return undefined;
  }
  const maxSnapshotChars =
    options?.maxSnapshotChars ?? COLD_START_SNAPSHOT_HARD_MAX_CHARS;
  if (raw.length > maxSnapshotChars) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function prepareBaselineColdStartSnapshotForWrite(
  snapshot: ISnapshotRecord,
  options?: IPrepareColdStartSnapshotOptions,
): {
  snapshot: ISnapshotRecord;
  serialized: string;
  droppedKeys: string[];
} {
  const maxSnapshotChars =
    options?.maxSnapshotChars ?? COLD_START_SNAPSHOT_MAX_CHARS;
  const maxPerpsListItems =
    options?.maxPerpsListItems ?? DEFAULT_MAX_PERPS_LIST_ITEMS;
  const maxSwapPositionsOwners =
    options?.maxSwapPositionsOwners ?? SWAP_PRO_POSITIONS_CACHE_MAX_OWNERS;
  const maxSwapPositionsTokensPerOwner =
    options?.maxSwapPositionsTokensPerOwner ??
    SWAP_PRO_POSITIONS_CACHE_MAX_TOKENS_PER_OWNER;
  const maxSwapPositionsTotalTokens =
    options?.maxSwapPositionsTotalTokens ??
    SWAP_PRO_POSITIONS_CACHE_MAX_TOTAL_TOKENS;
  const maxSwapPositionsBytes =
    options?.maxSwapPositionsBytes ?? SWAP_PRO_POSITIONS_CACHE_MAX_BYTES;

  const prunedSnapshot: ISnapshotRecord = {};
  Object.entries(snapshot).forEach(([key, value]) => {
    const perpsPrunedValue = prunePerpsSnapshotValue({
      snapshotKey: key,
      value,
      maxItems: maxPerpsListItems,
    });
    prunedSnapshot[key] = isSwapProPositionsSnapshotKey(key)
      ? pruneSwapProPositionsCacheValue({
          value: perpsPrunedValue,
          maxOwners: maxSwapPositionsOwners,
          maxTokensPerOwner: maxSwapPositionsTokensPerOwner,
          maxTotalTokens: maxSwapPositionsTotalTokens,
          maxBytes: maxSwapPositionsBytes,
        })
      : perpsPrunedValue;
  });

  const serialized = stringifySnapshot(prunedSnapshot);
  if (serialized.length <= maxSnapshotChars) {
    return { snapshot: prunedSnapshot, serialized, droppedKeys: [] };
  }

  const reducedSnapshot: ISnapshotRecord = { ...prunedSnapshot };
  const droppedKeys: string[] = [];
  Object.keys(reducedSnapshot).forEach((key) => {
    if (isSwapProPositionsSnapshotKey(key)) {
      droppedKeys.push(key);
      delete reducedSnapshot[key];
    }
  });

  const serializedWithoutSwapPositions = stringifySnapshot(reducedSnapshot);
  if (serializedWithoutSwapPositions.length <= maxSnapshotChars) {
    return {
      snapshot: reducedSnapshot,
      serialized: serializedWithoutSwapPositions,
      droppedKeys,
    };
  }

  Object.keys(reducedSnapshot).forEach((key) => {
    if (isPerpsVolatileListSnapshotKey(key)) {
      droppedKeys.push(key);
      delete reducedSnapshot[key];
    }
  });

  if (droppedKeys.length === 0) {
    return { snapshot: prunedSnapshot, serialized, droppedKeys };
  }

  return {
    snapshot: reducedSnapshot,
    serialized: stringifySnapshot(reducedSnapshot),
    droppedKeys,
  };
}

export function prepareColdStartSnapshotForWrite(
  snapshot: ISnapshotRecord,
  options?: IPrepareColdStartSnapshotOptions,
) {
  const selectorKey = CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapTokenMapAtom;
  const selectorScopes = Object.entries(snapshot)
    .filter(([key, value]) => isScopedCacheKey(key, selectorKey) && value)
    .map(([scopeKey, value]) => ({
      scopeKey,
      value: sanitizeSwapTokenListSnapshot(value),
    }));
  const aggregateScopes: ISelectorAggregateScope[] = [];
  const baselineSnapshot: ISnapshotRecord = {};
  Object.entries(snapshot).forEach(([scopeKey, value]) => {
    if (isScopedCacheKey(scopeKey, selectorKey)) return;
    if (
      (platformEnvLite.isDesktop || platformEnvLite.isWeb) &&
      isScopedCacheKey(
        scopeKey,
        CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapAllNetworkTokenListMapAtom,
      ) &&
      isRecord(value)
    ) {
      const entries: ISelectorAggregateScope['entries'] = [];
      const baselineOwners: ISnapshotRecord = {};
      for (const [ownerKey, tokens] of Object.entries(value)) {
        if (
          !ownerKey.split('__').includes(ESwapTabSwitchType.STOCK) &&
          Array.isArray(tokens)
        ) {
          entries.push({ ownerKey, tokens });
        } else {
          baselineOwners[ownerKey] = tokens;
        }
      }
      if (entries.length > 0) {
        aggregateScopes.push({ scopeKey, entries });
        if (Object.keys(baselineOwners).length > 0)
          baselineSnapshot[scopeKey] = baselineOwners;
        return;
      }
    }
    baselineSnapshot[scopeKey] = value;
  });
  if (selectorScopes.length === 0 && aggregateScopes.length === 0) {
    return prepareBaselineColdStartSnapshotForWrite(snapshot, options);
  }

  // The selector may consume spare capacity, but must not make existing SwapPro
  // or Perps caches eligible for eviction. Keep their baseline policy intact.
  const baseline = prepareBaselineColdStartSnapshotForWrite(
    baselineSnapshot,
    options,
  );
  const retainedSnapshot = { ...baseline.snapshot };
  const maxSnapshotChars =
    options?.maxSnapshotChars ?? COLD_START_SNAPSHOT_MAX_CHARS;
  let remainingChars = maxSnapshotChars - baseline.serialized.length;
  let hasSnapshotValues = baseline.serialized !== '{}';
  // Sidebar membership freezes from its first snapshot. Admit whole wallet
  // projections before chain lists, including a valid empty holdings list.
  for (const { scopeKey, entries } of aggregateScopes) {
    const baselineOwners = retainedSnapshot[scopeKey];
    let owners = isRecord(baselineOwners) ? { ...baselineOwners } : undefined;
    let ownerCount = Object.keys(owners ?? {}).length;
    for (const { ownerKey, tokens } of entries) {
      const ownerChars =
        JSON.stringify(ownerKey).length +
        1 +
        getAggregateTokensSerializedChars(tokens);
      const additionalChars = owners
        ? ownerChars + (ownerCount > 0 ? 1 : 0)
        : JSON.stringify(scopeKey).length +
          1 +
          2 +
          ownerChars +
          (hasSnapshotValues ? 1 : 0);
      if (additionalChars <= remainingChars) {
        owners ??= {};
        owners[ownerKey] = tokens;
        retainedSnapshot[scopeKey] = owners;
        ownerCount += 1;
        hasSnapshotValues = true;
        remainingChars -= additionalChars;
      }
    }
  }
  const tokenCatchByScope = new Map<string, Record<string, ISwapTokenCatch>>();
  const candidates = selectorScopes
    .flatMap(({ scopeKey, value }) =>
      getSwapTokenListSnapshotEntries(value).map((entry) => ({
        scopeKey,
        entry,
      })),
    )
    .toSorted(
      (left, right) =>
        right.entry.snapshot.updatedAt - left.entry.snapshot.updatedAt,
    );

  for (const { scopeKey, entry } of candidates) {
    const tokenCatch = tokenCatchByScope.get(scopeKey);
    const scopeEnvelope = {
      version: 1,
      updatedAt: Math.max(0, entry.snapshot.updatedAt),
      tokenCatch: {},
    };
    const additionalChars = tokenCatch
      ? 1 + entry.serializedChars
      : JSON.stringify(scopeKey).length +
        1 +
        JSON.stringify(scopeEnvelope).length +
        entry.serializedChars +
        (hasSnapshotValues ? 1 : 0);
    if (additionalChars <= remainingChars) {
      if (tokenCatch) {
        tokenCatch[entry.key] = entry.snapshot;
      } else {
        const nextTokenCatch = { [entry.key]: entry.snapshot };
        tokenCatchByScope.set(scopeKey, nextTokenCatch);
        retainedSnapshot[scopeKey] = {
          ...scopeEnvelope,
          tokenCatch: nextTokenCatch,
        };
      }
      hasSnapshotValues = true;
      remainingChars -= additionalChars;
    }
  }

  for (const { scopeKey, value } of selectorScopes) {
    if (
      !tokenCatchByScope.has(scopeKey) &&
      Object.keys(value.tokenCatch ?? {}).length === 0
    ) {
      const chars =
        JSON.stringify(scopeKey).length +
        1 +
        JSON.stringify(value).length +
        (hasSnapshotValues ? 1 : 0);
      if (chars <= remainingChars) {
        retainedSnapshot[scopeKey] = value;
        hasSnapshotValues = true;
        remainingChars -= chars;
      }
    }
  }

  return {
    snapshot: retainedSnapshot,
    serialized: stringifySnapshot(retainedSnapshot),
    droppedKeys: [
      ...baseline.droppedKeys,
      ...[...aggregateScopes, ...selectorScopes]
        .filter(({ scopeKey }) => !(scopeKey in retainedSnapshot))
        .map(({ scopeKey }) => scopeKey),
    ],
  };
}

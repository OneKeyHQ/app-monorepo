import { CONTEXT_ATOM_COLD_START_CACHE_KEYS } from '../consts/jotaiConsts';

const DEFAULT_MAX_SNAPSHOT_CHARS = 1024 * 1024;
const DEFAULT_HARD_MAX_SNAPSHOT_CHARS = 4 * 1024 * 1024;
const DEFAULT_MAX_PERPS_LIST_ITEMS = 100;

type ISnapshotRecord = Record<string, unknown>;

type IPrepareColdStartSnapshotOptions = {
  maxSnapshotChars?: number;
  maxPerpsListItems?: number;
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

function trimList<T>(list: T[], maxItems: number) {
  return list.length > maxItems ? list.slice(0, maxItems) : list;
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
    options?.maxSnapshotChars ?? DEFAULT_HARD_MAX_SNAPSHOT_CHARS;
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

export function prepareColdStartSnapshotForWrite(
  snapshot: ISnapshotRecord,
  options?: IPrepareColdStartSnapshotOptions,
): {
  snapshot: ISnapshotRecord;
  serialized: string;
  droppedKeys: string[];
} {
  const maxSnapshotChars =
    options?.maxSnapshotChars ?? DEFAULT_MAX_SNAPSHOT_CHARS;
  const maxPerpsListItems =
    options?.maxPerpsListItems ?? DEFAULT_MAX_PERPS_LIST_ITEMS;

  const prunedSnapshot: ISnapshotRecord = {};
  Object.entries(snapshot).forEach(([key, value]) => {
    prunedSnapshot[key] = prunePerpsSnapshotValue({
      snapshotKey: key,
      value,
      maxItems: maxPerpsListItems,
    });
  });

  const serialized = stringifySnapshot(prunedSnapshot);
  if (serialized.length <= maxSnapshotChars) {
    return { snapshot: prunedSnapshot, serialized, droppedKeys: [] };
  }

  const reducedSnapshot: ISnapshotRecord = { ...prunedSnapshot };
  const droppedKeys: string[] = [];
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

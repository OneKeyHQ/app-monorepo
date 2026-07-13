import BigNumber from 'bignumber.js';
import { Inflate, strFromU8 } from 'fflate';

import type { IBook, IBookLevel } from '@onekeyhq/shared/types/hyperliquid/sdk';

const MAX_LEVELS_PER_SIDE = 200;
const MAX_COMPRESSED_BYTES = 256 * 1024;
const MAX_DECOMPRESSED_BYTES = 1024 * 1024;
const INFLATE_CHUNK_BYTES = 16 * 1024;
const DECIMAL_PATTERN = /^\d+(?:\.\d+)?$/;
const BASE64_PATTERN =
  /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

type IFastL2Level = {
  p: string;
  s: string;
};

type IFastL2Update = {
  c: string;
  t: number;
  l: [IFastL2Level[], IFastL2Level[]];
  r: [number[], number[]];
};

export type IFastL2Frame = { s: IBook } | { u: IFastL2Update } | { c: string };

export type IFastL2BookError = Error & {
  code: 'invalid_stream' | 'stale_target';
};

export function isStaleFastL2TargetError(
  error: unknown,
): error is IFastL2BookError {
  return (
    error instanceof Error && 'code' in error && error.code === 'stale_target'
  );
}

function createFastL2BookError(
  message: string,
  code: 'invalid_stream' | 'stale_target' = 'invalid_stream',
): IFastL2BookError {
  return Object.assign(new Error(`Fast L2 book: ${message}`), { code });
}

function assertFiniteTimestamp(value: unknown): asserts value is number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    throw createFastL2BookError('Invalid L2 timestamp');
  }
}

function assertDecimal(value: unknown, field: string): asserts value is string {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > 64 ||
    !DECIMAL_PATTERN.test(value)
  ) {
    throw createFastL2BookError(`Invalid L2 ${field}`);
  }

  const decimal = new BigNumber(value);
  if (!decimal.isFinite() || decimal.lte(0)) {
    throw createFastL2BookError(`Invalid L2 ${field}`);
  }
}

function comparePrices(left: string, right: string): number {
  return new BigNumber(left).comparedTo(new BigNumber(right));
}

function decodeBase64(value: string): Uint8Array {
  if (
    value.length === 0 ||
    value.length > Math.ceil((MAX_COMPRESSED_BYTES * 4) / 3) + 4 ||
    !BASE64_PATTERN.test(value)
  ) {
    throw createFastL2BookError('Invalid compressed L2 payload');
  }

  const global = globalThis as typeof globalThis & {
    Buffer?: {
      from: (input: string, encoding: 'base64') => Uint8Array;
    };
    atob?: (input: string) => string;
  };
  if (global.Buffer) {
    const decoded = new Uint8Array(global.Buffer.from(value, 'base64'));
    if (decoded.length > MAX_COMPRESSED_BYTES) {
      throw createFastL2BookError('Compressed L2 payload exceeds byte limit');
    }
    return decoded;
  }
  if (!global.atob) {
    throw createFastL2BookError('Base64 decoder is unavailable');
  }

  const binary = global.atob(value);
  if (binary.length > MAX_COMPRESSED_BYTES) {
    throw createFastL2BookError('Compressed L2 payload exceeds byte limit');
  }
  const decoded = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    decoded[index] = binary.charCodeAt(index);
  }
  return decoded;
}

function decodeCompressedUpdate(payload: string): unknown {
  const compressed = decodeBase64(payload);
  const chunks: Uint8Array[] = [];
  let outputLength = 0;
  const inflate = new Inflate((chunk) => {
    outputLength += chunk.length;
    if (outputLength > MAX_DECOMPRESSED_BYTES) {
      throw createFastL2BookError('Decompressed L2 payload exceeds byte limit');
    }
    chunks.push(chunk);
  });

  for (
    let offset = 0;
    offset < compressed.length;
    offset += INFLATE_CHUNK_BYTES
  ) {
    inflate.push(
      compressed.subarray(offset, offset + INFLATE_CHUNK_BYTES),
      offset + INFLATE_CHUNK_BYTES >= compressed.length,
    );
  }

  const output = new Uint8Array(outputLength);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  try {
    return JSON.parse(strFromU8(output));
  } catch {
    throw createFastL2BookError('Invalid decompressed L2 payload');
  }
}

function assertSortedLevels(levels: IBookLevel[], side: 0 | 1): void {
  for (let index = 1; index < levels.length; index += 1) {
    const previous = levels[index - 1];
    const current = levels[index];
    if (!previous || !current) {
      throw createFastL2BookError('Invalid L2 level');
    }
    const comparison = comparePrices(previous.px, current.px);
    if ((side === 0 && comparison <= 0) || (side === 1 && comparison >= 0)) {
      throw createFastL2BookError('Invalid L2 price order');
    }
  }
}

function assertBookInvariant(levels: [IBookLevel[], IBookLevel[]]): void {
  const [bids, asks] = levels;
  assertSortedLevels(bids, 0);
  assertSortedLevels(asks, 1);

  const bestBid = bids[0];
  const bestAsk = asks[0];
  if (bestBid && bestAsk && comparePrices(bestBid.px, bestAsk.px) >= 0) {
    throw createFastL2BookError('Invalid crossed L2 book');
  }
}

function parseSnapshot(snapshot: unknown, expectedCoin: string): IBook {
  if (!snapshot || typeof snapshot !== 'object') {
    throw createFastL2BookError('Invalid L2 snapshot');
  }

  const data = snapshot as Partial<IBook>;
  if (typeof data.coin === 'string' && data.coin !== expectedCoin) {
    throw createFastL2BookError('Stale L2 snapshot target', 'stale_target');
  }
  if (data.coin !== expectedCoin || !Array.isArray(data.levels)) {
    throw createFastL2BookError('Invalid L2 snapshot coin or levels');
  }
  assertFiniteTimestamp(data.time);

  const [bids, asks] = data.levels;
  if (!Array.isArray(bids) || !Array.isArray(asks)) {
    throw createFastL2BookError('Invalid L2 snapshot levels');
  }
  if (bids.length > MAX_LEVELS_PER_SIDE || asks.length > MAX_LEVELS_PER_SIDE) {
    throw createFastL2BookError('L2 snapshot exceeds level limit');
  }

  const normalized: [IBookLevel[], IBookLevel[]] = [
    bids.map((level) => {
      assertDecimal(level?.px, 'price');
      assertDecimal(level?.sz, 'size');
      if (
        typeof level?.n !== 'number' ||
        !Number.isSafeInteger(level.n) ||
        level.n < 0
      ) {
        throw createFastL2BookError('Invalid L2 order count');
      }
      return { px: level.px, sz: level.sz, n: level.n };
    }),
    asks.map((level) => {
      assertDecimal(level?.px, 'price');
      assertDecimal(level?.sz, 'size');
      if (
        typeof level?.n !== 'number' ||
        !Number.isSafeInteger(level.n) ||
        level.n < 0
      ) {
        throw createFastL2BookError('Invalid L2 order count');
      }
      return { px: level.px, sz: level.sz, n: level.n };
    }),
  ];
  assertBookInvariant(normalized);

  return { coin: expectedCoin, time: data.time, levels: normalized } as IBook;
}

function parseUpdate(update: unknown, expectedCoin: string): IFastL2Update {
  if (!update || typeof update !== 'object') {
    throw createFastL2BookError('Invalid L2 update');
  }
  const data = update as Partial<IFastL2Update>;
  if (typeof data.c === 'string' && data.c !== expectedCoin) {
    throw createFastL2BookError('Stale L2 update target', 'stale_target');
  }
  if (
    data.c !== expectedCoin ||
    !Array.isArray(data.l) ||
    !Array.isArray(data.r)
  ) {
    throw createFastL2BookError('Invalid L2 update coin or levels');
  }
  assertFiniteTimestamp(data.t);
  const [bidUpdates, askUpdates] = data.l;
  const [bidRemovals, askRemovals] = data.r;
  if (
    !Array.isArray(bidUpdates) ||
    !Array.isArray(askUpdates) ||
    !Array.isArray(bidRemovals) ||
    !Array.isArray(askRemovals) ||
    bidUpdates.length > MAX_LEVELS_PER_SIDE ||
    askUpdates.length > MAX_LEVELS_PER_SIDE ||
    bidRemovals.length > MAX_LEVELS_PER_SIDE ||
    askRemovals.length > MAX_LEVELS_PER_SIDE
  ) {
    throw createFastL2BookError('Invalid L2 update bounds');
  }

  const normalizeUpdates = (updates: IFastL2Level[]) =>
    updates.map((level) => {
      assertDecimal(level?.p, 'price');
      assertDecimal(level?.s, 'size');
      return { p: level.p, s: level.s };
    });
  const normalizeRemovals = (removals: number[]) =>
    removals.map((index) => {
      if (!Number.isSafeInteger(index) || index < 0) {
        throw createFastL2BookError('Invalid L2 removal index');
      }
      return index;
    });

  return {
    c: expectedCoin,
    t: data.t,
    l: [normalizeUpdates(bidUpdates), normalizeUpdates(askUpdates)],
    r: [normalizeRemovals(bidRemovals), normalizeRemovals(askRemovals)],
  };
}

function mergeSide(
  currentLevels: IBookLevel[],
  updates: IFastL2Level[],
  removals: number[],
  side: 0 | 1,
): IBookLevel[] {
  const removedIndexes = new Set<number>();
  for (const index of removals) {
    if (index >= currentLevels.length || removedIndexes.has(index)) {
      throw createFastL2BookError('Invalid L2 removal index');
    }
    removedIndexes.add(index);
  }

  const levelsByPrice = new Map<string, IBookLevel>();
  currentLevels.forEach((level, index) => {
    if (!removedIndexes.has(index)) {
      levelsByPrice.set(level.px, level);
    }
  });
  updates.forEach((level) => {
    levelsByPrice.set(level.p, { px: level.p, sz: level.s, n: 0 });
  });

  const merged = Array.from(levelsByPrice.values());
  if (merged.length > MAX_LEVELS_PER_SIDE) {
    throw createFastL2BookError('L2 book exceeds level limit');
  }
  merged.sort((left, right) => {
    const comparison = comparePrices(left.px, right.px);
    return side === 0 ? -comparison : comparison;
  });
  return merged;
}

export class FastL2Book {
  private _book: IBook | null = null;

  private readonly _coin: string;

  private readonly _options: Pick<IBook, 'nSigFigs' | 'mantissa'>;

  constructor(
    coin: string,
    options: Pick<IBook, 'nSigFigs' | 'mantissa'> = {},
  ) {
    this._coin = coin;
    this._options = options;
  }

  get hasSnapshot(): boolean {
    return this._book !== null;
  }

  apply(frame: IFastL2Frame): IBook | null {
    if ('s' in frame) {
      this._book = { ...parseSnapshot(frame.s, this._coin), ...this._options };
      return this._book;
    }
    const update = parseUpdate(
      'c' in frame ? decodeCompressedUpdate(frame.c) : frame.u,
      this._coin,
    );
    if (!this._book) {
      return null;
    }
    if (update.t < this._book.time) {
      throw createFastL2BookError('Out-of-order L2 update');
    }

    const levels: [IBookLevel[], IBookLevel[]] = [
      mergeSide(this._book.levels[0], update.l[0], update.r[0], 0),
      mergeSide(this._book.levels[1], update.l[1], update.r[1], 1),
    ];
    assertBookInvariant(levels);
    this._book = {
      coin: this._coin,
      time: update.t,
      levels,
      ...this._options,
    } as IBook;
    return this._book;
  }
}

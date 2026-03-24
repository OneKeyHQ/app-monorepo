import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { AppError, ERROR_CODES } from '../errors';

export interface IPendingOrder {
  orderId: string;
  status: 'pending' | 'executed' | 'approve_only' | 'failed';
  chain: string;
  networkId: string;
  createdAt: number; // unix ms
  updatedAt: number; // unix ms
  fromToken: { contractAddress: string; symbol: string; decimals: number };
  toToken: { contractAddress: string; symbol: string; decimals: number };
  amount: string;
  txData: Record<string, unknown>; // raw build-tx response
  txHash?: string;
  provider?: string;
}

const VALID_STATUSES = new Set([
  'pending',
  'executed',
  'approve_only',
  'failed',
]);
const ORDER_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

const DEFAULT_PENDING_DIR = join(homedir(), '.onekey', 'pending');
const EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

let pendingDir = DEFAULT_PENDING_DIR;

export function _setPendingDirForTest(dir: string): void {
  pendingDir = dir;
}

export function _resetPendingDir(): void {
  pendingDir = DEFAULT_PENDING_DIR;
}

function ensureDir(): void {
  if (!existsSync(pendingDir)) {
    mkdirSync(pendingDir, { recursive: true });
  }
}

function validateOrderId(orderId: string): string {
  if (!orderId || !ORDER_ID_PATTERN.test(orderId)) {
    throw new AppError(
      ERROR_CODES.PARAM_MISSING_REQUIRED.code,
      `Invalid orderId: "${orderId}" contains illegal characters`,
      'orderId must only contain alphanumeric characters, hyphens, or underscores',
    );
  }
  return orderId;
}

function isValidToken(
  t: unknown,
): t is { contractAddress: string; symbol: string; decimals: number } {
  if (typeof t !== 'object' || t === null) return false;
  const obj = t as Record<string, unknown>;
  return (
    typeof obj.contractAddress === 'string' &&
    typeof obj.symbol === 'string' &&
    typeof obj.decimals === 'number' &&
    Number.isFinite(obj.decimals)
  );
}

function validateOrder(parsed: unknown, source: string): IPendingOrder {
  if (typeof parsed !== 'object' || parsed === null) {
    throw new AppError(
      ERROR_CODES.BIZ_SWAP_FAILED.code,
      `Corrupted pending order file: ${source}`,
      'Delete the file and run "onekey swap build" again',
    );
  }
  const o = parsed as Record<string, unknown>;
  if (
    typeof o.orderId !== 'string' ||
    typeof o.chain !== 'string' ||
    typeof o.networkId !== 'string' ||
    typeof o.amount !== 'string' ||
    typeof o.createdAt !== 'number' ||
    !Number.isFinite(o.createdAt) ||
    typeof o.updatedAt !== 'number' ||
    !Number.isFinite(o.updatedAt) ||
    typeof o.status !== 'string' ||
    !VALID_STATUSES.has(o.status) ||
    !isValidToken(o.fromToken) ||
    !isValidToken(o.toToken) ||
    typeof o.txData !== 'object' ||
    o.txData === null
  ) {
    throw new AppError(
      ERROR_CODES.BIZ_SWAP_FAILED.code,
      `Corrupted pending order file: ${source}`,
      'Delete the file and run "onekey swap build" again',
    );
  }
  return o as unknown as IPendingOrder;
}

function filePath(orderId: string): string {
  const safe = validateOrderId(orderId);
  return join(pendingDir, `${safe}.json`);
}

export function savePending(orderId: string, data: IPendingOrder): void {
  ensureDir();
  const path = filePath(orderId);
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8');
  renameSync(tmp, path);
}

export function loadPending(orderId: string): IPendingOrder {
  const path = filePath(orderId);
  if (!existsSync(path)) {
    throw new AppError(
      ERROR_CODES.BIZ_SWAP_EXPIRED.code,
      `Order "${orderId}" not found`,
      'Run "onekey swap build" to create a new order',
    );
  }
  const raw = readFileSync(path, 'utf-8');
  const order = validateOrder(JSON.parse(raw), orderId);

  if (Date.now() - order.createdAt > EXPIRY_MS) {
    throw new AppError(
      ERROR_CODES.BIZ_SWAP_EXPIRED.code,
      `Order "${orderId}" expired (created ${Math.round((Date.now() - order.createdAt) / 1000)}s ago)`,
      'Run "onekey swap build" again to get fresh tx data',
    );
  }

  return order;
}

export function updatePendingStatus(
  orderId: string,
  status: IPendingOrder['status'],
  extra?: Partial<IPendingOrder>,
): void {
  const path = filePath(orderId);
  if (!existsSync(path)) {
    throw new AppError(
      ERROR_CODES.BIZ_SWAP_EXPIRED.code,
      `Order "${orderId}" not found`,
      'Run "onekey swap build" to create a new order',
    );
  }
  const raw = readFileSync(path, 'utf-8');
  const order = validateOrder(JSON.parse(raw), orderId);
  order.status = status;
  order.updatedAt = Date.now();
  if (extra) Object.assign(order, extra);
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, JSON.stringify(order, null, 2), 'utf-8');
  renameSync(tmp, path);
}

export function listPending(options?: {
  chain?: string;
  limit?: number;
}): IPendingOrder[] {
  ensureDir();
  const files = readdirSync(pendingDir).filter((f) => f.endsWith('.json'));
  const orders: IPendingOrder[] = [];

  for (const f of files) {
    try {
      const raw = readFileSync(join(pendingDir, f), 'utf-8');
      const order = validateOrder(JSON.parse(raw), f);
      orders.push(order);
    } catch {
      // Skip corrupted files — they remain on disk for audit
    }
  }

  let result = orders;

  if (options?.chain) {
    result = result.filter((o) => o.chain === options.chain);
  }

  result.sort((a, b) => b.createdAt - a.createdAt);

  if (options?.limit) {
    result = result.slice(0, options.limit);
  }

  return result;
}

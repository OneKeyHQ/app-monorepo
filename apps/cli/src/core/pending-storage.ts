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

function sanitizeOrderId(orderId: string): string {
  const safe = orderId.replace(/[^a-zA-Z0-9_-]/g, '');
  if (!safe) {
    throw new AppError(
      ERROR_CODES.PARAM_MISSING_REQUIRED.code,
      'Invalid orderId: empty after sanitization',
      'Provide a valid orderId containing alphanumeric characters, hyphens, or underscores',
    );
  }
  return safe;
}

function filePath(orderId: string): string {
  const safe = sanitizeOrderId(orderId);
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
  const order = JSON.parse(raw) as IPendingOrder;

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
  const order = JSON.parse(raw) as IPendingOrder;
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
  let orders = files.map((f) => {
    const raw = readFileSync(join(pendingDir, f), 'utf-8');
    return JSON.parse(raw) as IPendingOrder;
  });

  if (options?.chain) {
    orders = orders.filter((o) => o.chain === options.chain);
  }

  orders.sort((a, b) => b.createdAt - a.createdAt);

  if (options?.limit) {
    orders = orders.slice(0, options.limit);
  }

  return orders;
}

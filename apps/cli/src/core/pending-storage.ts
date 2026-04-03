import { randomBytes } from 'node:crypto';
import {
  existsSync,
  lstatSync,
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
  toNetworkId?: string; // cross-chain: destination network
  protocolType?: 'Swap' | 'Bridge'; // protocol used for this order
  allowanceResult?: {
    allowanceTarget: string;
    amount: string;
    shouldResetApprove?: boolean;
  } | null;
}

const VALID_STATUSES = new Set([
  'pending',
  'executed',
  'approve_only',
  'failed',
]);
const ORDER_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;
const UPDATE_EXTRA_ALLOWLIST = new Set(['txHash', 'provider']);

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

function isRegularFile(p: string): boolean {
  try {
    return lstatSync(p).isFile();
  } catch {
    return false;
  }
}

function readOrderFile(path: string, orderId: string): IPendingOrder {
  let raw: string;
  try {
    raw = readFileSync(path, 'utf-8');
  } catch (err: unknown) {
    const code =
      err instanceof Error && 'code' in err
        ? (err as NodeJS.ErrnoException).code
        : undefined;
    if (code === 'ENOENT') {
      throw new AppError(
        ERROR_CODES.BIZ_SWAP_EXPIRED.code,
        `Order "${orderId}" not found`,
        'Run "onekey swap build" to create a new order',
      );
    }
    throw new AppError(
      ERROR_CODES.BIZ_SWAP_FAILED.code,
      `Failed to read order "${orderId}"`,
      'Check file permissions and try again',
      { cause: err },
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new AppError(
      ERROR_CODES.BIZ_SWAP_FAILED.code,
      `Corrupted pending order file: ${orderId}`,
      'Delete the file and run "onekey swap build" again',
    );
  }

  return validateOrder(parsed, orderId);
}

function tmpPath(path: string): string {
  const suffix = randomBytes(4).toString('hex');
  return `${path}.${process.pid}-${suffix}.tmp`;
}

function atomicWrite(path: string, data: string): void {
  const tmp = tmpPath(path);
  writeFileSync(tmp, data, 'utf-8');
  renameSync(tmp, path);
}

export function savePending(orderId: string, data: IPendingOrder): void {
  validateOrderId(orderId);
  if (data.orderId !== orderId) {
    throw new AppError(
      ERROR_CODES.PARAM_MISSING_REQUIRED.code,
      `orderId mismatch: argument "${orderId}" vs data.orderId "${data.orderId}"`,
      'Ensure orderId argument matches the data object',
    );
  }
  validateOrder(data, orderId);
  ensureDir();
  const path = filePath(orderId);
  atomicWrite(path, JSON.stringify(data, null, 2));
}

export function loadPending(
  orderId: string,
  options?: { skipExpiry?: boolean; expiryMs?: number },
): IPendingOrder {
  const path = filePath(orderId);
  if (!isRegularFile(path)) {
    throw new AppError(
      ERROR_CODES.BIZ_SWAP_EXPIRED.code,
      `Order "${orderId}" not found`,
      'Run "onekey swap build" to create a new order',
    );
  }
  const order = readOrderFile(path, orderId);

  const expiryMs = options?.expiryMs ?? EXPIRY_MS;
  if (!options?.skipExpiry && Date.now() - order.createdAt > expiryMs) {
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
  extra?: Partial<Pick<IPendingOrder, 'txHash' | 'provider'>>,
): void {
  if (!VALID_STATUSES.has(status)) {
    throw new AppError(
      ERROR_CODES.PARAM_MISSING_REQUIRED.code,
      `Invalid status: "${status}"`,
      `status must be one of: ${[...VALID_STATUSES].join(', ')}`,
    );
  }
  const path = filePath(orderId);
  if (!isRegularFile(path)) {
    throw new AppError(
      ERROR_CODES.BIZ_SWAP_EXPIRED.code,
      `Order "${orderId}" not found`,
      'Run "onekey swap build" to create a new order',
    );
  }
  const order = readOrderFile(path, orderId);
  order.status = status;
  order.updatedAt = Date.now();
  if (extra) {
    for (const key of Object.keys(extra)) {
      if (UPDATE_EXTRA_ALLOWLIST.has(key)) {
        (order as unknown as Record<string, unknown>)[key] = (
          extra as unknown as Record<string, unknown>
        )[key];
      }
    }
  }
  atomicWrite(path, JSON.stringify(order, null, 2));
}

export function listPending(options?: {
  chain?: string;
  limit?: number;
}): IPendingOrder[] {
  ensureDir();
  const entries = readdirSync(pendingDir, { withFileTypes: true });
  const orders: IPendingOrder[] = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) {
      // Skip directories, symlinks, and non-json files
    } else {
      try {
        const raw = readFileSync(join(pendingDir, entry.name), 'utf-8');
        const parsed = JSON.parse(raw);
        const order = validateOrder(parsed, entry.name);
        orders.push(order);
      } catch (err) {
        if (err instanceof AppError || err instanceof SyntaxError) {
          // Skip corrupted/invalid files — they remain on disk for audit
        } else {
          throw err;
        }
      }
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

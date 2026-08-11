import fs from 'fs/promises';
import path from 'path';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

export const CUSTOM_INJECTED_OPERATION_LOG_RELATIVE_DIRECTORY = path.join(
  'logs',
  'custom-injection',
);
export const CUSTOM_INJECTED_OPERATION_LOG_FILE = 'operations.jsonl';
export const CUSTOM_INJECTED_OPERATION_LOG_MAX_BYTES = 2 * 1024 * 1024;
export const CUSTOM_INJECTED_OPERATION_LOG_MAX_FILES = 5;

const CUSTOM_INJECTED_OPERATION_LOG_MAX_ENTRY_BYTES = 256 * 1024;
const CUSTOM_INJECTED_OPERATION_LOG_MAX_STRING_LENGTH = 64 * 1024;
const CUSTOM_INJECTED_OPERATION_LOG_MAX_DEPTH = 6;
const CUSTOM_INJECTED_OPERATION_LOG_MAX_COLLECTION_SIZE = 100;
const SENSITIVE_KEY =
  /(?:api.?key|authorization|bearer|clipboard|cookie|credential|form.?value|mnemonic|passphrase|password|pin|private.?key|secret|seed|token)/iu;
const writeQueues = new Map<string, Promise<void>>();

export type ICustomInjectedOperationLogStatus = 'error' | 'result' | 'start';

export type ICustomInjectedOperationLogEvent = {
  operationId: string;
  operation: string;
  status: ICustomInjectedOperationLogStatus;
  sessionId?: string;
  protocol?: {
    key: string;
    source: string;
    id: string;
    name: string;
  };
  durationMs?: number;
  input?: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: unknown;
};

export type ICustomInjectedOperationLogRecord = {
  schemaVersion: 1;
  kind: 'onekey-custom-injection-operation';
  timestamp: string;
  operationId: string;
  operation: string;
  status: ICustomInjectedOperationLogStatus;
  sessionId?: string;
  protocol?: {
    key: string;
    source: string;
    id: string;
    name: string;
  };
  durationMs?: number;
  input?: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: unknown;
  entryTruncated?: boolean;
};

export function selectCustomInjectedRecentOperationLogs(
  records: ICustomInjectedOperationLogRecord[],
  recentLimit = 100,
  olderFailureLimit = 100,
): ICustomInjectedOperationLogRecord[] {
  const boundedRecentLimit = Math.max(1, Math.floor(recentLimit));
  const boundedFailureLimit = Math.max(0, Math.floor(olderFailureLimit));
  const recentStart = Math.max(0, records.length - boundedRecentLimit);
  const olderFailures = boundedFailureLimit
    ? records
        .slice(0, recentStart)
        .filter(
          (record) =>
            record.status === 'error' ||
            (record.status === 'result' && record.result?.passed === false),
        )
        .slice(-boundedFailureLimit)
    : [];
  return [...olderFailures, ...records.slice(recentStart)];
}

type ICustomInjectedOperationLogOptions = {
  maxBytes?: number;
  maxFiles?: number;
  now?: () => Date;
};

function truncateString(value: string): string {
  if (value.length <= CUSTOM_INJECTED_OPERATION_LOG_MAX_STRING_LENGTH) {
    return value;
  }
  const removed =
    value.length - CUSTOM_INJECTED_OPERATION_LOG_MAX_STRING_LENGTH;
  return `[Earlier content truncated by ${String(removed)} characters]\n${value.slice(
    -CUSTOM_INJECTED_OPERATION_LOG_MAX_STRING_LENGTH,
  )}`;
}

function sanitizeValue(value: unknown, key = '', depth = 0): unknown {
  if (SENSITIVE_KEY.test(key)) return '[REDACTED]';
  if (
    value === null ||
    value === undefined ||
    typeof value === 'boolean' ||
    typeof value === 'number'
  ) {
    return value;
  }
  if (typeof value === 'string') return truncateString(value);
  if (value instanceof Error) {
    const extraProperties = Object.fromEntries(
      Object.entries(value).map(([entryKey, entryValue]) => [
        entryKey,
        sanitizeValue(entryValue, entryKey, depth + 1),
      ]),
    );
    return {
      name: value.name,
      message: truncateString(value.message),
      ...(value.stack ? { stack: truncateString(value.stack) } : undefined),
      ...extraProperties,
    };
  }
  if (depth >= CUSTOM_INJECTED_OPERATION_LOG_MAX_DEPTH) {
    return '[MAX_DEPTH_REACHED]';
  }
  if (Array.isArray(value)) {
    const retained = value
      .slice(0, CUSTOM_INJECTED_OPERATION_LOG_MAX_COLLECTION_SIZE)
      .map((item) => sanitizeValue(item, key, depth + 1));
    if (value.length > retained.length) {
      retained.push(
        `[${String(value.length - retained.length)} more items truncated]`,
      );
    }
    return retained;
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).slice(
      0,
      CUSTOM_INJECTED_OPERATION_LOG_MAX_COLLECTION_SIZE,
    );
    const sanitized = Object.fromEntries(
      entries.map(([entryKey, entryValue]) => [
        entryKey,
        sanitizeValue(entryValue, entryKey, depth + 1),
      ]),
    );
    const totalKeys = Object.keys(value).length;
    if (totalKeys > entries.length) {
      sanitized.__truncatedKeys = totalKeys - entries.length;
    }
    return sanitized;
  }
  return truncateString(String(value));
}

function isInside(parent: string, child: string): boolean {
  const relative = path.relative(parent, child);
  return (
    relative === '' ||
    (relative !== '..' &&
      !relative.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relative))
  );
}

async function regularFileSize(file: string): Promise<number> {
  try {
    const stat = await fs.lstat(file);
    if (!stat.isFile() || stat.isSymbolicLink()) {
      throw new OneKeyLocalError(
        `Custom injection operation log must be a regular file: ${file}`,
      );
    }
    return stat.size;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return 0;
    throw error;
  }
}

function rotatedLogFile(directory: string, index: number): string {
  return path.join(directory, `operations.${String(index)}.jsonl`);
}

async function rotateLogs(
  directory: string,
  activeFile: string,
  maxFiles: number,
): Promise<void> {
  const archiveCount = Math.max(0, maxFiles - 1);
  if (archiveCount === 0) {
    await fs.unlink(activeFile).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'ENOENT') throw error;
    });
    return;
  }
  await fs
    .unlink(rotatedLogFile(directory, archiveCount))
    .catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'ENOENT') throw error;
    });
  for (let index = archiveCount - 1; index >= 1; index -= 1) {
    const source = rotatedLogFile(directory, index);
    const target = rotatedLogFile(directory, index + 1);
    await fs.rename(source, target).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'ENOENT') throw error;
    });
  }
  await fs
    .rename(activeFile, rotatedLogFile(directory, 1))
    .catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'ENOENT') throw error;
    });
}

function serializeEvent(
  event: ICustomInjectedOperationLogEvent,
  timestamp: string,
): string {
  const sanitized = sanitizeValue({
    schemaVersion: 1,
    kind: 'onekey-custom-injection-operation',
    timestamp,
    ...event,
  });
  let line = `${JSON.stringify(sanitized)}\n`;
  if (Buffer.byteLength(line) > CUSTOM_INJECTED_OPERATION_LOG_MAX_ENTRY_BYTES) {
    line = `${JSON.stringify({
      schemaVersion: 1,
      kind: 'onekey-custom-injection-operation',
      timestamp,
      operationId: event.operationId,
      operation: event.operation,
      status: event.status,
      entryTruncated: true,
    })}\n`;
  }
  return line;
}

function isOperationLogRecord(
  value: unknown,
): value is ICustomInjectedOperationLogRecord {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<ICustomInjectedOperationLogRecord>;
  return (
    record.schemaVersion === 1 &&
    record.kind === 'onekey-custom-injection-operation' &&
    typeof record.timestamp === 'string' &&
    typeof record.operationId === 'string' &&
    typeof record.operation === 'string' &&
    (record.status === 'start' ||
      record.status === 'result' ||
      record.status === 'error')
  );
}

async function resolveLogDirectoryForReading(
  workspace: string,
): Promise<string | undefined> {
  if (!path.isAbsolute(workspace)) {
    throw new OneKeyLocalError(
      'Custom injection operation log workspace must be absolute',
    );
  }
  const canonicalWorkspace = await fs.realpath(workspace);
  const directory = path.join(
    canonicalWorkspace,
    CUSTOM_INJECTED_OPERATION_LOG_RELATIVE_DIRECTORY,
  );
  try {
    const directoryStat = await fs.lstat(directory);
    if (!directoryStat.isDirectory() || directoryStat.isSymbolicLink()) {
      throw new OneKeyLocalError(
        'Custom injection operation log directory must be a regular directory',
      );
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
  const canonicalDirectory = await fs.realpath(directory);
  if (!isInside(canonicalWorkspace, canonicalDirectory)) {
    throw new OneKeyLocalError(
      'Custom injection operation log directory escapes workspace',
    );
  }
  return canonicalDirectory;
}

export async function readCustomInjectedOperationLogs(
  workspace: string,
  limit = 100,
): Promise<ICustomInjectedOperationLogRecord[]> {
  const boundedLimit = Math.max(1, Math.min(1000, Math.floor(limit)));
  const directory = await resolveLogDirectoryForReading(workspace);
  if (!directory) return [];

  const newestFirstFiles = [
    path.join(directory, CUSTOM_INJECTED_OPERATION_LOG_FILE),
    ...Array.from(
      { length: CUSTOM_INJECTED_OPERATION_LOG_MAX_FILES - 1 },
      (_, index) => rotatedLogFile(directory, index + 1),
    ),
  ];
  const newestFirstRecords: ICustomInjectedOperationLogRecord[] = [];
  for (const file of newestFirstFiles) {
    const size = await regularFileSize(file);
    if (size) {
      if (
        size >
        CUSTOM_INJECTED_OPERATION_LOG_MAX_BYTES +
          CUSTOM_INJECTED_OPERATION_LOG_MAX_ENTRY_BYTES
      ) {
        throw new OneKeyLocalError(
          `Custom injection operation log is unexpectedly large: ${file}`,
        );
      }
      const lines = (await fs.readFile(file, 'utf8')).trim().split('\n');
      for (let index = lines.length - 1; index >= 0; index -= 1) {
        const line = lines[index];
        if (line) {
          try {
            const value = JSON.parse(line) as unknown;
            if (isOperationLogRecord(value)) newestFirstRecords.push(value);
          } catch {
            // Ignore an incomplete final line left by an interrupted write.
          }
          if (newestFirstRecords.length >= boundedLimit) {
            return newestFirstRecords.toReversed();
          }
        }
      }
    }
  }
  return newestFirstRecords.toReversed();
}

export async function getCustomInjectedOperationLogFile(
  workspace: string,
): Promise<string> {
  const directory = await resolveLogDirectoryForReading(workspace);
  if (!directory) {
    throw new OneKeyLocalError(
      'Custom injection operation log directory is unavailable',
    );
  }
  const file = path.join(directory, CUSTOM_INJECTED_OPERATION_LOG_FILE);
  if (!(await regularFileSize(file))) {
    throw new OneKeyLocalError(
      'Custom injection operation log file is unavailable',
    );
  }
  return file;
}

export async function appendCustomInjectedOperationLog(
  workspace: string,
  event: ICustomInjectedOperationLogEvent,
  options: ICustomInjectedOperationLogOptions = {},
): Promise<string> {
  if (!path.isAbsolute(workspace)) {
    throw new OneKeyLocalError(
      'Custom injection operation log workspace must be absolute',
    );
  }
  if (!/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/u.test(event.operation)) {
    throw new OneKeyLocalError(
      'Custom injection operation log operation is invalid',
    );
  }
  const maxBytes = Math.max(
    1024,
    options.maxBytes || CUSTOM_INJECTED_OPERATION_LOG_MAX_BYTES,
  );
  const maxFiles = Math.max(
    1,
    Math.min(20, options.maxFiles || CUSTOM_INJECTED_OPERATION_LOG_MAX_FILES),
  );
  const canonicalWorkspace = await fs.realpath(workspace);
  const directory = path.join(
    canonicalWorkspace,
    CUSTOM_INJECTED_OPERATION_LOG_RELATIVE_DIRECTORY,
  );
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  const canonicalDirectory = await fs.realpath(directory);
  if (!isInside(canonicalWorkspace, canonicalDirectory)) {
    throw new OneKeyLocalError(
      'Custom injection operation log directory escapes workspace',
    );
  }
  const activeFile = path.join(
    canonicalDirectory,
    CUSTOM_INJECTED_OPERATION_LOG_FILE,
  );
  const line = serializeEvent(
    event,
    (options.now || (() => new Date()))().toISOString(),
  );
  const previous = writeQueues.get(activeFile) || Promise.resolve();
  const next = previous
    .catch(() => undefined)
    .then(async () => {
      const currentSize = await regularFileSize(activeFile);
      if (currentSize > 0 && currentSize + Buffer.byteLength(line) > maxBytes) {
        await rotateLogs(canonicalDirectory, activeFile, maxFiles);
      }
      await fs.appendFile(activeFile, line, {
        encoding: 'utf8',
        flag: 'a',
        mode: 0o600,
      });
    });
  writeQueues.set(activeFile, next);
  try {
    await next;
  } finally {
    if (writeQueues.get(activeFile) === next) writeQueues.delete(activeFile);
  }
  return activeFile;
}

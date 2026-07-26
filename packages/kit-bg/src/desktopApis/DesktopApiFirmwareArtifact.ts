import crypto from 'crypto';
import fs from 'fs';
import https from 'https';
import net from 'net';
import path from 'path';

import { app } from 'electron';
import yauzl from 'yauzl';

import {
  FIRMWARE_ARTIFACT_MAX_READ_BYTES,
  FIRMWARE_ARTIFACT_PROTOCOL_VERSION,
} from '../services/ServiceFirmwareUpdate/FirmwareArtifactStore';

import {
  FirmwareArtifactDesktopError,
  classifyFirmwareArtifactStorageFailure,
  firmwareArtifactDesktopError,
} from './FirmwareArtifactDesktopError';

import type { IDesktopApi } from './instance/IDesktopApi';
import type {
  IFirmwareArchiveMaterializeEntry,
  IFirmwareArchiveMaterializedArtifact,
  IFirmwareArtifactAdapterCapabilities,
  IFirmwareArtifactAdapterReceipt,
  IFirmwareArtifactAdapterStatus,
  IFirmwareArtifactLeaseDisposition,
  IFirmwareArtifactStoreAdapter,
} from '../services/ServiceFirmwareUpdate/FirmwareArtifactStore';
import type { ClientRequest, IncomingMessage } from 'http';

const STATE_SCHEMA_VERSION = 1;
const MAX_ARTIFACT_BYTES = 512 * 1024 * 1024;
const MAX_ARCHIVE_ENTRIES = 32;
const MAX_ARCHIVE_NAME_BYTES = 1024;
const MAX_ARCHIVE_TOTAL_BYTES = 256 * 1024 * 1024;
const MAX_ARCHIVE_COMPRESSION_RATIO = 1000;
const MAX_DOWNLOAD_RETRIES = 3;
const STALL_TIMEOUT_MS = 60_000;
const ORPHAN_GRACE_MS = 24 * 60 * 60 * 1000;
const SHA256_PATTERN = /^[0-9a-f]{64}$/i;
const OPAQUE_REF_PATTERN = /^[a-z0-9-]{1,200}$/;
const WINDOWS_DEVICE_NAMES = new Set([
  'AUX',
  'CON',
  'NUL',
  'PRN',
  'COM1',
  'COM2',
  'COM3',
  'COM4',
  'COM5',
  'COM6',
  'COM7',
  'COM8',
  'COM9',
  'LPT1',
  'LPT2',
  'LPT3',
  'LPT4',
  'LPT5',
  'LPT6',
  'LPT7',
  'LPT8',
  'LPT9',
]);
const NESTED_ARCHIVE_EXTENSIONS = new Set([
  '7z',
  'bz2',
  'cab',
  'gz',
  'rar',
  'tar',
  'tgz',
  'xz',
  'zip',
]);
const RETRYABLE_NETWORK_CODES = new Set([
  'ECONNABORTED',
  'ECONNREFUSED',
  'ECONNRESET',
  'EHOSTDOWN',
  'EHOSTUNREACH',
  'ENETDOWN',
  'ENETRESET',
  'ENETUNREACH',
  'ENOTFOUND',
  'EPIPE',
  'ERR_STREAM_PREMATURE_CLOSE',
  'ETIMEDOUT',
]);

type IDesktopArtifactMetadata = IFirmwareArtifactAdapterReceipt & {
  artifactId: string;
  fileName: string;
  createdAt: number;
  updatedAt: number;
};

type IDesktopArtifactLease = {
  transactionId: string;
  artifactRefs: string[];
  createdAt: number;
};

type IDesktopArtifactTask = {
  leaseRef: string;
  taskId: string;
  artifactRef: string;
  updatedAt: number;
};

type IDesktopArtifactState = {
  schemaVersion: typeof STATE_SCHEMA_VERSION;
  artifacts: Record<string, IDesktopArtifactMetadata>;
  leases: Record<string, IDesktopArtifactLease>;
  tasks: Record<string, IDesktopArtifactTask>;
};

type IActiveDownload = {
  artifactRef: string;
  cancelled: boolean;
  requests: Set<ClientRequest>;
};

type IActiveReader = {
  artifactRef: string;
  immutableToken: string;
  size: number;
  handle: fs.promises.FileHandle;
};

type IFirmwareProbe = {
  supportsRange: boolean;
  total: number;
  strongETag?: string;
  lastModified?: string;
};

export type IFirmwareArchiveEntryFacts = {
  name: string;
  compressedSize: number;
  uncompressedSize: number;
  compressionMethod: number;
  generalPurposeBitFlag: number;
  versionMadeBy: number;
  externalFileAttributes: number;
};

type IValidatedArchiveEntry = {
  facts: IFirmwareArchiveEntryFacts;
  allowed: IFirmwareArchiveMaterializeEntry;
};

type IDesktopFirmwareArtifactOptions = {
  rootDir?: string;
  allowNonDefaultPortForTests?: boolean;
  trustedCaForTests?: string | Buffer;
  now?: () => number;
};

const firmwareError = (
  code: string,
  message: string,
  retryable = false,
  discardStaging = false,
  cause?: unknown,
): FirmwareArtifactDesktopError =>
  firmwareArtifactDesktopError(code, message, retryable, discardStaging, cause);

const byteLength = (value: string): number => Buffer.byteLength(value, 'utf8');

const exactPositiveInteger = (
  value: number,
  field: string,
  maximum = Number.MAX_SAFE_INTEGER,
): number => {
  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value) ||
    value <= 0 ||
    value > maximum
  ) {
    throw firmwareError(
      'ARTIFACT_INVALID_REQUEST',
      `${field} must be a positive safe integer`,
    );
  }
  return value;
};

const exactPositiveDuration = (value: number, field: string): number => {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value <= 0 ||
    value > 30 * 60
  ) {
    throw firmwareError(
      'ARTIFACT_INVALID_REQUEST',
      `${field} must be within the 30-minute transfer limit`,
    );
  }
  return value;
};

const assertOpaqueRef = (value: string, field: string): string => {
  if (
    typeof value !== 'string' ||
    !OPAQUE_REF_PATTERN.test(value) ||
    byteLength(value) > 256
  ) {
    throw firmwareError(
      'ARTIFACT_INVALID_REQUEST',
      `${field} is not a valid opaque reference`,
    );
  }
  return value;
};

const taskKey = (leaseRef: string, taskId: string): string =>
  crypto
    .createHash('sha256')
    .update(`${leaseRef}\u0000${taskId}`)
    .digest('hex');

const artifactRefFor = (sha256: string, size: number): string =>
  `artifact-${sha256.toLowerCase()}-${size}`;

const fileNameFor = (artifactRef: string): string => `${artifactRef}.bin`;

const createPinnedLookup =
  (resolvedIp: string): net.LookupFunction =>
  (_hostname, options, callback) => {
    const family = net.isIP(resolvedIp);
    if ('all' in options && options.all) {
      callback(null, [{ address: resolvedIp, family }]);
      return;
    }
    callback(null, resolvedIp, family);
  };

const collisionKey = (name: string): string =>
  name.normalize('NFC').toLowerCase();

export const isCanonicalPortableArchiveName = (name: string): boolean => {
  if (
    typeof name !== 'string' ||
    name.length === 0 ||
    byteLength(name) > MAX_ARCHIVE_NAME_BYTES ||
    name !== name.normalize('NFC') ||
    name.startsWith('/') ||
    name.startsWith('\\') ||
    name.includes(':')
  ) {
    return false;
  }
  for (const character of name) {
    const code = character.codePointAt(0) ?? 0;
    if (code === 0 || code < 0x20 || code === 0x7f) return false;
  }
  const components = name.split(/[\\/]/u);
  return (
    components.length > 0 &&
    components.every((component) => {
      const basename = component.split('.', 1)[0]?.toUpperCase() ?? '';
      return (
        component.length > 0 &&
        component !== '.' &&
        component !== '..' &&
        !component.endsWith('.') &&
        !component.endsWith(' ') &&
        !WINDOWS_DEVICE_NAMES.has(basename)
      );
    })
  );
};

const isRegularZipEntry = (entry: IFirmwareArchiveEntryFacts): boolean => {
  const hostSystem = (entry.versionMadeBy >>> 8) & 0xff;
  if (hostSystem === 3 || hostSystem === 19) {
    const fileType = (entry.externalFileAttributes >>> 16) & 0xf0_00;
    return fileType === 0 || fileType === 0x80_00;
  }
  return (entry.externalFileAttributes & 0x10) === 0;
};

const isNestedArchive = (name: string): boolean => {
  const leaf = name.split(/[\\/]/u).at(-1) ?? '';
  const extension = leaf.includes('.')
    ? (leaf.split('.').at(-1) ?? '').toLowerCase()
    : '';
  return NESTED_ARCHIVE_EXTENSIONS.has(extension);
};

export const validateFirmwareArchiveEntries = ({
  entries,
  allowList,
}: {
  entries: readonly IFirmwareArchiveEntryFacts[];
  allowList: readonly IFirmwareArchiveMaterializeEntry[];
}): IValidatedArchiveEntry[] => {
  if (
    allowList.length === 0 ||
    allowList.length > MAX_ARCHIVE_ENTRIES ||
    entries.length !== allowList.length ||
    entries.length > MAX_ARCHIVE_ENTRIES
  ) {
    throw firmwareError(
      allowList.length > MAX_ARCHIVE_ENTRIES ||
        entries.length > MAX_ARCHIVE_ENTRIES
        ? 'ARTIFACT_ARCHIVE_LIMIT_EXCEEDED'
        : 'ARTIFACT_ARCHIVE_INVALID_ALLOW_LIST',
      'Firmware archive allow-list does not match the archive',
    );
  }

  const allowedByName = new Map<string, IFirmwareArchiveMaterializeEntry>();
  const allowedCollisions = new Set<string>();
  let totalExpected = 0;
  for (const allowed of allowList) {
    const expectedSize = exactPositiveInteger(
      allowed.expectedSize,
      'archive expectedSize',
      MAX_ARCHIVE_TOTAL_BYTES,
    );
    if (
      !isCanonicalPortableArchiveName(allowed.archiveName) ||
      typeof allowed.artifactId !== 'string' ||
      allowed.artifactId.length === 0 ||
      byteLength(allowed.artifactId) > 256 ||
      !SHA256_PATTERN.test(allowed.expectedSha256) ||
      allowedByName.has(allowed.archiveName) ||
      allowedCollisions.has(collisionKey(allowed.archiveName))
    ) {
      throw firmwareError(
        'ARTIFACT_ARCHIVE_INVALID_ALLOW_LIST',
        'Firmware archive allow-list contains an invalid entry',
      );
    }
    totalExpected += expectedSize;
    if (totalExpected > MAX_ARCHIVE_TOTAL_BYTES) {
      throw firmwareError(
        'ARTIFACT_ARCHIVE_LIMIT_EXCEEDED',
        'Firmware archive allow-list exceeds the size limit',
      );
    }
    allowedByName.set(allowed.archiveName, allowed);
    allowedCollisions.add(collisionKey(allowed.archiveName));
  }

  const names = new Set<string>();
  const collisions = new Set<string>();
  let totalDeclared = 0;
  const validated = entries.map((entry) => {
    if (
      !Number.isSafeInteger(entry.compressedSize) ||
      !Number.isSafeInteger(entry.uncompressedSize) ||
      entry.compressedSize < 0 ||
      entry.uncompressedSize <= 0 ||
      !isCanonicalPortableArchiveName(entry.name) ||
      names.has(entry.name) ||
      collisions.has(collisionKey(entry.name))
    ) {
      throw firmwareError(
        'ARTIFACT_ARCHIVE_INVALID_ENTRY',
        'Firmware archive contains an invalid or duplicate entry',
      );
    }
    if (
      (entry.generalPurposeBitFlag & 1) !== 0 ||
      (entry.compressionMethod !== 0 && entry.compressionMethod !== 8) ||
      !isRegularZipEntry(entry) ||
      isNestedArchive(entry.name)
    ) {
      throw firmwareError(
        'ARTIFACT_ARCHIVE_UNSUPPORTED_ENTRY',
        'Firmware archive contains an unsupported entry',
      );
    }
    if (
      entry.compressedSize === 0 ||
      Math.floor(entry.uncompressedSize / Math.max(entry.compressedSize, 1)) >
        MAX_ARCHIVE_COMPRESSION_RATIO
    ) {
      throw firmwareError(
        'ARTIFACT_ARCHIVE_LIMIT_EXCEEDED',
        'Firmware archive entry exceeds the compression limit',
      );
    }
    totalDeclared += entry.uncompressedSize;
    if (totalDeclared > MAX_ARCHIVE_TOTAL_BYTES) {
      throw firmwareError(
        'ARTIFACT_ARCHIVE_LIMIT_EXCEEDED',
        'Firmware archive exceeds the expanded size limit',
      );
    }
    names.add(entry.name);
    collisions.add(collisionKey(entry.name));
    const allowed = allowedByName.get(entry.name);
    if (!allowed || allowed.expectedSize !== entry.uncompressedSize) {
      throw firmwareError(
        'ARTIFACT_ARCHIVE_ENTRY_MISMATCH',
        'Firmware archive entry does not match the trusted allow-list',
      );
    }
    return { facts: entry, allowed };
  });

  if (totalDeclared !== totalExpected) {
    throw firmwareError(
      'ARTIFACT_ARCHIVE_ENTRY_MISMATCH',
      'Firmware archive expanded size does not match the allow-list',
    );
  }
  return validated;
};

const toEntryFacts = (entry: yauzl.Entry): IFirmwareArchiveEntryFacts => ({
  name: entry.fileName,
  compressedSize: entry.compressedSize,
  uncompressedSize: entry.uncompressedSize,
  compressionMethod: entry.compressionMethod,
  generalPurposeBitFlag: entry.generalPurposeBitFlag,
  versionMadeBy: entry.versionMadeBy,
  externalFileAttributes: entry.externalFileAttributes,
});

const openZip = (archivePath: string): Promise<yauzl.ZipFile> =>
  new Promise((resolve, reject) => {
    yauzl.open(
      archivePath,
      {
        autoClose: false,
        lazyEntries: true,
        decodeStrings: true,
        strictFileNames: true,
        validateEntrySizes: true,
      },
      (error, zipFile) => {
        if (error || !zipFile) {
          reject(
            firmwareError(
              'ARTIFACT_ARCHIVE_INVALID',
              'Firmware archive could not be opened',
              false,
              false,
              error,
            ),
          );
          return;
        }
        resolve(zipFile);
      },
    );
  });

const scanZipEntries = async (
  archivePath: string,
): Promise<IFirmwareArchiveEntryFacts[]> => {
  const zipFile = await openZip(archivePath);
  return new Promise((resolve, reject) => {
    const entries: IFirmwareArchiveEntryFacts[] = [];
    const fail = (error: unknown) => {
      zipFile.close();
      reject(
        error instanceof FirmwareArtifactDesktopError
          ? error
          : firmwareError(
              'ARTIFACT_ARCHIVE_INVALID',
              'Firmware archive central directory is invalid',
              false,
              false,
              error,
            ),
      );
    };
    zipFile.on('error', fail);
    zipFile.on('entry', (entry) => {
      entries.push(toEntryFacts(entry));
      if (entries.length > MAX_ARCHIVE_ENTRIES) {
        fail(
          firmwareError(
            'ARTIFACT_ARCHIVE_LIMIT_EXCEEDED',
            'Firmware archive has too many entries',
          ),
        );
        return;
      }
      zipFile.readEntry();
    });
    zipFile.on('end', () => {
      zipFile.close();
      resolve(entries);
    });
    zipFile.readEntry();
  });
};

const openZipEntryStream = (
  zipFile: yauzl.ZipFile,
  entry: yauzl.Entry,
): Promise<NodeJS.ReadableStream> =>
  new Promise((resolve, reject) => {
    zipFile.openReadStream(entry, (error, stream) => {
      if (error || !stream) {
        reject(
          firmwareError(
            'ARTIFACT_ARCHIVE_INTEGRITY_FAILED',
            'Firmware archive entry could not be read',
            false,
            false,
            error,
          ),
        );
        return;
      }
      resolve(stream);
    });
  });

const sleep = async (milliseconds: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });

const writeFileHandleAll = async ({
  handle,
  buffer,
  position,
  errorMessage,
}: {
  handle: fs.promises.FileHandle;
  buffer: Buffer;
  position: number;
  errorMessage: string;
}): Promise<void> => {
  let consumed = 0;
  while (consumed < buffer.length) {
    const { bytesWritten } = await handle
      .write(buffer, consumed, buffer.length - consumed, position + consumed)
      .catch((error) => {
        throw classifyFirmwareArtifactStorageFailure(error, errorMessage);
      });
    if (bytesWritten <= 0) {
      throw firmwareError(
        'ARTIFACT_STORAGE_FAILED',
        errorMessage,
        false,
        false,
      );
    }
    consumed += bytesWritten;
  }
};

const classifyTransportFailure = (
  error: unknown,
): FirmwareArtifactDesktopError => {
  if (error instanceof FirmwareArtifactDesktopError) return error;
  const code =
    error && typeof error === 'object' && 'code' in error
      ? String((error as { code?: unknown }).code)
      : '';
  const message = error instanceof Error ? error.message : 'Transport failed';
  if (
    /CERT|certificate|altname|hostname|self[- ]?signed|unable to verify|expired|TLS|SSL|handshake|EPROTO/i.test(
      `${code} ${message}`,
    )
  ) {
    return firmwareError(
      'ARTIFACT_TLS_FAILED',
      'Firmware TLS or certificate verification failed',
      false,
      false,
      error,
    );
  }
  if (
    RETRYABLE_NETWORK_CODES.has(code) ||
    /aborted|premature close|socket hang up/i.test(message)
  ) {
    return firmwareError(
      'ARTIFACT_NETWORK_FAILED',
      'Firmware network request failed',
      true,
      false,
      error,
    );
  }
  return firmwareError(
    'ARTIFACT_TRANSPORT_FAILED',
    'Firmware transport failed',
    false,
    false,
    error,
  );
};

const httpFailure = (status: number): FirmwareArtifactDesktopError => {
  const retryable =
    status === 408 ||
    status === 416 ||
    status === 429 ||
    (status >= 500 && status <= 599);
  return firmwareError(
    `ARTIFACT_HTTP_${status}`,
    `Firmware server returned HTTP ${status}`,
    retryable,
    !retryable,
  );
};

const parseContentRange = (
  value: string | undefined,
): { start: number; end: number; total: number } | undefined => {
  const match = value?.trim().match(/^bytes\s+(\d+)-(\d+)\/(\d+)$/u);
  if (!match) return undefined;
  const start = Number(match[1]);
  const end = Number(match[2]);
  const total = Number(match[3]);
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    !Number.isSafeInteger(total) ||
    start < 0 ||
    start > end ||
    end >= total
  ) {
    return undefined;
  }
  return { start, end, total };
};

const normalizedStrongETag = (
  value: string | string[] | undefined,
): string | undefined => {
  const candidate = Array.isArray(value) ? value[0] : value;
  const normalized = candidate?.trim();
  if (
    !normalized ||
    normalized.startsWith('W/') ||
    normalized.startsWith('w/')
  ) {
    return undefined;
  }
  return normalized;
};

class DesktopApiFirmwareArtifact implements IFirmwareArtifactStoreAdapter {
  desktopApi: IDesktopApi;

  private readonly rootDirOverride?: string;

  private readonly allowNonDefaultPortForTests: boolean;

  private readonly trustedCaForTests?: string | Buffer;

  private readonly now: () => number;

  private state?: IDesktopArtifactState;

  private readonly downloads = new Map<
    string,
    Promise<IFirmwareArtifactAdapterReceipt>
  >();

  private readonly activeDownloads = new Map<string, IActiveDownload>();

  private readonly statuses = new Map<string, IFirmwareArtifactAdapterStatus>();

  private readonly readers = new Map<string, IActiveReader>();

  constructor({
    desktopApi,
    rootDir,
    allowNonDefaultPortForTests = false,
    trustedCaForTests,
    now = Date.now,
  }: {
    desktopApi: IDesktopApi;
  } & IDesktopFirmwareArtifactOptions) {
    this.desktopApi = desktopApi;
    this.rootDirOverride = rootDir;
    this.allowNonDefaultPortForTests = allowNonDefaultPortForTests;
    this.trustedCaForTests = trustedCaForTests;
    this.now = now;
  }

  async getCapabilities(): Promise<IFirmwareArtifactAdapterCapabilities> {
    return {
      firmwareArtifactProtocolVersion: FIRMWARE_ARTIFACT_PROTOCOL_VERSION,
      supportedRouteTypes: ['domain', 'pinnedIp'],
      supportsArchiveMaterialization: true,
      maxReadBytes: FIRMWARE_ARTIFACT_MAX_READ_BYTES,
    };
  }

  async createLease({
    transactionId,
  }: {
    transactionId: string;
  }): Promise<{ leaseRef: string }> {
    if (
      typeof transactionId !== 'string' ||
      transactionId.length === 0 ||
      byteLength(transactionId) > 256
    ) {
      throw firmwareError(
        'ARTIFACT_INVALID_REQUEST',
        'Firmware transactionId must be 1-256 UTF-8 bytes',
      );
    }
    const state = this.getState();
    const leaseRef = `lease-${crypto.randomUUID()}`;
    state.leases[leaseRef] = {
      transactionId,
      artifactRefs: [],
      createdAt: this.now(),
    };
    this.persistState();
    return { leaseRef };
  }

  async retainArtifact({
    leaseRef,
    artifactRef,
  }: {
    leaseRef: string;
    artifactRef: string;
  }): Promise<void> {
    this.requireMetadata(artifactRef);
    this.retainArtifactInState(leaseRef, artifactRef);
    this.persistState();
  }

  async releaseLease({
    leaseRef,
    disposition: _disposition,
  }: {
    leaseRef: string;
    disposition: IFirmwareArtifactLeaseDisposition;
  }): Promise<void> {
    assertOpaqueRef(leaseRef, 'leaseRef');
    const state = this.getState();
    if (!state.leases[leaseRef]) {
      throw firmwareError(
        'ARTIFACT_LEASE_NOT_FOUND',
        'Firmware artifact lease was not found',
      );
    }
    delete state.leases[leaseRef];
    Object.entries(state.tasks).forEach(([key, task]) => {
      if (task.leaseRef === leaseRef) delete state.tasks[key];
    });
    this.persistState();
  }

  async reconcileLeases({
    activeLeaseRefs,
  }: {
    activeLeaseRefs: string[];
  }): Promise<void> {
    const active = new Set(
      activeLeaseRefs.map((leaseRef) => assertOpaqueRef(leaseRef, 'leaseRef')),
    );
    const state = this.getState();
    Object.keys(state.leases).forEach((leaseRef) => {
      if (!active.has(leaseRef)) delete state.leases[leaseRef];
    });
    Object.entries(state.tasks).forEach(([key, task]) => {
      if (!active.has(task.leaseRef)) delete state.tasks[key];
    });
    this.persistState();
  }

  async sweepOrphans(): Promise<{
    deletedFiles: number;
    deletedBytes: number;
  }> {
    const state = this.getState();
    const retained = new Set(
      Object.values(state.leases).flatMap((lease) => lease.artifactRefs),
    );
    const active = new Set([
      ...Array.from(
        this.activeDownloads.values(),
        ({ artifactRef }) => artifactRef,
      ),
      ...Array.from(this.readers.values(), ({ artifactRef }) => artifactRef),
    ]);
    const cutoff = this.now() - ORPHAN_GRACE_MS;
    let deletedFiles = 0;
    let deletedBytes = 0;
    for (const [artifactRef, metadata] of Object.entries(state.artifacts)) {
      if (
        !retained.has(artifactRef) &&
        !active.has(artifactRef) &&
        metadata.updatedAt < cutoff
      ) {
        const filePath = this.artifactPath(metadata);
        const stat = await fs.promises.stat(filePath).catch(() => undefined);
        await fs.promises.rm(filePath, { force: true });
        await fs.promises.rm(this.partialPath(artifactRef), { force: true });
        if (stat?.isFile()) {
          deletedFiles += 1;
          deletedBytes += stat.size;
        }
        delete state.artifacts[artifactRef];
      }
    }
    const stagingEntries = await fs.promises.readdir(this.stagingDir, {
      withFileTypes: true,
    });
    for (const entry of stagingEntries) {
      if (entry.isFile()) {
        const isRetained = Array.from(retained).some(
          (artifactRef) =>
            entry.name.startsWith(`${artifactRef}.`) ||
            entry.name.startsWith(`${artifactRef}-`),
        );
        const isActive = Array.from(active).some(
          (artifactRef) =>
            entry.name.startsWith(`${artifactRef}.`) ||
            entry.name.startsWith(`${artifactRef}-`),
        );
        if (!isRetained && !isActive) {
          const filePath = path.join(this.stagingDir, entry.name);
          const stat = await fs.promises.stat(filePath).catch(() => undefined);
          if (stat?.isFile() && stat.mtimeMs < cutoff) {
            await fs.promises.rm(filePath, { force: true });
            deletedFiles += 1;
            deletedBytes += stat.size;
          }
        }
      }
    }
    this.persistState();
    return { deletedFiles, deletedBytes };
  }

  async downloadArtifact(
    input: Parameters<IFirmwareArtifactStoreAdapter['downloadArtifact']>[0],
  ): Promise<IFirmwareArtifactAdapterReceipt> {
    const normalized = this.validateDownloadInput(input);
    const key = taskKey(normalized.leaseRef, normalized.taskId);
    const existing = this.downloads.get(key);
    if (existing) return existing;

    const state = this.getState();
    this.requireLease(normalized.leaseRef);
    state.tasks[key] = {
      leaseRef: normalized.leaseRef,
      taskId: normalized.taskId,
      artifactRef: normalized.artifactRef,
      updatedAt: this.now(),
    };
    this.retainArtifactInState(normalized.leaseRef, normalized.artifactRef);
    this.persistState();

    const active: IActiveDownload = {
      artifactRef: normalized.artifactRef,
      cancelled: false,
      requests: new Set(),
    };
    this.activeDownloads.set(key, active);
    this.statuses.set(key, {
      state: 'queued',
      downloadedBytes: this.partialSize(normalized.artifactRef),
      expectedSize: normalized.expectedSize,
    });
    const promise = this.runDownload(normalized, active, key).finally(() => {
      this.downloads.delete(key);
      if (this.activeDownloads.get(key) === active) {
        this.activeDownloads.delete(key);
      }
    });
    this.downloads.set(key, promise);
    return promise;
  }

  async getArtifactStatus({
    leaseRef,
    taskId,
  }: {
    leaseRef: string;
    taskId: string;
  }): Promise<IFirmwareArtifactAdapterStatus> {
    const key = taskKey(
      assertOpaqueRef(leaseRef, 'leaseRef'),
      assertOpaqueRef(taskId, 'taskId'),
    );
    const live = this.statuses.get(key);
    if (live) return live;
    const task = this.getState().tasks[key];
    if (!task) return { state: 'notFound', downloadedBytes: 0 };
    const metadata = this.getState().artifacts[task.artifactRef];
    if (metadata && (await this.isMetadataUsable(metadata))) {
      return {
        state: 'completed',
        downloadedBytes: metadata.size,
        expectedSize: metadata.size,
        receipt: this.toReceipt(metadata),
      };
    }
    const downloadedBytes = this.partialSize(task.artifactRef);
    return {
      state: downloadedBytes > 0 ? 'downloading' : 'notFound',
      downloadedBytes,
    };
  }

  async cancelDownload({
    leaseRef,
    taskId,
  }: {
    leaseRef: string;
    taskId: string;
  }): Promise<void> {
    const key = taskKey(
      assertOpaqueRef(leaseRef, 'leaseRef'),
      assertOpaqueRef(taskId, 'taskId'),
    );
    const active = this.activeDownloads.get(key);
    if (!active) return;
    active.cancelled = true;
    active.requests.forEach((request) => {
      request.destroy(
        firmwareError(
          'ARTIFACT_CANCELLED',
          'Firmware artifact download was cancelled',
          false,
          false,
        ),
      );
    });
    this.statuses.set(key, {
      state: 'cancelled',
      downloadedBytes: this.partialSize(active.artifactRef),
      errorCode: 'ARTIFACT_CANCELLED',
      retryable: false,
    });
  }

  async quarantineArtifact({
    artifactRef,
  }: {
    artifactRef: string;
  }): Promise<void> {
    const normalizedRef = assertOpaqueRef(artifactRef, 'artifactRef');
    await this.removeArtifact(normalizedRef, true);
  }

  async openArtifact(receipt: IFirmwareArtifactAdapterReceipt): Promise<{
    readerId: string;
    size: number;
    immutableToken: string;
    maxReadBytes: number;
  }> {
    const metadata = this.requireMetadata(receipt.artifactRef);
    if (
      receipt.size !== metadata.size ||
      receipt.sha256.toLowerCase() !== metadata.sha256 ||
      receipt.immutableToken !== metadata.immutableToken ||
      !(await this.isMetadataUsable(metadata))
    ) {
      throw firmwareError(
        'ARTIFACT_IMMUTABLE_TOKEN_MISMATCH',
        'Firmware artifact changed before it was opened',
      );
    }
    const handle = await fs.promises
      .open(this.artifactPath(metadata), 'r')
      .catch((error) => {
        throw firmwareError(
          'ARTIFACT_STORAGE_FAILED',
          'Firmware artifact could not be opened',
          false,
          false,
          error,
        );
      });
    const readerId = `reader-${crypto.randomUUID()}`;
    this.readers.set(readerId, {
      artifactRef: metadata.artifactRef,
      immutableToken: metadata.immutableToken,
      size: metadata.size,
      handle,
    });
    return {
      readerId,
      size: metadata.size,
      immutableToken: metadata.immutableToken,
      maxReadBytes: FIRMWARE_ARTIFACT_MAX_READ_BYTES,
    };
  }

  async readArtifact({
    readerId,
    offset,
    length,
  }: {
    readerId: string;
    offset: number;
    length: number;
  }): Promise<ArrayBuffer> {
    const reader = this.readers.get(assertOpaqueRef(readerId, 'readerId'));
    if (!reader) {
      throw firmwareError(
        'ARTIFACT_READER_NOT_FOUND',
        'Firmware artifact reader was not found',
      );
    }
    if (
      !Number.isSafeInteger(offset) ||
      offset < 0 ||
      !Number.isSafeInteger(length) ||
      length <= 0 ||
      length > FIRMWARE_ARTIFACT_MAX_READ_BYTES ||
      offset + length > reader.size
    ) {
      throw firmwareError(
        'ARTIFACT_READ_OUT_OF_RANGE',
        'Firmware artifact read is outside the verified object',
      );
    }
    const buffer = Buffer.allocUnsafe(length);
    const { bytesRead } = await reader.handle
      .read(buffer, 0, length, offset)
      .catch((error) => {
        throw firmwareError(
          'ARTIFACT_STORAGE_FAILED',
          'Firmware artifact could not be read',
          false,
          false,
          error,
        );
      });
    if (bytesRead !== length) {
      throw firmwareError(
        'ARTIFACT_SHORT_READ',
        'Firmware artifact returned a short read',
      );
    }
    return buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + bytesRead,
    ) as ArrayBuffer;
  }

  async closeArtifact({ readerId }: { readerId: string }): Promise<void> {
    const normalizedId = assertOpaqueRef(readerId, 'readerId');
    const reader = this.readers.get(normalizedId);
    this.readers.delete(normalizedId);
    await reader?.handle.close().catch(() => undefined);
  }

  async materializeArchive({
    leaseRef,
    archiveArtifactRef,
    archiveImmutableToken,
    entries,
  }: {
    leaseRef: string;
    archiveArtifactRef: string;
    archiveImmutableToken: string;
    entries: IFirmwareArchiveMaterializeEntry[];
  }): Promise<{ artifacts: IFirmwareArchiveMaterializedArtifact[] }> {
    this.requireLease(leaseRef);
    const archive = this.requireMetadata(archiveArtifactRef);
    if (
      archive.immutableToken !== archiveImmutableToken ||
      !(await this.isMetadataUsable(archive))
    ) {
      throw firmwareError(
        'ARTIFACT_IMMUTABLE_TOKEN_MISMATCH',
        'Firmware archive changed before materialization',
      );
    }
    this.retainArtifactInState(leaseRef, archive.artifactRef);
    const facts = await scanZipEntries(this.artifactPath(archive));
    const validated = validateFirmwareArchiveEntries({
      entries: facts,
      allowList: entries,
    });
    const reusable: IFirmwareArchiveMaterializedArtifact[] = [];
    const validatedToExtract: IValidatedArchiveEntry[] = [];
    for (const item of validated) {
      const artifactRef = artifactRefFor(
        item.allowed.expectedSha256,
        item.allowed.expectedSize,
      );
      const metadata = this.getState().artifacts[artifactRef];
      if (metadata && (await this.verifyFile(metadata))) {
        this.retainArtifactInState(leaseRef, artifactRef);
        reusable.push({
          archiveName: item.allowed.archiveName,
          artifactId: item.allowed.artifactId,
          receipt: this.toReceipt(metadata),
        });
      } else {
        if (metadata) {
          await this.removeArtifact(artifactRef, false);
          this.retainArtifactInState(leaseRef, archive.artifactRef);
        }
        validatedToExtract.push(item);
      }
    }
    const staged = await this.extractValidatedEntries({
      archivePath: this.artifactPath(archive),
      validated: validatedToExtract,
    });
    const promoted: IFirmwareArchiveMaterializedArtifact[] = [];
    try {
      for (const item of staged) {
        const finalPath = this.finalPath(item.metadata.artifactRef);
        await fs.promises.rm(finalPath, { force: true });
        await fs.promises.rename(item.stagingPath, finalPath);
        this.getState().artifacts[item.metadata.artifactRef] = item.metadata;
        this.retainArtifactInState(leaseRef, item.metadata.artifactRef);
        promoted.push({
          archiveName: item.archiveName,
          artifactId: item.artifactId,
          receipt: this.toReceipt(item.metadata),
        });
      }
      this.persistState();
      const byArchiveName = new Map(
        [...reusable, ...promoted].map((artifact) => [
          artifact.archiveName,
          artifact,
        ]),
      );
      return {
        artifacts: entries.map((entry) => {
          const artifact = byArchiveName.get(entry.archiveName);
          if (!artifact) {
            throw firmwareError(
              'ARTIFACT_ARCHIVE_ENTRY_MISMATCH',
              'Firmware archive materialization omitted a trusted entry',
            );
          }
          return artifact;
        }),
      };
    } catch (error) {
      await Promise.all(
        staged.map(({ stagingPath }) =>
          fs.promises.rm(stagingPath, { force: true }),
        ),
      );
      throw classifyFirmwareArtifactStorageFailure(
        error,
        'Firmware archive entries could not be promoted',
      );
    }
  }

  private get rootDir(): string {
    return (
      this.rootDirOverride ??
      path.join(app.getPath('userData'), 'firmware-artifacts-v1')
    );
  }

  private get objectsDir(): string {
    return path.join(this.rootDir, 'objects');
  }

  private get stagingDir(): string {
    return path.join(this.rootDir, 'staging');
  }

  private get statePath(): string {
    return path.join(this.rootDir, 'state.json');
  }

  private ensureDirectories(): void {
    try {
      fs.mkdirSync(this.objectsDir, { recursive: true });
      fs.mkdirSync(this.stagingDir, { recursive: true });
    } catch (error) {
      throw classifyFirmwareArtifactStorageFailure(
        error,
        'Firmware artifact directories could not be created',
      );
    }
  }

  private getState(): IDesktopArtifactState {
    if (this.state) return this.state;
    this.ensureDirectories();
    const empty: IDesktopArtifactState = {
      schemaVersion: STATE_SCHEMA_VERSION,
      artifacts: {},
      leases: {},
      tasks: {},
    };
    try {
      const parsed = JSON.parse(
        fs.readFileSync(this.statePath, 'utf8'),
      ) as Partial<IDesktopArtifactState>;
      if (
        parsed.schemaVersion !== STATE_SCHEMA_VERSION ||
        !parsed.artifacts ||
        !parsed.leases ||
        !parsed.tasks
      ) {
        throw firmwareError(
          'ARTIFACT_STORAGE_FAILED',
          'Firmware artifact state has an unsupported schema',
        );
      }
      this.state = parsed as IDesktopArtifactState;
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        (error as { code?: string }).code === 'ENOENT'
      ) {
        this.state = empty;
        return this.state;
      }
      throw classifyFirmwareArtifactStorageFailure(
        error,
        'Firmware artifact state could not be loaded',
      );
    }
    return this.state;
  }

  private persistState(): void {
    try {
      this.ensureDirectories();
      const temporary = `${this.statePath}.tmp`;
      const handle = fs.openSync(temporary, 'w', 0o600);
      try {
        fs.writeFileSync(handle, JSON.stringify(this.getState()), 'utf8');
        fs.fsyncSync(handle);
      } finally {
        fs.closeSync(handle);
      }
      fs.renameSync(temporary, this.statePath);
    } catch (error) {
      throw classifyFirmwareArtifactStorageFailure(
        error,
        'Firmware artifact state could not be persisted',
      );
    }
  }

  private artifactPath(metadata: IDesktopArtifactMetadata): string {
    assertOpaqueRef(metadata.artifactRef, 'artifactRef');
    if (metadata.fileName !== fileNameFor(metadata.artifactRef)) {
      throw firmwareError(
        'ARTIFACT_INVALID_METADATA',
        'Firmware artifact metadata contains an invalid file name',
      );
    }
    return path.join(this.objectsDir, metadata.fileName);
  }

  private finalPath(artifactRef: string): string {
    return path.join(this.objectsDir, fileNameFor(artifactRef));
  }

  private partialPath(artifactRef: string): string {
    return path.join(this.stagingDir, `${artifactRef}.partial`);
  }

  private partialSize(artifactRef: string): number {
    try {
      const stat = fs.statSync(this.partialPath(artifactRef));
      return stat.isFile() && Number.isSafeInteger(stat.size) ? stat.size : 0;
    } catch {
      return 0;
    }
  }

  private requireLease(leaseRef: string): IDesktopArtifactLease {
    const normalizedRef = assertOpaqueRef(leaseRef, 'leaseRef');
    const lease = this.getState().leases[normalizedRef];
    if (!lease) {
      throw firmwareError(
        'ARTIFACT_LEASE_NOT_FOUND',
        'Firmware artifact lease was not found',
      );
    }
    return lease;
  }

  private retainArtifactInState(leaseRef: string, artifactRef: string): void {
    const lease = this.requireLease(leaseRef);
    const normalizedRef = assertOpaqueRef(artifactRef, 'artifactRef');
    if (!lease.artifactRefs.includes(normalizedRef)) {
      lease.artifactRefs.push(normalizedRef);
    }
  }

  private requireMetadata(artifactRef: string): IDesktopArtifactMetadata {
    const normalizedRef = assertOpaqueRef(artifactRef, 'artifactRef');
    const metadata = this.getState().artifacts[normalizedRef];
    if (!metadata || metadata.artifactRef !== normalizedRef) {
      throw firmwareError(
        'ARTIFACT_NOT_FOUND',
        'Firmware artifact was not found',
      );
    }
    return metadata;
  }

  private async isMetadataUsable(
    metadata: IDesktopArtifactMetadata,
  ): Promise<boolean> {
    const stat = await fs.promises
      .stat(this.artifactPath(metadata))
      .catch(() => undefined);
    return Boolean(
      stat?.isFile() &&
      stat.size === metadata.size &&
      metadata.sha256.length === 64 &&
      metadata.immutableToken.length > 0,
    );
  }

  private toReceipt(
    metadata: IDesktopArtifactMetadata,
  ): IFirmwareArtifactAdapterReceipt {
    return {
      artifactRef: metadata.artifactRef,
      size: metadata.size,
      sha256: metadata.sha256,
      immutableToken: metadata.immutableToken,
    };
  }

  private validateDownloadInput(
    input: Parameters<IFirmwareArtifactStoreAdapter['downloadArtifact']>[0],
  ) {
    const taskId = assertOpaqueRef(input.taskId, 'taskId');
    const leaseRef = assertOpaqueRef(input.leaseRef, 'leaseRef');
    if (
      typeof input.artifactId !== 'string' ||
      input.artifactId.length === 0 ||
      byteLength(input.artifactId) > 256 ||
      !SHA256_PATTERN.test(input.expectedSha256)
    ) {
      throw firmwareError(
        'ARTIFACT_INVALID_REQUEST',
        'Firmware artifact identity is invalid',
      );
    }
    const expectedSize = exactPositiveInteger(
      input.expectedSize,
      'expectedSize',
      MAX_ARTIFACT_BYTES,
    );
    const maxBytes = exactPositiveInteger(
      input.maxBytes,
      'maxBytes',
      MAX_ARTIFACT_BYTES,
    );
    if (maxBytes < expectedSize) {
      throw firmwareError(
        'ARTIFACT_INVALID_REQUEST',
        'maxBytes must cover expectedSize',
      );
    }
    let url: URL;
    try {
      url = new URL(input.url);
    } catch (error) {
      throw firmwareError(
        'ARTIFACT_INVALID_REQUEST',
        'Firmware artifact URL is invalid',
        false,
        false,
        error,
      );
    }
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.hash ||
      !url.hostname ||
      (!this.allowNonDefaultPortForTests &&
        url.port !== '' &&
        url.port !== '443')
    ) {
      throw firmwareError(
        'ARTIFACT_INVALID_REQUEST',
        'Firmware artifact URL must use canonical HTTPS',
      );
    }
    if (input.routeType === 'pinnedIp') {
      if (
        typeof input.resolvedIp !== 'string' ||
        net.isIP(input.resolvedIp) === 0
      ) {
        throw firmwareError(
          'ARTIFACT_INVALID_REQUEST',
          'Pinned firmware route requires a valid IP address',
        );
      }
    } else if (input.routeType !== 'domain' || input.resolvedIp !== undefined) {
      throw firmwareError(
        'ARTIFACT_INVALID_REQUEST',
        'Firmware artifact route is invalid',
      );
    }
    const overallDeadlineSeconds =
      input.overallDeadlineSeconds === undefined
        ? 30 * 60
        : exactPositiveDuration(
            input.overallDeadlineSeconds,
            'overallDeadlineSeconds',
          );
    if (
      input.segmentCount !== undefined &&
      (input.segmentCount < 1 ||
        input.segmentCount > 32 ||
        !Number.isSafeInteger(input.segmentCount))
    ) {
      throw firmwareError(
        'ARTIFACT_INVALID_REQUEST',
        'segmentCount must be an integer from 1 to 32',
      );
    }
    const expectedSha256 = input.expectedSha256.toLowerCase();
    return {
      ...input,
      taskId,
      leaseRef,
      url,
      expectedSize,
      maxBytes,
      expectedSha256,
      artifactRef: artifactRefFor(expectedSha256, expectedSize),
      deadlineAt: this.now() + overallDeadlineSeconds * 1000,
    };
  }

  private async runDownload(
    input: ReturnType<DesktopApiFirmwareArtifact['validateDownloadInput']>,
    active: IActiveDownload,
    key: string,
  ): Promise<IFirmwareArtifactAdapterReceipt> {
    try {
      const cached = this.getState().artifacts[input.artifactRef];
      if (cached && (await this.verifyFile(cached))) {
        this.statuses.set(key, {
          state: 'completed',
          downloadedBytes: cached.size,
          expectedSize: cached.size,
          receipt: this.toReceipt(cached),
        });
        return this.toReceipt(cached);
      }
      if (cached) {
        await this.removeArtifact(input.artifactRef, false);
        this.getState().tasks[key] = {
          leaseRef: input.leaseRef,
          taskId: input.taskId,
          artifactRef: input.artifactRef,
          updatedAt: this.now(),
        };
        this.retainArtifactInState(input.leaseRef, input.artifactRef);
        this.persistState();
      }

      let attempt = 0;
      while (true) {
        this.throwIfCancelledOrExpired(input, active);
        this.statuses.set(key, {
          state: 'downloading',
          downloadedBytes: this.partialSize(input.artifactRef),
          expectedSize: input.expectedSize,
        });
        try {
          await this.downloadAttempt(input, active, key);
          break;
        } catch (error) {
          const failure = classifyTransportFailure(error);
          if (
            !failure.retryable ||
            attempt >= MAX_DOWNLOAD_RETRIES ||
            this.now() >= input.deadlineAt
          ) {
            throw failure;
          }
          attempt += 1;
          await sleep(Math.min(500 * 2 ** (attempt - 1), 5000));
        }
      }

      this.throwIfCancelledOrExpired(input, active);
      this.statuses.set(key, {
        state: 'verifying',
        downloadedBytes: input.expectedSize,
        expectedSize: input.expectedSize,
      });
      const metadata = await this.promoteVerifiedPartial(input);
      this.statuses.set(key, {
        state: 'completed',
        downloadedBytes: metadata.size,
        expectedSize: metadata.size,
        receipt: this.toReceipt(metadata),
      });
      return this.toReceipt(metadata);
    } catch (error) {
      const failure = classifyTransportFailure(error);
      if (failure.discardStaging) {
        await fs.promises.rm(this.partialPath(input.artifactRef), {
          force: true,
        });
      }
      this.statuses.set(key, {
        state: failure.code === 'ARTIFACT_CANCELLED' ? 'cancelled' : 'failed',
        downloadedBytes: this.partialSize(input.artifactRef),
        expectedSize: input.expectedSize,
        errorCode: failure.code,
        errorMessage: failure.message,
        retryable: failure.retryable,
      });
      throw failure;
    }
  }

  private async downloadAttempt(
    input: ReturnType<DesktopApiFirmwareArtifact['validateDownloadInput']>,
    active: IActiveDownload,
    key: string,
  ): Promise<void> {
    const probe = await this.probe(input, active);
    if (probe.total !== input.expectedSize) {
      throw firmwareError(
        'ARTIFACT_SIZE_MISMATCH',
        'Firmware probe size does not match expectedSize',
        false,
        true,
      );
    }
    let offset = this.partialSize(input.artifactRef);
    if (offset > input.expectedSize) {
      await fs.promises
        .truncate(this.partialPath(input.artifactRef), 0)
        .catch((error) => {
          throw classifyFirmwareArtifactStorageFailure(
            error,
            'Firmware staging file could not be reset',
          );
        });
      offset = 0;
    }
    if (!probe.supportsRange && offset > 0) {
      await fs.promises
        .truncate(this.partialPath(input.artifactRef), 0)
        .catch((error) => {
          throw classifyFirmwareArtifactStorageFailure(
            error,
            'Firmware staging file could not be reset',
          );
        });
      offset = 0;
    }
    if (offset === input.expectedSize) return;

    const headers: Record<string, string> = {
      'Accept-Encoding': 'identity',
    };
    if (probe.supportsRange && offset > 0) {
      headers.Range = `bytes=${offset}-${input.expectedSize - 1}`;
      const validator = probe.strongETag ?? probe.lastModified;
      if (validator) headers['If-Range'] = validator;
    } else if (probe.supportsRange) {
      headers.Range = `bytes=0-${input.expectedSize - 1}`;
    }
    const response = await this.request(input, active, headers);
    const status = response.statusCode ?? 0;
    if (status >= 300 && status <= 399) {
      response.resume();
      throw firmwareError(
        'ARTIFACT_REDIRECT_REJECTED',
        'Firmware redirects are not accepted',
        false,
        true,
      );
    }
    if (status === 416) {
      response.resume();
      throw httpFailure(status);
    }
    if (status === 200 && offset > 0) {
      response.resume();
      await fs.promises
        .truncate(this.partialPath(input.artifactRef), 0)
        .catch((error) => {
          throw classifyFirmwareArtifactStorageFailure(
            error,
            'Firmware staging file could not be reset',
          );
        });
      throw firmwareError(
        'ARTIFACT_SHORT_BODY',
        'Firmware server ignored the resume range',
        true,
        false,
      );
    }
    if (status !== 200 && status !== 206) {
      response.resume();
      throw httpFailure(status);
    }
    if (status === 206) {
      const parsed = parseContentRange(
        Array.isArray(response.headers['content-range'])
          ? response.headers['content-range'][0]
          : response.headers['content-range'],
      );
      if (
        !parsed ||
        parsed.start !== offset ||
        parsed.end !== input.expectedSize - 1 ||
        parsed.total !== input.expectedSize ||
        String(response.headers['content-type'] ?? '')
          .toLowerCase()
          .startsWith('multipart/byteranges')
      ) {
        response.resume();
        throw firmwareError(
          'ARTIFACT_PROTOCOL_INVALID',
          'Firmware range response is invalid',
          false,
          true,
        );
      }
    }
    await this.streamResponse({
      response,
      destination: this.partialPath(input.artifactRef),
      offset,
      expectedSize: input.expectedSize,
      input,
      active,
      onProgress: (downloadedBytes) => {
        this.statuses.set(key, {
          state: 'downloading',
          downloadedBytes,
          expectedSize: input.expectedSize,
        });
      },
    });
  }

  private async probe(
    input: ReturnType<DesktopApiFirmwareArtifact['validateDownloadInput']>,
    active: IActiveDownload,
  ): Promise<IFirmwareProbe> {
    const response = await this.request(input, active, {
      'Accept-Encoding': 'identity',
      Range: 'bytes=0-0',
    });
    const status = response.statusCode ?? 0;
    if (status >= 300 && status <= 399) {
      response.resume();
      throw firmwareError(
        'ARTIFACT_REDIRECT_REJECTED',
        'Firmware redirects are not accepted',
        false,
        true,
      );
    }
    const strongETag = normalizedStrongETag(response.headers.etag);
    const lastModified = Array.isArray(response.headers['last-modified'])
      ? response.headers['last-modified'][0]
      : response.headers['last-modified'];
    if (status === 206) {
      const range = parseContentRange(
        Array.isArray(response.headers['content-range'])
          ? response.headers['content-range'][0]
          : response.headers['content-range'],
      );
      if (!range || range.start !== 0 || range.end !== 0) {
        response.resume();
        throw firmwareError(
          'ARTIFACT_PROTOCOL_INVALID',
          'Firmware range probe is invalid',
          false,
          true,
        );
      }
      let bytes = 0;
      for await (const chunk of response) {
        bytes += Buffer.isBuffer(chunk)
          ? chunk.length
          : Buffer.byteLength(String(chunk));
        if (bytes > 1) {
          response.destroy();
          throw firmwareError(
            'ARTIFACT_PROTOCOL_INVALID',
            'Firmware range probe returned more than one byte',
            false,
            true,
          );
        }
      }
      if (bytes !== 1) {
        throw firmwareError(
          'ARTIFACT_SHORT_BODY',
          'Firmware range probe returned a short body',
          true,
          false,
        );
      }
      return {
        supportsRange: true,
        total: range.total,
        ...(strongETag ? { strongETag } : {}),
        ...(lastModified ? { lastModified } : {}),
      };
    }
    if (status === 200) {
      const total = Number(response.headers['content-length']);
      response.destroy();
      if (!Number.isSafeInteger(total) || total <= 0) {
        throw firmwareError(
          'ARTIFACT_PROTOCOL_INVALID',
          'Firmware probe omitted Content-Length',
          false,
          true,
        );
      }
      return {
        supportsRange: false,
        total,
        ...(strongETag ? { strongETag } : {}),
        ...(lastModified ? { lastModified } : {}),
      };
    }
    response.resume();
    throw httpFailure(status);
  }

  private request(
    input: ReturnType<DesktopApiFirmwareArtifact['validateDownloadInput']>,
    active: IActiveDownload,
    headers: Record<string, string>,
  ): Promise<IncomingMessage> {
    this.throwIfCancelledOrExpired(input, active);
    return new Promise((resolve, reject) => {
      const remaining = input.deadlineAt - this.now();
      const options: https.RequestOptions = {
        protocol: 'https:',
        hostname: input.url.hostname,
        port: input.url.port ? Number(input.url.port) : 443,
        path: `${input.url.pathname}${input.url.search}`,
        method: 'GET',
        headers: {
          ...headers,
          Host: input.url.host,
        },
        servername: input.url.hostname,
        rejectUnauthorized: true,
        ...(this.trustedCaForTests ? { ca: this.trustedCaForTests } : {}),
        agent: false,
        ...(input.routeType === 'pinnedIp'
          ? {
              lookup: createPinnedLookup(input.resolvedIp!),
            }
          : {}),
      };
      const request = https.request(options);
      const deadlineTimer = setTimeout(() => {
        request.destroy(
          firmwareError(
            'ARTIFACT_DEADLINE_EXCEEDED',
            'Firmware artifact deadline was exceeded',
            false,
            false,
          ),
        );
      }, remaining);
      request.once('response', (response) => {
        clearTimeout(deadlineTimer);
        resolve(response);
      });
      active.requests.add(request);
      const cleanup = () => active.requests.delete(request);
      request.once('close', cleanup);
      request.once('error', (error) => {
        clearTimeout(deadlineTimer);
        cleanup();
        reject(classifyTransportFailure(error));
      });
      request.setTimeout(Math.min(STALL_TIMEOUT_MS, remaining), () => {
        request.destroy(
          firmwareError(
            'ARTIFACT_NETWORK_FAILED',
            'Firmware request stalled',
            true,
            false,
          ),
        );
      });
      request.end();
    });
  }

  private async streamResponse({
    response,
    destination,
    offset,
    expectedSize,
    input,
    active,
    onProgress,
  }: {
    response: IncomingMessage;
    destination: string;
    offset: number;
    expectedSize: number;
    input: ReturnType<DesktopApiFirmwareArtifact['validateDownloadInput']>;
    active: IActiveDownload;
    onProgress: (downloadedBytes: number) => void;
  }): Promise<void> {
    const handle = await fs.promises
      .open(destination, offset > 0 ? 'r+' : 'w')
      .catch((error) => {
        throw classifyFirmwareArtifactStorageFailure(
          error,
          'Firmware staging file could not be opened',
        );
      });
    let written = offset;
    try {
      for await (const value of response) {
        this.throwIfCancelledOrExpired(input, active);
        const chunk = Buffer.isBuffer(value) ? value : Buffer.from(value);
        if (chunk.length > expectedSize - written) {
          throw firmwareError(
            'ARTIFACT_SIZE_LIMIT_EXCEEDED',
            'Firmware response exceeded expectedSize',
            false,
            true,
          );
        }
        await writeFileHandleAll({
          handle,
          buffer: chunk,
          position: written,
          errorMessage: 'Firmware staging file could not be written',
        });
        written += chunk.length;
        onProgress(written);
      }
      await handle.sync().catch((error) => {
        throw classifyFirmwareArtifactStorageFailure(
          error,
          'Firmware staging file could not be synchronized',
        );
      });
    } catch (error) {
      throw classifyTransportFailure(error);
    } finally {
      await handle.close().catch(() => undefined);
    }
    if (written !== expectedSize) {
      throw firmwareError(
        'ARTIFACT_SHORT_BODY',
        'Firmware response ended before expectedSize',
        true,
        false,
      );
    }
  }

  private async promoteVerifiedPartial(
    input: ReturnType<DesktopApiFirmwareArtifact['validateDownloadInput']>,
  ): Promise<IDesktopArtifactMetadata> {
    const stagingPath = this.partialPath(input.artifactRef);
    const stat = await fs.promises.stat(stagingPath).catch(() => undefined);
    if (!stat?.isFile() || stat.size !== input.expectedSize) {
      throw firmwareError(
        'ARTIFACT_SIZE_MISMATCH',
        'Firmware staging size does not match expectedSize',
        false,
        true,
      );
    }
    const digest = await this.hashFile(stagingPath);
    if (digest !== input.expectedSha256) {
      throw firmwareError(
        'ARTIFACT_DIGEST_MISMATCH',
        'Firmware artifact failed SHA-256 verification',
        false,
        true,
      );
    }
    const handle = await fs.promises.open(stagingPath, 'r+').catch((error) => {
      throw classifyFirmwareArtifactStorageFailure(
        error,
        'Firmware staging file could not be finalized',
      );
    });
    try {
      await handle.sync();
    } catch (error) {
      throw classifyFirmwareArtifactStorageFailure(
        error,
        'Firmware staging file could not be synchronized',
      );
    } finally {
      await handle.close().catch(() => undefined);
    }
    const finalPath = this.finalPath(input.artifactRef);
    await fs.promises.rm(finalPath, { force: true });
    await fs.promises.rename(stagingPath, finalPath).catch((error) => {
      throw classifyFirmwareArtifactStorageFailure(
        error,
        'Firmware artifact could not be promoted',
      );
    });
    const now = this.now();
    const metadata: IDesktopArtifactMetadata = {
      artifactRef: input.artifactRef,
      artifactId: input.artifactId,
      size: input.expectedSize,
      sha256: input.expectedSha256,
      immutableToken: crypto.randomUUID(),
      fileName: fileNameFor(input.artifactRef),
      createdAt: now,
      updatedAt: now,
    };
    this.getState().artifacts[input.artifactRef] = metadata;
    this.persistState();
    return metadata;
  }

  private async verifyFile(
    metadata: IDesktopArtifactMetadata,
  ): Promise<boolean> {
    if (!(await this.isMetadataUsable(metadata))) return false;
    return (
      (await this.hashFile(this.artifactPath(metadata))) === metadata.sha256
    );
  }

  private async hashFile(filePath: string): Promise<string> {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath, {
      highWaterMark: FIRMWARE_ARTIFACT_MAX_READ_BYTES,
    });
    try {
      for await (const value of stream) {
        hash.update(value as Buffer);
      }
    } catch (error) {
      throw classifyFirmwareArtifactStorageFailure(
        error,
        'Firmware artifact could not be hashed',
      );
    }
    return hash.digest('hex');
  }

  private async removeArtifact(
    artifactRef: string,
    cancelActive: boolean,
  ): Promise<void> {
    if (cancelActive) {
      this.activeDownloads.forEach((active) => {
        if (active.artifactRef === artifactRef) {
          active.cancelled = true;
          active.requests.forEach((request) => request.destroy());
        }
      });
    }
    const readers = Array.from(this.readers.entries()).filter(
      ([, reader]) => reader.artifactRef === artifactRef,
    );
    await Promise.all(
      readers.map(async ([readerId, reader]) => {
        this.readers.delete(readerId);
        await reader.handle.close().catch(() => undefined);
      }),
    );
    await fs.promises.rm(this.finalPath(artifactRef), { force: true });
    await fs.promises.rm(this.partialPath(artifactRef), { force: true });
    const state = this.getState();
    delete state.artifacts[artifactRef];
    Object.entries(state.tasks).forEach(([key, task]) => {
      if (task.artifactRef === artifactRef) delete state.tasks[key];
    });
    Object.values(state.leases).forEach((lease) => {
      lease.artifactRefs = lease.artifactRefs.filter(
        (candidate) => candidate !== artifactRef,
      );
    });
    this.persistState();
  }

  private throwIfCancelledOrExpired(
    input: ReturnType<DesktopApiFirmwareArtifact['validateDownloadInput']>,
    active: IActiveDownload,
  ): void {
    if (active.cancelled) {
      throw firmwareError(
        'ARTIFACT_CANCELLED',
        'Firmware artifact download was cancelled',
      );
    }
    if (this.now() >= input.deadlineAt) {
      throw firmwareError(
        'ARTIFACT_DEADLINE_EXCEEDED',
        'Firmware artifact deadline was exceeded',
      );
    }
  }

  private async extractValidatedEntries({
    archivePath,
    validated,
  }: {
    archivePath: string;
    validated: readonly IValidatedArchiveEntry[];
  }): Promise<
    Array<{
      archiveName: string;
      artifactId: string;
      stagingPath: string;
      metadata: IDesktopArtifactMetadata;
    }>
  > {
    const allowedByName = new Map(
      validated.map((entry) => [entry.facts.name, entry.allowed]),
    );
    const zipFile = await openZip(archivePath);
    const staged: Array<{
      archiveName: string;
      artifactId: string;
      stagingPath: string;
      metadata: IDesktopArtifactMetadata;
    }> = [];
    try {
      await new Promise<void>((resolve, reject) => {
        let settled = false;
        const fail = (error: unknown) => {
          if (settled) return;
          settled = true;
          reject(error);
        };
        zipFile.on('error', fail);
        zipFile.on('end', () => {
          if (settled) return;
          settled = true;
          resolve();
        });
        zipFile.on('entry', (entry) => {
          const allowed = allowedByName.get(entry.fileName);
          if (!allowed) {
            zipFile.readEntry();
            return;
          }
          void this.extractOneEntry(zipFile, entry, allowed)
            .then((item) => {
              staged.push(item);
              zipFile.readEntry();
            })
            .catch(fail);
        });
        zipFile.readEntry();
      });
    } catch (error) {
      await Promise.all(
        staged.map(({ stagingPath }) =>
          fs.promises.rm(stagingPath, { force: true }),
        ),
      );
      throw error;
    } finally {
      zipFile.close();
    }
    if (staged.length !== validated.length) {
      throw firmwareError(
        'ARTIFACT_ARCHIVE_ENTRY_MISMATCH',
        'Firmware archive extraction did not cover every trusted entry',
      );
    }
    return staged;
  }

  private async extractOneEntry(
    zipFile: yauzl.ZipFile,
    entry: yauzl.Entry,
    allowed: IFirmwareArchiveMaterializeEntry,
  ): Promise<{
    archiveName: string;
    artifactId: string;
    stagingPath: string;
    metadata: IDesktopArtifactMetadata;
  }> {
    const artifactRef = artifactRefFor(
      allowed.expectedSha256,
      allowed.expectedSize,
    );
    const stagingPath = path.join(
      this.stagingDir,
      `${artifactRef}-${crypto.randomUUID()}.partial`,
    );
    const input = await openZipEntryStream(zipFile, entry);
    const output = await fs.promises.open(stagingPath, 'wx', 0o600);
    const hash = crypto.createHash('sha256');
    let size = 0;
    try {
      for await (const value of input) {
        const chunk = Buffer.isBuffer(value) ? value : Buffer.from(value);
        if (chunk.length > allowed.expectedSize - size) {
          throw firmwareError(
            'ARTIFACT_ARCHIVE_LIMIT_EXCEEDED',
            'Firmware archive entry exceeded its trusted size',
          );
        }
        await writeFileHandleAll({
          handle: output,
          buffer: chunk,
          position: size,
          errorMessage: 'Firmware archive entry could not be written',
        });
        hash.update(chunk);
        size += chunk.length;
      }
      await output.sync().catch((error) => {
        throw classifyFirmwareArtifactStorageFailure(
          error,
          'Firmware archive entry could not be synchronized',
        );
      });
    } catch (error) {
      throw error instanceof FirmwareArtifactDesktopError
        ? error
        : firmwareError(
            'ARTIFACT_ARCHIVE_INTEGRITY_FAILED',
            'Firmware archive entry stream is invalid',
            false,
            false,
            error,
          );
    } finally {
      await output.close().catch(() => undefined);
    }
    if (
      size !== allowed.expectedSize ||
      hash.digest('hex') !== allowed.expectedSha256.toLowerCase()
    ) {
      await fs.promises.rm(stagingPath, { force: true });
      throw firmwareError(
        'ARTIFACT_ARCHIVE_INTEGRITY_FAILED',
        'Firmware archive entry failed integrity verification',
      );
    }
    const now = this.now();
    return {
      archiveName: allowed.archiveName,
      artifactId: allowed.artifactId,
      stagingPath,
      metadata: {
        artifactRef,
        artifactId: allowed.artifactId,
        size,
        sha256: allowed.expectedSha256.toLowerCase(),
        immutableToken: crypto.randomUUID(),
        fileName: fileNameFor(artifactRef),
        createdAt: now,
        updatedAt: now,
      },
    };
  }
}

export default DesktopApiFirmwareArtifact;

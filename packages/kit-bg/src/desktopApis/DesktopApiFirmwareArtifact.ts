// cspell:ignore fwlease

import { createHash, randomUUID } from 'node:crypto';
import {
  accessSync,
  createReadStream,
  createWriteStream,
  constants as fsConstants,
  mkdirSync,
} from 'node:fs';
import {
  type FileHandle,
  mkdir,
  open,
  readdir,
  rename,
  rm,
  stat,
} from 'node:fs/promises';
import https from 'node:https';
import path from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import { app, session } from 'electron';
import yauzl from 'yauzl';

import {
  SniRequestError,
  buildSniRequestOptions,
  classifyTransportError,
  createSniRequestAgent,
  validateSniRequestConfig,
} from './DesktopApiSniRequest';
import { FirmwareArtifactDesktopError } from './FirmwareArtifactDesktopError';

import type { IDesktopApi } from './instance/IDesktopApi';
import type {
  IFirmwareArtifactAdapter,
  IFirmwareArtifactReceipt,
} from '../services/ServiceFirmwareUpdate/FirmwareArtifactAdapter.types';
import type { ReadableStream as NodeReadableStream } from 'node:stream/web';
import type { Entry, ZipFile } from 'yauzl';

const MAX_READ_BYTES = 256 * 1024;
const MAX_ARTIFACT_BYTES = 512 * 1024 * 1024;
const MAX_ARCHIVE_ENTRIES = 4096;
const MAX_ARCHIVE_ENTRY_BYTES = 128 * 1024 * 1024;
const UNIX_FILE_TYPE_MASK = 61_440;
const UNIX_REGULAR_FILE_TYPE = 32_768;
const ARTIFACT_REF_PATTERN = /^fw:[a-f0-9]{64}$/u;
const SHA256_PATTERN = /^[a-fA-F0-9]{64}$/u;
const TASK_ID_PATTERN = /^[A-Za-z0-9._-]{1,100}$/u;
const IDENTIFIER_PATTERN = /^[A-Za-z0-9._:-]{1,160}$/u;
const LEASE_REF_PATTERN = /^fwlease:[a-f0-9-]{36}$/u;
const NESTED_ARCHIVE_PATTERN = /\.(?:zip|7z|rar|tar|gz|tgz)$/iu;
const FINAL_ARTIFACT_GRACE_MS = 24 * 60 * 60 * 1000;
const PARTIAL_ARTIFACT_GRACE_MS = 7 * 24 * 60 * 60 * 1000;
const FIRMWARE_ARTIFACT_HOSTNAMES = new Set([
  'common.onekey-asset.com',
  'pub-d5c080673b4e4e9dae7e03680340378d.r2.dev',
  'web.onekey-asset.com',
]);

type IDownloadInput = Parameters<IFirmwareArtifactAdapter['download']>[0];
type IMaterializeInput = Parameters<IFirmwareArtifactAdapter['materialize']>[0];
type IExpectedEntry = IMaterializeInput['expectedEntries'][number];

type IStagedEntry = {
  entryName: string;
  expectedSize: number;
  expectedSha256: string;
  filePath: string;
};

type IFirmwareArtifactLease = {
  transactionId: string;
  artifactRefs: Set<string>;
};

const hashFile = async (filePath: string): Promise<string> => {
  const digest = createHash('sha256');
  for await (const chunk of createReadStream(filePath)) {
    digest.update(chunk);
  }
  return digest.digest('hex');
};

const assertSafeInteger = (value: number, label: string): void => {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new FirmwareArtifactDesktopError(
      'ARTIFACT_INVALID_INPUT',
      `${label} must be a positive safe integer`,
    );
  }
};

export const isFirmwareArtifactUrlAllowed = (url: URL): boolean =>
  url.protocol === 'https:' &&
  url.port === '' &&
  !url.username &&
  !url.password &&
  !url.hash &&
  FIRMWARE_ARTIFACT_HOSTNAMES.has(url.hostname.toLowerCase());

const validatePortableEntryName = (
  name: string,
  canonicalNames: Set<string>,
): void => {
  const normalized = name.normalize('NFC');
  const folded = normalized.toLowerCase();
  const parts = name.split('/');
  if (
    !name ||
    name.length > 512 ||
    name !== normalized ||
    name.startsWith('/') ||
    name.startsWith('\\') ||
    name.includes('\\') ||
    name.includes(':') ||
    Array.from(name).some((character) => {
      const code = character.codePointAt(0) ?? 0;
      return code < 0x20 || code === 0x7f;
    }) ||
    parts.some(
      (part) =>
        !part ||
        part === '.' ||
        part === '..' ||
        part.endsWith('.') ||
        part.endsWith(' '),
    ) ||
    NESTED_ARCHIVE_PATTERN.test(name) ||
    canonicalNames.has(folded)
  ) {
    throw new FirmwareArtifactDesktopError(
      'ARTIFACT_ARCHIVE_INVALID',
      'Firmware archive entry name is not portable',
    );
  }
  canonicalNames.add(folded);
};

const openZip = (filePath: string, options: yauzl.Options): Promise<ZipFile> =>
  new Promise((resolve, reject) => {
    yauzl.open(filePath, options, (error, zipFile) => {
      if (error || !zipFile) {
        reject(
          new FirmwareArtifactDesktopError(
            'ARTIFACT_ARCHIVE_INVALID',
            'Firmware archive cannot be opened',
            { cause: error },
          ),
        );
      } else {
        resolve(zipFile);
      }
    });
  });

const openZipEntry = (zipFile: ZipFile, entry: Entry): Promise<Readable> =>
  new Promise((resolve, reject) => {
    zipFile.openReadStream(entry, (error, stream) => {
      if (error || !stream) {
        reject(
          new FirmwareArtifactDesktopError(
            'ARTIFACT_ARCHIVE_INVALID',
            'Firmware archive entry cannot be opened',
            { cause: error },
          ),
        );
      } else {
        resolve(stream);
      }
    });
  });

class DesktopApiFirmwareArtifact implements IFirmwareArtifactAdapter {
  private readonly pinnedAgent = createSniRequestAgent();

  private readonly downloads = new Map<
    string,
    Promise<IFirmwareArtifactReceipt>
  >();

  private readonly cancelledTransactions = new Set<string>();

  private readonly cancellationCallbacks = new Map<string, Set<() => void>>();

  private readonly readers = new Map<
    string,
    { handle: FileHandle; size: number; filePath: string }
  >();

  private readonly rootPath: string;

  private readonly leases = new Map<string, IFirmwareArtifactLease>();

  constructor(_params: { desktopApi: IDesktopApi }) {
    this.rootPath = path.join(app.getPath('userData'), 'firmware-artifacts');
    mkdirSync(this.rootPath, { recursive: true });
    accessSync(this.rootPath, fsConstants.R_OK | fsConstants.W_OK);
  }

  getCapabilities() {
    return {
      firmwareArtifactProtocolVersion: 2,
      supportedRouteTypes: ['domain', 'pinnedIp'],
      supportsArchiveMaterialization: true,
      maxReadBytes: MAX_READ_BYTES,
    };
  }

  async download(input: IDownloadInput): Promise<IFirmwareArtifactReceipt> {
    this.validateDownloadInput(input);
    this.assertNotCancelled(input.transactionId);
    await this.retainExpected({
      leaseRef: input.leaseRef,
      transactionId: input.transactionId,
      artifactRef: `fw:${input.expectedSha256.toLowerCase()}`,
    });
    const key = `${input.expectedSha256.toLowerCase()}:${input.expectedSize}:${
      input.transactionId
    }`;
    const existing = this.downloads.get(key);
    if (existing) return existing;
    const task = this.downloadLocked(input).finally(() => {
      this.downloads.delete(key);
    });
    this.downloads.set(key, task);
    return task;
  }

  async cancelDownloads(transactionId: string): Promise<void> {
    if (!IDENTIFIER_PATTERN.test(transactionId)) {
      throw new FirmwareArtifactDesktopError(
        'ARTIFACT_INVALID_INPUT',
        'Firmware transactionId is invalid',
      );
    }
    this.cancelledTransactions.add(transactionId);
    for (const cancel of this.cancellationCallbacks.get(transactionId) ?? []) {
      cancel();
    }
  }

  async materialize(
    input: IMaterializeInput,
  ): Promise<
    readonly { entryName: string; receipt: IFirmwareArtifactReceipt }[]
  > {
    await this.assertLease(input.leaseRef);
    const archivePath = await this.resolveArtifactPath(
      input.archiveArtifactRef,
    );
    const requirements = this.validateExpectedEntries(input.expectedEntries);
    await this.validateArchive(archivePath, requirements);
    const scratchPath = path.join(this.rootPath, `archive-${randomUUID()}`);
    await mkdir(scratchPath, { recursive: false });
    try {
      const staged = await this.extractArchive(
        archivePath,
        scratchPath,
        requirements,
      );
      const result = [];
      for (const entry of staged) {
        const destination = this.artifactPath(entry.expectedSha256);
        if (
          !(await this.isStoredArtifactValid(
            destination,
            entry.expectedSize,
            entry.expectedSha256,
          ))
        ) {
          await rm(destination, { force: true });
          await rename(entry.filePath, destination);
        }
        const receipt = {
          artifactRef: `fw:${entry.expectedSha256}`,
          size: entry.expectedSize,
          sha256: entry.expectedSha256,
        };
        await this.retainExpected({
          leaseRef: input.leaseRef,
          artifactRef: receipt.artifactRef,
        });
        result.push({
          entryName: entry.entryName,
          receipt,
        });
      }
      return result;
    } finally {
      await rm(scratchPath, { recursive: true, force: true });
    }
  }

  async open(artifactRef: string) {
    const filePath = await this.resolveArtifactPath(artifactRef);
    const fileStat = await stat(filePath);
    const readerId = randomUUID();
    this.readers.set(readerId, {
      handle: await open(filePath, 'r'),
      size: fileStat.size,
      filePath,
    });
    return { readerId, size: fileStat.size };
  }

  async read({
    readerId,
    offset,
    length,
  }: {
    readerId: string;
    offset: number;
    length: number;
  }): Promise<ArrayBuffer> {
    if (
      !Number.isSafeInteger(offset) ||
      offset < 0 ||
      !Number.isSafeInteger(length) ||
      length <= 0 ||
      length > MAX_READ_BYTES
    ) {
      throw new FirmwareArtifactDesktopError(
        'ARTIFACT_READER_INVALID',
        'Firmware artifact read is invalid',
      );
    }
    const reader = this.readers.get(readerId);
    if (!reader || offset + length > reader.size) {
      throw new FirmwareArtifactDesktopError(
        'ARTIFACT_READER_INVALID',
        'Firmware artifact read is out of bounds',
      );
    }
    const buffer = Buffer.allocUnsafe(length);
    const { bytesRead } = await reader.handle.read(buffer, 0, length, offset);
    if (bytesRead !== length) {
      throw new FirmwareArtifactDesktopError(
        'ARTIFACT_READER_INVALID',
        'Firmware artifact returned a short read',
      );
    }
    return buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength,
    );
  }

  async close(readerId: string): Promise<void> {
    const reader = this.readers.get(readerId);
    this.readers.delete(readerId);
    await reader?.handle.close();
  }

  async createLease(transactionId: string): Promise<{ leaseRef: string }> {
    if (!IDENTIFIER_PATTERN.test(transactionId)) {
      throw new FirmwareArtifactDesktopError(
        'ARTIFACT_INVALID_INPUT',
        'Firmware transactionId is invalid',
      );
    }
    if (this.leases.size >= 32) {
      throw new FirmwareArtifactDesktopError(
        'ARTIFACT_INVALID_INPUT',
        'Too many firmware artifact leases',
      );
    }
    const leaseRef = `fwlease:${randomUUID()}`;
    this.leases.set(leaseRef, {
      transactionId,
      artifactRefs: new Set(),
    });
    return { leaseRef };
  }

  async retain({
    leaseRef,
    artifactRef,
  }: {
    leaseRef: string;
    artifactRef: string;
  }): Promise<void> {
    await this.resolveArtifactPath(artifactRef);
    await this.retainExpected({ leaseRef, artifactRef });
  }

  async releaseLease({
    leaseRef,
    disposition,
  }: Parameters<IFirmwareArtifactAdapter['releaseLease']>[0]): Promise<void> {
    if (
      disposition !== 'completed' &&
      disposition !== 'safeCancelled' &&
      disposition !== 'safeAbandoned'
    ) {
      throw new FirmwareArtifactDesktopError(
        'ARTIFACT_INVALID_INPUT',
        'Firmware lease disposition is invalid',
      );
    }
    const lease = this.leases.get(this.validateLeaseRef(leaseRef));
    if (!lease) {
      throw new FirmwareArtifactDesktopError(
        'ARTIFACT_LEASE_UNAVAILABLE',
        'Firmware artifact lease is unavailable',
      );
    }
    this.leases.delete(leaseRef);
    const { transactionId } = lease;
    this.cancelledTransactions.delete(transactionId);
  }

  async sweepOrphans(): Promise<{
    deletedFiles: number;
    deletedBytes: number;
  }> {
    const retained = new Set(
      [...this.leases.values()]
        .flatMap((lease) => [...lease.artifactRefs])
        .map((artifactRef) => artifactRef.slice(3)),
    );
    const active = new Set(
      [...this.downloads.keys()].map((key) => key.slice(0, 64)),
    );
    const openPaths = new Set(
      [...this.readers.values()].map((reader) => reader.filePath),
    );
    const files = await readdir(this.rootPath, { withFileTypes: true }).catch(
      () => [],
    );
    const now = Date.now();
    let deletedFiles = 0;
    let deletedBytes = 0;
    for (const entry of files) {
      if (entry.isFile()) {
        const sha256 = entry.name.slice(0, 64);
        if (
          /^[a-f0-9]{64}$/u.test(sha256) &&
          !retained.has(sha256) &&
          !active.has(sha256)
        ) {
          const filePath = path.join(this.rootPath, entry.name);
          if (!openPaths.has(filePath)) {
            let grace: number | undefined;
            if (entry.name.endsWith('.bin')) {
              grace = FINAL_ARTIFACT_GRACE_MS;
            } else if (entry.name.endsWith('.partial')) {
              grace = PARTIAL_ARTIFACT_GRACE_MS;
            }
            if (grace) {
              const fileStat = await stat(filePath).catch(() => undefined);
              if (fileStat && now - fileStat.mtimeMs >= grace) {
                await rm(filePath, { force: true });
                deletedFiles += 1;
                deletedBytes += fileStat.size;
              }
            }
          }
        }
      }
    }
    return { deletedFiles, deletedBytes };
  }

  private validateDownloadInput(input: IDownloadInput): void {
    const url = new URL(input.url);
    if (!isFirmwareArtifactUrlAllowed(url)) {
      throw new FirmwareArtifactDesktopError(
        'ARTIFACT_INVALID_INPUT',
        'Firmware URL is outside the reviewed artifact host allowlist',
      );
    }
    assertSafeInteger(input.expectedSize, 'expectedSize');
    if (
      input.expectedSize > MAX_ARTIFACT_BYTES ||
      input.maxBytes !== input.expectedSize ||
      !SHA256_PATTERN.test(input.expectedSha256) ||
      !TASK_ID_PATTERN.test(input.taskId) ||
      !IDENTIFIER_PATTERN.test(input.transactionId) ||
      !IDENTIFIER_PATTERN.test(input.artifactId) ||
      !LEASE_REF_PATTERN.test(input.leaseRef) ||
      !Number.isFinite(input.overallDeadlineSeconds) ||
      input.overallDeadlineSeconds <= 0
    ) {
      throw new FirmwareArtifactDesktopError(
        'ARTIFACT_INVALID_INPUT',
        'Firmware artifact constraints are invalid',
      );
    }
    if (
      (input.route.routeType !== 'domain' &&
        input.route.routeType !== 'pinnedIp') ||
      (input.route.routeType === 'pinnedIp' && !input.route.resolvedIp) ||
      (input.route.routeType === 'domain' &&
        'resolvedIp' in input.route &&
        input.route.resolvedIp !== undefined)
    ) {
      throw new FirmwareArtifactDesktopError(
        'ARTIFACT_INVALID_INPUT',
        'Firmware route constraints are invalid',
      );
    }
  }

  private async downloadLocked(
    input: IDownloadInput,
  ): Promise<IFirmwareArtifactReceipt> {
    this.assertNotCancelled(input.transactionId);
    await mkdir(this.rootPath, { recursive: true });
    const expectedSha256 = input.expectedSha256.toLowerCase();
    const finalPath = this.artifactPath(expectedSha256);
    if (
      await this.isStoredArtifactValid(
        finalPath,
        input.expectedSize,
        expectedSha256,
      )
    ) {
      return {
        artifactRef: `fw:${expectedSha256}`,
        size: input.expectedSize,
        sha256: expectedSha256,
      };
    }

    const partialPath = path.join(
      this.rootPath,
      `${expectedSha256}.${input.taskId}.partial`,
    );
    let partialSize = await stat(partialPath)
      .then((value) => value.size)
      .catch(() => 0);
    if (partialSize > input.expectedSize) {
      await rm(partialPath, { force: true });
      partialSize = 0;
    } else if (
      partialSize === input.expectedSize &&
      (await this.isStoredArtifactValid(
        partialPath,
        input.expectedSize,
        expectedSha256,
      ))
    ) {
      await rm(finalPath, { force: true });
      await rename(partialPath, finalPath);
      return {
        artifactRef: `fw:${expectedSha256}`,
        size: input.expectedSize,
        sha256: expectedSha256,
      };
    } else if (partialSize === input.expectedSize) {
      await rm(partialPath, { force: true });
      partialSize = 0;
    }
    await this.streamResponseToFile(input, partialPath, partialSize);
    this.assertNotCancelled(input.transactionId);
    if (
      !(await this.isStoredArtifactValid(
        partialPath,
        input.expectedSize,
        expectedSha256,
      ))
    ) {
      await rm(partialPath, { force: true });
      throw new FirmwareArtifactDesktopError(
        'ARTIFACT_INTEGRITY_FAILED',
        'Firmware artifact size or SHA-256 is invalid',
      );
    }
    await rm(finalPath, { force: true });
    await rename(partialPath, finalPath);
    return {
      artifactRef: `fw:${expectedSha256}`,
      size: input.expectedSize,
      sha256: expectedSha256,
    };
  }

  private async streamResponseToFile(
    input: IDownloadInput,
    partialPath: string,
    resumeOffset: number,
  ): Promise<void> {
    const url = new URL(input.url);
    const headers: Record<string, string> = {
      'Accept-Encoding': 'identity',
      ...(resumeOffset > 0 ? { Range: `bytes=${resumeOffset}-` } : {}),
    };
    const timeout = Math.min(
      Math.ceil(input.overallDeadlineSeconds * 1000),
      30 * 60 * 1000,
    );
    if (input.route.routeType === 'domain') {
      return this.streamDomainResponseToFile({
        input,
        partialPath,
        resumeOffset,
        headers,
        timeout,
      });
    }
    const options = buildSniRequestOptions(
      validateSniRequestConfig({
        requestId: input.taskId,
        ip: input.route.resolvedIp,
        hostname: url.hostname,
        path: `${url.pathname}${url.search}`,
        method: 'GET',
        headers,
        body: null,
        timeout,
      }),
      this.pinnedAgent,
    );

    let unregisterCancellation: () => void = () => undefined;
    try {
      await new Promise<void>((resolve, reject) => {
        let responseBody: Readable | undefined;
        const request = https.request(options, async (response) => {
          responseBody = response;
          try {
            await this.writeResponseBody({
              input,
              partialPath,
              resumeOffset,
              statusCode: response.statusCode ?? 0,
              contentRange: response.headers['content-range'],
              contentEncoding: response.headers['content-encoding'],
              body: response,
            });
            resolve();
          } catch (error) {
            response.resume();
            reject(error);
          }
        });
        request.setTimeout(timeout, () => {
          request.destroy(
            new FirmwareArtifactDesktopError(
              'ARTIFACT_NETWORK_FAILED',
              'Firmware request timed out',
            ),
          );
        });
        request.on('error', (error) => {
          if (this.cancelledTransactions.has(input.transactionId)) {
            reject(this.createCancelledError());
            return;
          }
          const classified = classifyTransportError(error);
          reject(
            classified instanceof FirmwareArtifactDesktopError ||
              classified instanceof SniRequestError
              ? classified
              : new FirmwareArtifactDesktopError(
                  'ARTIFACT_NETWORK_FAILED',
                  classified.message,
                  { cause: classified },
                ),
          );
        });
        unregisterCancellation = this.registerCancellation(
          input.transactionId,
          () => {
            const error = this.createCancelledError();
            responseBody?.destroy(error);
            request.destroy(error);
          },
        );
        request.end();
      });
    } finally {
      unregisterCancellation();
    }
  }

  private async streamDomainResponseToFile({
    input,
    partialPath,
    resumeOffset,
    headers,
    timeout,
  }: {
    input: IDownloadInput;
    partialPath: string;
    resumeOffset: number;
    headers: Record<string, string>;
    timeout: number;
  }): Promise<void> {
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), timeout);
    const unregister = this.registerCancellation(input.transactionId, () =>
      abortController.abort(),
    );
    try {
      const response = await session.defaultSession.fetch(input.url, {
        method: 'GET',
        headers,
        redirect: 'error',
        credentials: 'omit',
        cache: 'no-store',
        signal: abortController.signal,
      });
      if (!response.body) {
        throw new FirmwareArtifactDesktopError(
          'ARTIFACT_PROTOCOL_INVALID',
          'Firmware response body is missing',
        );
      }
      await this.writeResponseBody({
        input,
        partialPath,
        resumeOffset,
        statusCode: response.status,
        contentRange: response.headers.get('content-range') ?? undefined,
        contentEncoding: response.headers.get('content-encoding') ?? undefined,
        body: Readable.fromWeb(response.body as unknown as NodeReadableStream),
      });
    } catch (error) {
      if (error instanceof FirmwareArtifactDesktopError) {
        throw error;
      }
      if (this.cancelledTransactions.has(input.transactionId)) {
        throw this.createCancelledError();
      }
      throw new FirmwareArtifactDesktopError(
        'ARTIFACT_NETWORK_FAILED',
        error instanceof Error ? error.message : String(error),
        { cause: error },
      );
    } finally {
      clearTimeout(timeoutId);
      unregister();
    }
  }

  private assertNotCancelled(transactionId: string): void {
    if (this.cancelledTransactions.has(transactionId)) {
      throw this.createCancelledError();
    }
  }

  private createCancelledError(): FirmwareArtifactDesktopError {
    return new FirmwareArtifactDesktopError(
      'ARTIFACT_CANCELLED',
      'Firmware artifact download was cancelled',
    );
  }

  private registerCancellation(
    transactionId: string,
    cancel: () => void,
  ): () => void {
    const callbacks =
      this.cancellationCallbacks.get(transactionId) ?? new Set<() => void>();
    callbacks.add(cancel);
    this.cancellationCallbacks.set(transactionId, callbacks);
    if (this.cancelledTransactions.has(transactionId)) cancel();
    return () => {
      callbacks.delete(cancel);
      if (!callbacks.size) this.cancellationCallbacks.delete(transactionId);
    };
  }

  private async writeResponseBody({
    input,
    partialPath,
    resumeOffset,
    statusCode,
    contentRange,
    contentEncoding,
    body,
  }: {
    input: IDownloadInput;
    partialPath: string;
    resumeOffset: number;
    statusCode: number;
    contentRange: string | undefined;
    contentEncoding: string | undefined;
    body: Readable;
  }): Promise<void> {
    if (statusCode !== 200 && statusCode !== 206) {
      body.destroy();
      throw new FirmwareArtifactDesktopError(
        `ARTIFACT_HTTP_${statusCode}`,
        'Firmware request failed',
      );
    }
    const append = resumeOffset > 0 && statusCode === 206;
    if (
      statusCode === 206 &&
      !this.isValidContentRange(
        contentRange,
        append ? resumeOffset : 0,
        input.expectedSize,
      )
    ) {
      body.destroy();
      throw new FirmwareArtifactDesktopError(
        'ARTIFACT_PROTOCOL_INVALID',
        'Firmware Content-Range is invalid',
      );
    }
    if (contentEncoding && contentEncoding !== 'identity') {
      body.destroy();
      throw new FirmwareArtifactDesktopError(
        'ARTIFACT_PROTOCOL_INVALID',
        'Firmware response content encoding is invalid',
      );
    }
    let written = append ? resumeOffset : 0;
    const limiter = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        written += chunk.byteLength;
        if (written > input.maxBytes) {
          callback(
            new FirmwareArtifactDesktopError(
              'ARTIFACT_PROTOCOL_INVALID',
              'Firmware response exceeds maxBytes',
            ),
          );
        } else {
          callback(null, chunk);
        }
      },
    });
    await pipeline(
      body,
      limiter,
      createWriteStream(partialPath, {
        flags: append ? 'a' : 'w',
      }),
    );
  }

  private isValidContentRange(
    value: string | undefined,
    expectedStart: number,
    expectedTotal: number,
  ): boolean {
    const match = /^bytes ([0-9]+)-([0-9]+)\/([0-9]+)$/iu.exec(value ?? '');
    if (!match) return false;
    const start = Number(match[1]);
    const end = Number(match[2]);
    const total = Number(match[3]);
    return (
      Number.isSafeInteger(start) &&
      Number.isSafeInteger(end) &&
      Number.isSafeInteger(total) &&
      start === expectedStart &&
      end >= start &&
      end < total &&
      total === expectedTotal
    );
  }

  private validateExpectedEntries(
    entries: IMaterializeInput['expectedEntries'],
  ): Map<string, IExpectedEntry> {
    if (!entries.length || entries.length > MAX_ARCHIVE_ENTRIES) {
      throw new FirmwareArtifactDesktopError(
        'ARTIFACT_ARCHIVE_INVALID',
        'Firmware archive expected entry count is invalid',
      );
    }
    const result = new Map<string, IExpectedEntry>();
    const canonicalNames = new Set<string>();
    let totalSize = 0;
    for (const entry of entries) {
      validatePortableEntryName(entry.entryName, canonicalNames);
      assertSafeInteger(entry.expectedSize, 'archive entry size');
      totalSize += entry.expectedSize;
      if (
        entry.expectedSize > MAX_ARCHIVE_ENTRY_BYTES ||
        totalSize > MAX_ARTIFACT_BYTES ||
        !SHA256_PATTERN.test(entry.expectedSha256) ||
        result.has(entry.entryName)
      ) {
        throw new FirmwareArtifactDesktopError(
          'ARTIFACT_ARCHIVE_INVALID',
          'Firmware archive expected entry is invalid',
        );
      }
      result.set(entry.entryName, entry);
    }
    return result;
  }

  private async validateArchive(
    filePath: string,
    requirements: Map<string, IExpectedEntry>,
  ): Promise<void> {
    const zipFile = await openZip(filePath, {
      autoClose: true,
      lazyEntries: false,
      strictFileNames: true,
      validateEntrySizes: true,
    });
    await new Promise<void>((resolve, reject) => {
      const names = new Set<string>();
      const canonicalNames = new Set<string>();
      zipFile.on('entry', (entry) => {
        try {
          const entryName = String(entry.fileName);
          const requirement = requirements.get(entryName);
          const hostSystem = entry.versionMadeBy >> 8;
          const fileType =
            (entry.externalFileAttributes >>> 16) & UNIX_FILE_TYPE_MASK;
          const isRegular =
            hostSystem === 3 || hostSystem === 19
              ? fileType === 0 || fileType === UNIX_REGULAR_FILE_TYPE
              : (entry.externalFileAttributes & 0x10) === 0;
          validatePortableEntryName(entryName, canonicalNames);
          if (
            !requirement ||
            names.has(entryName) ||
            entryName.endsWith('/') ||
            entry.uncompressedSize !== requirement.expectedSize ||
            entry.uncompressedSize <= 0 ||
            entry.compressedSize < 0 ||
            entry.uncompressedSize > Math.max(entry.compressedSize, 1) * 1000 ||
            (entry.generalPurposeBitFlag & 1) !== 0 ||
            (entry.compressionMethod !== 0 && entry.compressionMethod !== 8) ||
            !isRegular
          ) {
            throw new FirmwareArtifactDesktopError(
              'ARTIFACT_ARCHIVE_INVALID',
              'Firmware archive entry metadata does not match the manifest',
            );
          }
          names.add(entryName);
        } catch (error) {
          zipFile.close();
          reject(
            new FirmwareArtifactDesktopError(
              'ARTIFACT_ARCHIVE_INVALID',
              'Firmware archive entry metadata is invalid',
              { cause: error },
            ),
          );
        }
      });
      zipFile.once('error', reject);
      zipFile.once('end', () => {
        if (names.size !== requirements.size) {
          reject(
            new FirmwareArtifactDesktopError(
              'ARTIFACT_ARCHIVE_INVALID',
              'Firmware archive has missing or extra entries',
            ),
          );
        } else {
          resolve();
        }
      });
    });
  }

  private async extractArchive(
    archivePath: string,
    scratchPath: string,
    requirements: Map<string, IExpectedEntry>,
  ): Promise<IStagedEntry[]> {
    const zipFile = await openZip(archivePath, {
      autoClose: false,
      lazyEntries: true,
      strictFileNames: true,
      validateEntrySizes: true,
    });
    return new Promise((resolve, reject) => {
      const staged: IStagedEntry[] = [];
      let settled = false;
      const fail = (error: unknown) => {
        if (settled) return;
        settled = true;
        zipFile.close();
        reject(error);
      };
      zipFile.on('error', fail);
      zipFile.on('end', () => {
        if (settled) return;
        settled = true;
        zipFile.close();
        if (staged.length !== requirements.size) {
          reject(
            new FirmwareArtifactDesktopError(
              'ARTIFACT_ARCHIVE_INVALID',
              'Firmware archive extraction is incomplete',
            ),
          );
        } else {
          resolve(staged);
        }
      });
      zipFile.on('entry', (entry) => {
        void (async () => {
          const requirement = requirements.get(entry.fileName);
          if (!requirement) {
            throw new FirmwareArtifactDesktopError(
              'ARTIFACT_ARCHIVE_INVALID',
              'Firmware archive contains an unexpected entry',
            );
          }
          const filePath = path.join(scratchPath, `${staged.length}.entry`);
          const digest = createHash('sha256');
          let size = 0;
          const verifier = new Transform({
            transform(chunk: Buffer, _encoding, callback) {
              size += chunk.byteLength;
              if (size > requirement.expectedSize) {
                callback(
                  new FirmwareArtifactDesktopError(
                    'ARTIFACT_ARCHIVE_INVALID',
                    'Firmware archive entry exceeds its expected size',
                  ),
                );
              } else {
                digest.update(chunk);
                callback(null, chunk);
              }
            },
          });
          await pipeline(
            await openZipEntry(zipFile, entry),
            verifier,
            createWriteStream(filePath, { flags: 'wx' }),
          );
          const expectedSha256 = requirement.expectedSha256.toLowerCase();
          if (
            size !== requirement.expectedSize ||
            digest.digest('hex') !== expectedSha256
          ) {
            throw new FirmwareArtifactDesktopError(
              'ARTIFACT_ARCHIVE_INVALID',
              'Firmware archive entry integrity is invalid',
            );
          }
          staged.push({
            entryName: entry.fileName,
            expectedSize: requirement.expectedSize,
            expectedSha256,
            filePath,
          });
          zipFile.readEntry();
        })().catch(fail);
      });
      zipFile.readEntry();
    });
  }

  private artifactPath(sha256: string): string {
    return path.join(this.rootPath, `${sha256}.bin`);
  }

  private async assertLease(leaseRef: string): Promise<void> {
    if (!this.leases.has(this.validateLeaseRef(leaseRef))) {
      throw new FirmwareArtifactDesktopError(
        'ARTIFACT_LEASE_UNAVAILABLE',
        'Firmware artifact lease is unavailable',
      );
    }
  }

  private async retainExpected({
    leaseRef,
    transactionId,
    artifactRef,
  }: {
    leaseRef: string;
    transactionId?: string;
    artifactRef: string;
  }): Promise<void> {
    if (!ARTIFACT_REF_PATTERN.test(artifactRef)) {
      throw new FirmwareArtifactDesktopError(
        'ARTIFACT_INVALID_INPUT',
        'Firmware artifactRef is invalid',
      );
    }
    const lease = this.leases.get(this.validateLeaseRef(leaseRef));
    if (!lease) {
      throw new FirmwareArtifactDesktopError(
        'ARTIFACT_LEASE_UNAVAILABLE',
        'Firmware artifact lease is unavailable',
      );
    }
    if (transactionId && lease.transactionId !== transactionId) {
      throw new FirmwareArtifactDesktopError(
        'ARTIFACT_LEASE_MISMATCH',
        'Firmware artifact lease transaction does not match',
      );
    }
    lease.artifactRefs.add(artifactRef);
  }

  private validateLeaseRef(leaseRef: string): string {
    if (!LEASE_REF_PATTERN.test(leaseRef)) {
      throw new FirmwareArtifactDesktopError(
        'ARTIFACT_INVALID_INPUT',
        'Firmware leaseRef is invalid',
      );
    }
    return leaseRef;
  }

  private async resolveArtifactPath(artifactRef: string): Promise<string> {
    if (!ARTIFACT_REF_PATTERN.test(artifactRef)) {
      throw new FirmwareArtifactDesktopError(
        'ARTIFACT_INVALID_INPUT',
        'Firmware artifactRef is invalid',
      );
    }
    const sha256 = artifactRef.slice(3);
    const filePath = this.artifactPath(sha256);
    if ((await hashFile(filePath).catch(() => '')) !== sha256) {
      throw new FirmwareArtifactDesktopError(
        'ARTIFACT_INTEGRITY_FAILED',
        'Firmware artifact is missing or corrupt',
      );
    }
    return filePath;
  }

  private async isStoredArtifactValid(
    filePath: string,
    expectedSize: number,
    expectedSha256: string,
  ): Promise<boolean> {
    try {
      const fileStat = await stat(filePath);
      return (
        fileStat.isFile() &&
        fileStat.size === expectedSize &&
        (await hashFile(filePath)) === expectedSha256
      );
    } catch {
      return false;
    }
  }
}

export default DesktopApiFirmwareArtifact;
